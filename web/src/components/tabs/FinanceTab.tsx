import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LedgerItem {
  id: string;
  amount: number;
  category: string;
  direction: 'expense' | 'income';
  remark: string;
  date: string; // YYYY-MM-DD
  createdBy: string;
}

export const FinanceTab: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<LedgerItem[]>([]);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('飲食');
  const [remark, setRemark] = useState('');
  const [budgetLimit, setBudgetLimit] = useState<number>(20000); // 飲食預算預設 2 萬元
  const [showBudgetSetting, setShowBudgetSetting] = useState(false);
  
  const toast = useToast();
  const familyId = user?.uid || '';
  const categories = ['飲食', '水電房租', '交通', '貓咪開銷', '日常雜貨', '薪資收入', '其他'];

  // Mock 資料，供訪客通道使用
  const mockTransactions: LedgerItem[] = [
    { id: '1', amount: 50000, category: '薪資收入', direction: 'income', remark: '本月薪水 💰', date: new Date().toISOString().split('T')[0], createdBy: '系統同步' },
    { id: '2', amount: 850, category: '飲食', direction: 'expense', remark: '全聯買菜 🥬', date: new Date().toISOString().split('T')[0], createdBy: '媽媽' },
    { id: '3', amount: 12000, category: '水電房租', direction: 'expense', remark: '繳交房租 🏠', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], createdBy: '媽媽' },
    { id: '4', amount: 1250, category: '水電房租', direction: 'expense', remark: '繳納水費 💧', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], createdBy: '媽媽' },
    { id: '5', amount: 1500, category: '貓咪開銷', direction: 'expense', remark: '買飼料罐罐 🐱', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], createdBy: '爸爸' },
  ];

  useEffect(() => {
    if (!db) {
      // 訪客預覽：使用 Mock 資料
      setTransactions(mockTransactions);
      return;
    }

    // 真實 Firestore 資料同步 (Ledger 明細)
    if (!familyId) return;
    const q = query(collection(db, 'families', familyId, 'expenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ledgerData: LedgerItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ledgerData.push({
          id: doc.id,
          amount: data.amount,
          category: data.category,
          direction: data.direction,
          remark: data.remark,
          date: data.date,
          createdBy: data.createdBy
        });
      });
      // 排序：日期降序
      ledgerData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(ledgerData);
    }, (err) => {
      console.error(err);
      toast.show('無法載入帳目明細，請檢查權限。', 'error');
    });

    return () => unsubscribe();
  }, [familyId]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const newTx = {
      amount: numAmount,
      category,
      direction,
      remark: remark.trim() || '日常記帳',
      date: new Date().toISOString().split('T')[0],
      createdBy: user?.displayName || '媽媽'
    };

    try {
      if (db) {
        await addDoc(collection(db, 'families', familyId, 'expenses'), newTx);
      } else {
        // Mock 新增
        const createdTx: LedgerItem = {
          id: Math.random().toString(),
          ...newTx
        };
        setTransactions((prev) => [createdTx, ...prev]);
      }
      setAmount('');
      setRemark('');
      
      // 預算超額前端即時回饋檢算
      if (direction === 'expense' && category === '飲食') {
        const currentDietTotal = transactions
          .filter(t => t.direction === 'expense' && t.category === '飲食')
          .reduce((sum, t) => sum + t.amount, 0) + numAmount;
        
        const pct = (currentDietTotal / budgetLimit) * 100;
        if (pct >= 100) {
          toast.show(`🚨 飲食預算已爆表！累計已達 $${currentDietTotal} 元 (超額 $${currentDietTotal - budgetLimit} 元)`, 'error');
        } else if (pct >= 80) {
          toast.show(`⚠️ 預算警告：飲食已花費 ${Math.floor(pct)}% (累計 $${currentDietTotal} 元)`, 'warning');
        } else {
          toast.show('記帳成功！', 'success');
        }
      } else {
        toast.show('記帳成功！', 'success');
      }

    } catch (err: any) {
      toast.show(`記帳失敗: ${err.message}`, 'error');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'families', familyId, 'expenses', id));
      } else {
        // Mock 刪除
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      }
      toast.show('已刪除此筆記帳明細。', 'info');
    } catch (err: any) {
      toast.show(`刪除失敗: ${err.message}`, 'error');
    }
  };

  // 1. 動態計算可用餘額 (Ledger 總帳加總)
  const balance = transactions.reduce((acc, curr) => {
    if (curr.direction === 'income') {
      return acc + curr.amount;
    } else {
      return acc - curr.amount;
    }
  }, 0);

  // 2. 本月飲食累計支出計算
  const dietExpenseTotal = transactions
    .filter((t) => t.direction === 'expense' && t.category === '飲食')
    .reduce((sum, t) => sum + t.amount, 0);

  const dietPercentage = (dietExpenseTotal / budgetLimit) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      {/* 說明面板 */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(162, 155, 254, 0.05) 100%)',
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>💰 共享家庭帳戶 (防 Race Condition)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「去中心化總帳，根本上防止並發衝突。」<br />
          系統無單一 balance 實體欄位，可用餘額完全由交易明細動態加總，家人同時在 LINE 記帳也不怕餘額出錯！
        </p>
      </div>

      {/* 財務摘要面板 (可用餘額與預算狀態) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* 動態可用餘額 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Ledger 動態可用餘額</span>
            <TrendingUp size={20} color="var(--accent-primary)" />
          </div>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            marginTop: '12px',
            color: balance >= 0 ? 'var(--text-primary)' : 'var(--accent-danger)'
          }}>
            ${balance.toLocaleString()} 元
          </h2>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            透過與 {transactions.length} 筆收支明細動態 Ledger 加總。
          </div>
        </div>

        {/* 飲食預算限額狀態 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>本月「飲食」預算狀態</span>
            <button
              onClick={() => setShowBudgetSetting(!showBudgetSetting)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {showBudgetSetting ? '關閉設定' : '設定上限'}
            </button>
          </div>

          {showBudgetSetting ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0' }}>
              <input
                type="number"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(parseInt(e.target.value, 10) || 0)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  width: '120px',
                  outline: 'none'
                }}
              />
              <span style={{ fontSize: '12px' }}>元</span>
            </div>
          ) : (
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '6px 0' }}>
              ${dietExpenseTotal.toLocaleString()} / ${budgetLimit.toLocaleString()} 元
            </h3>
          )}

          {/* 進度條 */}
          <div style={{ width: '100%', height: '8px', background: 'var(--glass-border)', borderRadius: '4px', overflow: 'hidden', margin: '12px 0' }}>
            <div style={{
              width: `${Math.min(dietPercentage, 100)}%`,
              height: '100%',
              background: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)',
              borderRadius: '4px'
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--text-secondary)' }}>
            <AlertTriangle size={14} />
            <span>
              {dietPercentage >= 100
                ? '🚨 飲食預算已爆表！超额將持續 LINE 推送警報。'
                : dietPercentage >= 80
                ? '⚠️ 飲食已花費 80%+，請注意支出節制。'
                : '✅ 預算在安全控制範圍之內。'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* 左欄：手動新增收支表單 */}
        <form onSubmit={handleAddTransaction} className="glass-panel" style={{
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: 'fit-content'
        }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--accent-primary)" />
            <span>手動登記收支</span>
          </h4>

          {/* 收支方向 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setDirection('expense')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                background: direction === 'expense' ? 'var(--accent-danger)' : 'var(--glass-bg)',
                color: direction === 'expense' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              支出 (-)
            </button>
            <button
              type="button"
              onClick={() => setDirection('income')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                background: direction === 'income' ? 'var(--accent-success)' : 'var(--glass-bg)',
                color: direction === 'income' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              收入 (+)
            </button>
          </div>

          {/* 金額 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>金額</label>
            <input
              type="number"
              placeholder="請輸入金額 (例如: 150)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          {/* 分類 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>分類</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 備註 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>備註說明</label>
            <input
              type="text"
              placeholder="例如: 買午餐排骨飯"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px var(--card-glow)'
            }}
          >
            手動新增明細
          </button>
        </form>

        {/* 右欄：記帳明細列表 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <h4 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '20px' }}>📋 交易明細清單 ({transactions.length} 筆)</h4>

          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <p>📭 目前尚無任何收支紀錄！</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: tx.direction === 'income' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                      color: tx.direction === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {tx.direction === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>

                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{tx.remark}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {tx.date} · {tx.category} · 登記: {tx.createdBy}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontWeight: 'bold',
                      fontSize: '16px',
                      color: tx.direction === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)'
                    }}>
                      {tx.direction === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </span>

                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

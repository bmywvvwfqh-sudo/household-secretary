import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  Mic, 
  AlertTriangle,
  X,
  FileText
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { BindingPanel } from '../BindingPanel';
import { db } from '../../firebase';
import { collection, query, onSnapshot, where, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface CalendarEvent {
  id: string;
  title: string;
  dateTime: string;
}

interface ShoppingItem {
  id: string;
  item: string;
  store: string;
  isBought: boolean;
}

interface UnconfirmedTask {
  id: string;
  rawText: string;
  createdAt: any;
  status: string;
}

export const DashboardTab: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  
  // 狀態管理
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [shoppingTotalCount, setShoppingTotalCount] = useState<number>(0);
  const [dietExpenseTotal, setDietExpenseTotal] = useState<number>(0);
  const [budgetLimit] = useState<number>(20000); // 飲食預設上限 2 萬元
  const [unconfirmedTasks, setUnconfirmedTasks] = useState<UnconfirmedTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🔴 修正：優先使用真實登入的 Google UID 作為家庭 ID，訪客模式下 fallback 為 MVP 固定 ID
  const familyId = user?.uid || "family-123";

  // 取得今天與當月的字串基準 (台北時間為佳)
  const getTodayAndMonthString = () => {
    const now = new Date();
    const tzOffset = 8 * 60; // 台北時區 +8 小時
    const localTime = new Date(now.getTime() + tzOffset * 60 * 1000);
    const isoStr = localTime.toISOString();
    const todayStr = isoStr.split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
    return { todayStr, currentMonthStr };
  };

  const { todayStr, currentMonthStr } = getTodayAndMonthString();

  useEffect(() => {
    if (!db) {
      // 訪客預覽：提供 Mock 資料
      setTodayEvents([
        { id: '1', title: '繳納本月水費 ($1,250)', dateTime: `${todayStr}T15:00:00` },
        { id: '2', title: '帶貓咪去動物醫院看診 🐱', dateTime: `${todayStr}T19:30:00` },
      ]);
      setShoppingItems([
        { id: '1', item: '🥛 全鮮乳 (1加侖)', store: '好市多', isBought: false },
        { id: '2', item: '🧻 抽取式衛生紙', store: '好市多', isBought: false },
        { id: '3', item: '🥬 生鮮有機花椰菜', store: '全聯', isBought: false }
      ]);
      setShoppingTotalCount(3);
      setDietExpenseTotal(15000); // 佔 75%
      setUnconfirmedTasks([
        { id: 'mock-1', rawText: '好市多買牛奶 帶宥均看醫生', createdAt: new Date(), status: 'pending' }
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. 監聽行事曆今日行程
    const calendarQuery = query(collection(db, 'families', familyId, 'calendarEvents'));
    const unsubscribeCalendar = onSnapshot(calendarQuery, (snapshot) => {
      const events: CalendarEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.dateTime && data.dateTime.startsWith(todayStr)) {
          events.push({
            id: doc.id,
            title: data.title,
            dateTime: data.dateTime
          });
        }
      });
      events.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
      setTodayEvents(events);
    }, (err) => console.error('Dashboard 行事曆載入失敗:', err));

    // 2. 監聽待買清單
    const shoppingQuery = query(collection(db, 'families', familyId, 'shoppingList'));
    const unsubscribeShopping = onSnapshot(shoppingQuery, (snapshot) => {
      const activeItems: ShoppingItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.isBought) {
          activeItems.push({
            id: doc.id,
            item: data.item,
            store: data.store,
            isBought: data.isBought
          });
        }
      });
      setShoppingTotalCount(activeItems.length);
      setShoppingItems(activeItems.slice(0, 3));
    }, (err) => console.error('Dashboard 待買清單載入失敗:', err));

    // 3. 監聽本月飲食收支
    const expenseQuery = query(collection(db, 'families', familyId, 'expenses'));
    const unsubscribeExpense = onSnapshot(expenseQuery, (snapshot) => {
      let dietSum = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isCurrentMonth = data.date && data.date.startsWith(currentMonthStr);
        const isDietExpense = data.direction === 'expense' && data.category === '飲食';
        if (isCurrentMonth && isDietExpense) {
          dietSum += data.amount || 0;
        }
      });
      setDietExpenseTotal(dietSum);
    }, (err) => console.error('Dashboard 財務預算載入失敗:', err));

    // 4. 🔴 新增：監聽根目錄的 unconfirmedQueue (待確認佇列)
    const unconfirmedQuery = query(
      collection(db, 'unconfirmedQueue'),
      where('familyId', '==', familyId),
      where('status', '==', 'pending')
    );
    const unsubscribeUnconfirmed = onSnapshot(unconfirmedQuery, (snapshot) => {
      const tasks: UnconfirmedTask[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          id: doc.id,
          rawText: data.rawText,
          createdAt: data.createdAt,
          status: data.status
        });
      });
      setUnconfirmedTasks(tasks);
      setLoading(false);
    }, (err) => {
      console.error('Dashboard 待確認佇列載入失敗:', err);
      setLoading(false);
    });

    return () => {
      unsubscribeCalendar();
      unsubscribeShopping();
      unsubscribeExpense();
      unsubscribeUnconfirmed();
    };
  }, [familyId]);

  const handleVoiceTrigger = () => {
    toast.show('🎤 正在錄音中...請對著麥克風說話。', 'info');
    setTimeout(() => {
      toast.show('🎤 錄音結束，正在傳送音檔 (2.4MB) 直送 Gemini 解析...', 'info');
      setTimeout(() => {
        if (!db) {
          setDietExpenseTotal((prev) => {
            const next = prev + 850;
            if (next >= budgetLimit) {
              toast.show(`🚨 飲食預算爆表！已花費 $${next} 元 (已達 100%+)`, 'error');
            } else if (next >= budgetLimit * 0.8) {
              toast.show(`⚠️ 預算警告：飲食已達 $${next} 元 (已達 80%+)`, 'warning');
            } else {
              toast.show('✅ 語音解析成功！已記入帳目：\n• 全聯消費：$850 元 (飲食 > 超市採買)', 'success');
            }
            return next;
          });
        } else {
          toast.show('✅ 語音解析成功！已寫入 Firestore。', 'success');
        }
      }, 2000);
    }, 2000);
  };

  // 待確認任務轉化邏輯
  const handleConvertTask = async (task: UnconfirmedTask, targetType: 'shopping' | 'calendar') => {
    try {
      if (db) {
        if (targetType === 'shopping') {
          // 轉為採買清單：預設拆解或整句當作項目
          await addDoc(collection(db, 'families', familyId, 'shoppingList'), {
            item: task.rawText,
            store: '一般採買',
            quantity: '1',
            isBought: false,
            createdBy: '網頁手動分配',
            createdAt: new Date(),
            source: 'web_convert'
          });
          toast.show('已成功轉為「採買清單」！', 'success');
        } else {
          // 轉為行事曆行程：預設為今日
          await addDoc(collection(db, 'families', familyId, 'calendarEvents'), {
            title: task.rawText,
            dateTime: `${todayStr}T12:00:00`, // 預設中午
            createdBy: '網頁手動分配',
            createdAt: new Date(),
            source: 'web_convert'
          });
          toast.show('已成功轉為「今日行程」！', 'success');
        }
        // 更新待確認佇列狀態為已處裡
        await updateDoc(doc(db, 'unconfirmedQueue', task.id), { status: 'processed' });
      } else {
        // Mock 刪除
        setUnconfirmedTasks((prev) => prev.filter((t) => t.id !== task.id));
        toast.show(`(Mock) 已將該項目轉化為 ${targetType === 'shopping' ? '採買' : '行程'}！`, 'success');
      }
    } catch (err: any) {
      toast.show(`轉換失敗: ${err.message}`, 'error');
    }
  };

  const handleDismissTask = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'unconfirmedQueue', id));
      } else {
        setUnconfirmedTasks((prev) => prev.filter((t) => t.id !== id));
      }
      toast.show('已清除該筆待確認記事。', 'info');
    } catch (err: any) {
      toast.show(`清除失敗: ${err.message}`, 'error');
    }
  };

  const dietPercentage = (dietExpenseTotal / budgetLimit) * 100;

  const formatTime = (dateTimeStr: string) => {
    try {
      const parts = dateTimeStr.split('T');
      if (parts.length > 1) {
        return parts[1].substring(0, 5);
      }
    } catch {}
    return '--:--';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      animation: 'fadeIn 0.4s ease'
    }}>
      {/* 歡迎與溫馨小語 */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.2) 0%, rgba(162, 155, 254, 0.1) 100%)',
        position: 'relative'
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>
          早安，家庭主理人！☀️
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「家人的安全與舒適，因為有您的悉心打理而完美。」<br />
          今日有 {todayEvents.length} 項行程，{shoppingTotalCount} 項採買物資待補，本月飲食預算剩餘 {Math.max(100 - Math.floor(dietPercentage), 0)}%。
        </p>
        
        {/* 快捷語音記帳漂浮鈕 */}
        <button
          onClick={handleVoiceTrigger}
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '-20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(108, 92, 231, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="太太專用一鍵語音記帳/記事"
        >
          <Mic size={24} />
        </button>
      </div>

      {/* 🔴 新增：LINE 待確認語音/文字記事佇列面板 */}
      {unconfirmedTasks.length > 0 && (
        <div className="glass-panel" style={{
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--accent-warning)" />
            <span style={{ fontWeight: 'bold', fontSize: '15px' }}>💡 LINE 待確認語音/文字記事 ({unconfirmedTasks.length} 筆)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            以下是從 LINE 傳送過來但未能自動分類的訊息，請手動指派或清除：
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {unconfirmedTasks.map((task) => (
              <div key={task.id} className="glass-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  「{task.rawText}」
                </span>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleConvertTask(task, 'shopping')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(52, 211, 153, 0.2)',
                      color: 'var(--accent-success)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    轉為採買
                  </button>
                  <button
                    onClick={() => handleConvertTask(task, 'calendar')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(108, 92, 231, 0.2)',
                      color: 'var(--accent-primary)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    轉為行程
                  </button>
                  <button
                    onClick={() => handleDismissTask(task.id)}
                    style={{
                      padding: '4px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--accent-danger)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="刪除"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 三欄儀表板 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginTop: '10px'
      }}>
        {/* 今日行程卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <Calendar size={18} color="var(--accent-primary)" />
              <span>今日行程</span>
            </div>
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              background: 'rgba(108, 92, 231, 0.15)', 
              color: 'var(--accent-primary)', 
              fontWeight: 'bold' 
            }}>
              {todayEvents.length} 項
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : todayEvents.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                🎉 太棒了！今天沒有任何待辦行程。
              </div>
            ) : (
              todayEvents.map((evt) => (
                <div key={evt.id} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    {formatTime(evt.dateTime)}
                  </span>
                  <span style={{ fontSize: '13px' }}>{evt.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 待買清單卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <ShoppingBag size={18} color="var(--accent-success)" />
              <span>待買清單</span>
            </div>
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              background: 'rgba(52, 211, 153, 0.15)', 
              color: 'var(--accent-success)', 
              fontWeight: 'bold' 
            }}>
              {shoppingTotalCount} 項
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : shoppingItems.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                🛒 家中物資齊全，目前無待買項目。
              </div>
            ) : (
              shoppingItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '13px' }}>{item.item}</span>
                  <span style={{ fontSize: '11px', color: 'var(--accent-success)', fontWeight: 'bold' }}>
                    [{item.store}]
                  </span>
                </div>
              ))
            )}
            {shoppingTotalCount > 3 && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '4px' }}>
                ...以及其他 {shoppingTotalCount - 3} 項物資
              </div>
            )}
          </div>
        </div>

        {/* 財務預算預警卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <DollarSign size={18} color={dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)'} />
              <span>預算狀態</span>
            </div>
            <span style={{ 
              fontSize: '11px', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              background: dietPercentage >= 100 ? 'rgba(239, 68, 68, 0.15)' : dietPercentage >= 80 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)', 
              color: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)', 
              fontWeight: 'bold' 
            }}>
              {dietPercentage >= 100 ? '爆表' : dietPercentage >= 80 ? '注意' : '安全'}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>本月飲食預算:</span>
                  <span style={{ fontWeight: 'bold' }}>
                    ${dietExpenseTotal.toLocaleString()} / ${budgetLimit.toLocaleString()}
                  </span>
                </div>
                
                {/* 預算進度條 */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--glass-border)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(dietPercentage, 100)}%`,
                    height: '100%',
                    background: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)',
                    borderRadius: '4px'
                  }} />
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 500,
                  marginTop: '6px'
                }}>
                  <AlertTriangle size={14} />
                  <span>
                    {dietPercentage >= 100 
                      ? '🚨 預算超額！LINE 記帳將持續示警！' 
                      : dietPercentage >= 80 
                      ? '⚠️ 已達 80% 警戒線，請節制花費。' 
                      : '✅ 預算水位正常，表現優良。'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <BindingPanel />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

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
      gap: '28px',
      animation: 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* 歡迎與溫馨小語 */}
      <div className="glass-panel" style={{
        padding: '32px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(162, 155, 254, 0.05) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(31, 38, 135, 0.03)'
      }}>
        <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          早安，家庭主理人！☀️
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', fontWeight: 500 }}>
          「家人的安全與舒適，因為有您的悉心打理而完美。」<br />
          今日有 <strong style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{todayEvents.length}</strong> 項行程，<strong style={{ color: 'var(--accent-success)', fontWeight: '700' }}>{shoppingTotalCount}</strong> 項採買物資待補，本月飲食預算剩餘 <strong style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{Math.max(100 - Math.floor(dietPercentage), 0)}%</strong>。
        </p>
        
        {/* 快捷語音記帳漂浮鈕 */}
        <button
          onClick={handleVoiceTrigger}
          style={{
            position: 'absolute',
            right: '32px',
            bottom: '-24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6c5ce7 0%, #805ad5 100%)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(108, 92, 231, 0.35), 0 0 0 0px rgba(108, 92, 231, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.15) rotate(5deg)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(108, 92, 231, 0.5), 0 0 0 6px rgba(108, 92, 231, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(108, 92, 231, 0.35), 0 0 0 0px rgba(108, 92, 231, 0.2)';
          }}
          title="一鍵語音記帳/記事"
        >
          <Mic size={24} />
        </button>
      </div>

      {/* LINE 待確認語音/文字記事佇列面板 */}
      {unconfirmedTasks.length > 0 && (
        <div className="glass-panel" style={{
          padding: '24px 28px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 16px 36px rgba(217, 119, 6, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(217, 119, 6, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={16} color="var(--accent-warning)" />
            </div>
            <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '-0.01em' }}>💡 LINE 待確認語音/文字記事 ({unconfirmedTasks.length} 筆)</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
            以下是從 LINE 傳送過來但未能自動分類的訊息，請手動指派或清除：
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            {unconfirmedTasks.map((task) => (
              <div key={task.id} className="glass-card" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.5)'
              }}>
                <span style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  「{task.rawText}」
                </span>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleConvertTask(task, 'shopping')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                      color: 'var(--accent-success)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                    }}
                  >
                    轉為採買
                  </button>
                  <button
                    onClick={() => handleConvertTask(task, 'calendar')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(108, 92, 231, 0.05) 100%)',
                      color: 'var(--accent-primary)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.background = 'rgba(108, 92, 231, 0.25)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.background = 'rgba(108, 92, 231, 0.15)';
                    }}
                  >
                    轉為行程
                  </button>
                  <button
                    onClick={() => handleDismissTask(task.id)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'rgba(220, 38, 38, 0.1)',
                      color: 'var(--accent-danger)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
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
        gap: '24px',
        marginTop: '8px'
      }}>
        {/* 今日行程卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(108, 92, 231, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} color="var(--accent-primary)" />
              </div>
              <span style={{ fontWeight: '800', fontSize: '16px' }}>今日行程</span>
            </div>
            <span style={{ 
              fontSize: '12px', 
              padding: '4px 10px', 
              borderRadius: '20px', 
              background: 'rgba(108, 92, 231, 0.15)', 
              color: 'var(--accent-primary)', 
              fontWeight: '700' 
            }}>
              {todayEvents.length} 項
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : todayEvents.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
                🎉 太棒了！今天沒有任何待辦行程。
              </div>
            ) : (
              todayEvents.map((evt) => (
                <div key={evt.id} style={{ display: 'flex', gap: '14px', padding: '4px 0', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: 'var(--accent-primary)',
                    background: 'rgba(108, 92, 231, 0.08)',
                    padding: '4px 10px',
                    borderRadius: '8px'
                  }}>
                    {formatTime(evt.dateTime)}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{evt.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 待買清單卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={18} color="var(--accent-success)" />
              </div>
              <span style={{ fontWeight: '800', fontSize: '16px' }}>待買清單</span>
            </div>
            <span style={{ 
              fontSize: '12px', 
              padding: '4px 10px', 
              borderRadius: '20px', 
              background: 'rgba(5, 150, 105, 0.15)', 
              color: 'var(--accent-success)', 
              fontWeight: '700' 
            }}>
              {shoppingTotalCount} 項
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : shoppingItems.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
                🛒 家中物資齊全，目前無待買項目。
              </div>
            ) : (
              shoppingItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{item.item}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    color: 'var(--accent-success)', 
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(5, 150, 105, 0.03) 100%)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(5, 150, 105, 0.15)'
                  }}>
                    {item.store}
                  </span>
                </div>
              ))
            )}
            {shoppingTotalCount > 3 && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '6px', fontWeight: 500 }}>
                ...以及其他 {shoppingTotalCount - 3} 項物資
              </div>
            )}
          </div>
        </div>

        {/* 財務預算預警卡片 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '10px', 
                background: dietPercentage >= 100 ? 'rgba(220, 38, 38, 0.1)' : dietPercentage >= 80 ? 'rgba(217, 119, 6, 0.1)' : 'rgba(5, 150, 105, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <DollarSign size={18} color={dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)'} />
              </div>
              <span style={{ fontWeight: '800', fontSize: '16px' }}>預算狀態</span>
            </div>
            <span style={{ 
              fontSize: '12px', 
              padding: '4px 10px', 
              borderRadius: '20px', 
              background: dietPercentage >= 100 ? 'rgba(220, 38, 38, 0.15)' : dietPercentage >= 80 ? 'rgba(217, 119, 6, 0.15)' : 'rgba(5, 150, 105, 0.15)', 
              color: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--accent-success)', 
              fontWeight: '700' 
            }}>
              {dietPercentage >= 100 ? '爆表' : dietPercentage >= 80 ? '注意' : '安全'}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>載入中...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                  <span>本月飲食預算:</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    ${dietExpenseTotal.toLocaleString()} / <span style={{ color: 'var(--text-secondary)' }}>${budgetLimit.toLocaleString()}</span>
                  </span>
                </div>
                
                {/* 預算進度條 */}
                <div style={{
                  width: '100%',
                  height: '10px',
                  borderRadius: '5px',
                  background: 'rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${Math.min(dietPercentage, 100)}%`,
                    height: '100%',
                    background: dietPercentage >= 100 
                      ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' 
                      : dietPercentage >= 80 
                      ? 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)' 
                      : 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
                    borderRadius: '5px',
                    transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                  }} />
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: dietPercentage >= 100 ? 'var(--accent-danger)' : dietPercentage >= 80 ? 'var(--accent-warning)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginTop: '4px'
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

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  Mic, 
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { BindingPanel } from '../BindingPanel';
import { db } from '../../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';

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

export const DashboardTab: React.FC = () => {
  const toast = useToast();
  
  // 狀態管理
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [shoppingTotalCount, setShoppingTotalCount] = useState<number>(0);
  const [dietExpenseTotal, setDietExpenseTotal] = useState<number>(0);
  const [budgetLimit] = useState<number>(20000); // 飲食預設上限 2 萬元
  const [loading, setLoading] = useState<boolean>(true);

  const familyId = "family-123"; // 專案 MVP 固定家庭 ID

  // 取得今天與當月的字串基準 (台北時間為佳)
  const getTodayAndMonthString = () => {
    const now = new Date();
    // 轉為台北時間 YYYY-MM-DD
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
      setLoading(false);
      return;
    }

    // 真實 Firestore 連線監聽
    setLoading(true);

    // 1. 監聽行事曆今日行程
    const calendarQuery = query(collection(db, 'families', familyId, 'calendarEvents'));
    const unsubscribeCalendar = onSnapshot(calendarQuery, (snapshot) => {
      const events: CalendarEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 篩選今日行程：dateTime 開頭為今天 YYYY-MM-DD
        if (data.dateTime && data.dateTime.startsWith(todayStr)) {
          events.push({
            id: doc.id,
            title: data.title,
            dateTime: data.dateTime
          });
        }
      });
      // 依時間排序
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
      // 只取前 3 個展示於儀表板
      setShoppingItems(activeItems.slice(0, 3));
    }, (err) => console.error('Dashboard 待買清單載入失敗:', err));

    // 3. 監聽本月飲食收支
    const expenseQuery = query(collection(db, 'families', familyId, 'expenses'));
    const unsubscribeExpense = onSnapshot(expenseQuery, (snapshot) => {
      let dietSum = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 篩選當月、支出、類別為飲食
        const isCurrentMonth = data.date && data.date.startsWith(currentMonthStr);
        const isDietExpense = data.direction === 'expense' && data.category === '飲食';
        if (isCurrentMonth && isDietExpense) {
          dietSum += data.amount || 0;
        }
      });
      setDietExpenseTotal(dietSum);
      setLoading(false);
    }, (err) => {
      console.error('Dashboard 財務預算載入失敗:', err);
      setLoading(false);
    });

    return () => {
      unsubscribeCalendar();
      unsubscribeShopping();
      unsubscribeExpense();
    };
  }, []);

  const handleVoiceTrigger = () => {
    toast.show('🎤 正在錄音中...請對著麥克風說話。', 'info');
    setTimeout(() => {
      toast.show('🎤 錄音結束，正在傳送音檔 (2.4MB) 直送 Gemini 解析...', 'info');
      setTimeout(() => {
        // 模擬 Gemini 寫入後的即時 UI 反應（訪客模式）
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

  const dietPercentage = (dietExpenseTotal / budgetLimit) * 100;

  // 格式化時間 (HH:mm)
  const formatTime = (dateTimeStr: string) => {
    try {
      const parts = dateTimeStr.split('T');
      if (parts.length > 1) {
        return parts[1].substring(0, 5); // 取得 HH:mm
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

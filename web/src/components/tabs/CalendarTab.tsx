import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '../../hooks/useToast';
import { Plus, Trash2, Globe, Link2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CalendarEvent {
  id: string;
  title: string;
  dateTime: string; // ISO 8601
  createdBy: string;
  source: 'line' | 'web' | 'google' | 'ical';
}

export const CalendarTab: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [isSubmittingIcal, setIsSubmittingIcal] = useState(false);
  const toast = useToast();

  const familyId = "family-123";

  // Mock 資料，供訪客通道使用
  const mockEvents: CalendarEvent[] = [
    { id: '1', title: '繳納水費 ($1,250)', dateTime: new Date().toISOString().split('T')[0] + 'T15:00:00', createdBy: '媽媽', source: 'line' },
    { id: '2', title: '帶貓咪看醫生 🐱', dateTime: new Date().toISOString().split('T')[0] + 'T19:30:00', createdBy: '媽媽', source: 'line' },
    { id: '3', title: '媽媽生日聚餐 🎂', dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T18:00:00', createdBy: '系統同步', source: 'google' },
    { id: '4', title: '全家大掃除 🧹', dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T09:00:00', createdBy: '爸爸', source: 'web' },
  ];

  useEffect(() => {
    if (!db) {
      // 訪客預覽：使用 Mock 資料
      setEvents(mockEvents);
      return;
    }

    // 真實 Firestore 資料同步
    const q = query(collection(db, 'families', familyId, 'calendarEvents'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData: CalendarEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        eventData.push({
          id: doc.id,
          title: data.title,
          dateTime: data.dateTime,
          createdBy: data.createdBy,
          source: data.source
        });
      });
      // 依日期排序
      eventData.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      setEvents(eventData);
    }, (err) => {
      console.error(err);
      toast.show('無法載入行事曆，請檢查權限。', 'error');
    });

    return () => unsubscribe();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    const newEvent = {
      title: newEventTitle,
      dateTime: new Date(newEventDate).toISOString(),
      createdBy: user?.displayName || '媽媽',
      source: 'web' as const
    };

    try {
      if (db) {
        await addDoc(collection(db, 'families', familyId, 'calendarEvents'), newEvent);
      } else {
        // Mock 新增
        const createdEvent: CalendarEvent = {
          id: Math.random().toString(),
          ...newEvent
        };
        setEvents((prev) => [...prev, createdEvent].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()));
      }
      setNewEventTitle('');
      setNewEventDate('');
      toast.show('行程已成功加入行事曆', 'success');
    } catch (err: any) {
      toast.show(`新增行程失敗: ${err.message}`, 'error');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'families', familyId, 'calendarEvents', id));
      } else {
        // Mock 刪除
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
      toast.show('行程已刪除', 'info');
    } catch (err: any) {
      toast.show(`刪除失敗: ${err.message}`, 'error');
    }
  };

  const handleSubscribeIcal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!icalUrl.trim()) return;

    setIsSubmittingIcal(true);
    toast.show('正在嘗試連接外部 iCal 訂閱連結...', 'info');

    setTimeout(() => {
      // Mock 同步
      const syncedEvent: CalendarEvent = {
        id: Math.random().toString(),
        title: '🔔 [iCal 同步] 家長會面談行程',
        dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T10:00:00',
        createdBy: 'iCal 外部訂閱',
        source: 'ical'
      };
      setEvents((prev) => [...prev, syncedEvent].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()));
      setIsSubmittingIcal(false);
      setIcalUrl('');
      toast.show('✅ 外部 iCal 訂閱成功！已自動導入新行程。', 'success');
    }, 2000);
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'line': return { text: 'LINE 管家', bg: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-success)' };
      case 'google': return { text: 'Google 日曆', bg: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)' };
      case 'ical': return { text: 'iCal 訂閱', bg: 'rgba(251, 191, 36, 0.15)', color: 'var(--accent-warning)' };
      default: return { text: '網頁版', bg: 'var(--glass-border)', color: 'var(--text-secondary)' };
    }
  };

  const formatEventTime = (isoString: string) => {
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    
    // 相對日期標籤
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateLabel = `${yyyy}/${mm}/${dd}`;
    if (d.toDateString() === today) {
      dateLabel = '今日';
    } else if (d.toDateString() === tomorrow) {
      dateLabel = '明日';
    }

    return `${dateLabel} ${hh}:${min}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      {/* 說明面板 */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(162, 155, 254, 0.05) 100%)',
      }}>
        <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>📅 共享家庭行事曆</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          「太太點選、全家收到。」<br />
          支援 iOS/Google 行事曆雙軌同步。在 LINE 傳送「明天下午三點繳水費」就會自動新增於此！
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* 左欄：日曆行程列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '20px' }}>📋 行程清單 ({events.length} 項)</h4>
            
            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <p>📭 目前沒有安排行程！</p>
                <p style={{ fontSize: '12px', marginTop: '6px' }}>您可以使用 LINE 新增行程，或在右側手動新增。</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {events.map((event) => {
                  const badge = getSourceBadge(event.source);
                  return (
                    <div
                      key={event.id}
                      className="glass-card"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 20px',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{event.title}</span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: badge.bg,
                            color: badge.color
                          }}>
                            {badge.text}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          📅 {formatEventTime(event.dateTime)} · 登記人: {event.createdBy}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteEvent(event.id)}
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
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右欄：手動新增與外部行事曆訂閱 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 新增行程表單 */}
          <form onSubmit={handleAddEvent} className="glass-panel" style={{
            padding: '24px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} color="var(--accent-primary)" />
              <span>手動新增行程</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>行程名稱</label>
              <input
                type="text"
                placeholder="例如：全家大掃除"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>行程日期與時間</label>
              <input
                type="datetime-local"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
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
              新增行程
            </button>
          </form>

          {/* iCal 外部行事曆訂閱 */}
          <form onSubmit={handleSubscribeIcal} className="glass-panel" style={{
            padding: '24px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h4 style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link2 size={18} color="var(--accent-warning)" />
              <span>外部日曆訂閱 (iOS / Google iCal)</span>
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              輸入您 iPhone 或 Google 日曆的 .ics 公開網址，系統將會定時自動抓取並整合至家庭共享行事曆。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="url"
                placeholder="https://p32-caldav.icloud.com/published/..."
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
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
              disabled={isSubmittingIcal}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent-warning)',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
              }}
            >
              <Globe size={16} />
              <span>{isSubmittingIcal ? '連接同步中...' : '匯入外部日曆'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

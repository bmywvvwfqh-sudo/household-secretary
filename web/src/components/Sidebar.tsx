import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  CheckSquare, 
  Send,
  Users
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const [quickInput, setQuickInput] = useState('');
  const toast = useToast();

  const navItems = [
    { id: 'dashboard', name: '總覽控制台', icon: LayoutDashboard },
    { id: 'calendar', name: '共享行事曆', icon: Calendar },
    { id: 'shopping', name: '店家採買單', icon: ShoppingBag },
    { id: 'finance', name: '家庭財務帳', icon: DollarSign },
    { id: 'chores', name: '家務分配板', icon: CheckSquare },
  ];

  const handleQuickCapture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    // MVP 模擬多項目批次解析 (Mock NLP)
    toast.show('AI 正在批次拆解任務中...', 'info');
    
    setTimeout(() => {
      toast.show('✅ 解析成功！已自動寫入：\n• 行事曆：週六 15:00 帶貓看診\n• 採買清單：好市多買「牛奶、衛生紙」', 'success');
      setQuickInput('');
    }, 1500);
  };

  return (
    <aside className="glass-panel desktop-sidebar" style={{
      flex: '0 0 270px',
      width: '270px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      height: 'calc(100vh - 32px)',
      position: 'sticky',
      top: '16px',
      overflow: 'auto',
      boxShadow: '0 20px 50px rgba(108, 92, 231, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.4)'
    }}>
      {/* App Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 4px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '800',
          fontSize: '22px',
          boxShadow: '0 8px 20px rgba(108, 92, 231, 0.3)'
        }}>
          H
        </div>
        <div>
          <h3 style={{ fontWeight: '800', fontSize: '19px', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>家庭秘書</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>管家與自動化助手</span>
        </div>
      </div>

      {/* 太太極速記事 Capture 流 (輸入框) */}
      <form onSubmit={handleQuickCapture} className="glass-card" style={{
        padding: '16px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'rgba(255, 255, 255, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <label style={{ fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>⚡ 太太極速記事</span>
        </label>
        <textarea
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          placeholder="例如：好市多買牛奶衛生紙，明天3點繳電費1200，週六帶貓看醫生"
          rows={3}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(108, 92, 231, 0.15)',
            borderRadius: '10px',
            padding: '10px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.4',
            transition: 'border-color 0.3s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#6c5ce7'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(108, 92, 231, 0.15)'}
        />
        <button
          type="submit"
          className="primary-btn"
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Send size={13} />
          <span>批次拆解送出</span>
        </button>
      </form>

      {/* 導航 Menu */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 18px',
                border: 'none',
                borderRadius: '14px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'linear-gradient(135deg, #6c5ce7 0%, #805ad5 100%)' : 'transparent',
                boxShadow: isActive ? '0 8px 24px rgba(108, 92, 231, 0.25)' : 'none',
                textAlign: 'left',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <Icon size={18} style={{ opacity: isActive ? 1 : 0.8 }} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* 家庭成員顯示區 */}
      <div className="glass-card" style={{ padding: '16px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 'bold' }}>
          <Users size={16} />
          <span>家庭成員</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* 靜態模擬成員頭像 */}
          <div style={{ border: '2px solid var(--accent-primary)', padding: '2px', borderRadius: '50%' }} title="媽媽 (管理員)">
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ff7675', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>媽</div>
          </div>
          <div style={{ border: '2px solid var(--accent-success)', padding: '2px', borderRadius: '50%' }} title="爸爸">
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#74b9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>爸</div>
          </div>
          <div style={{ border: '2px solid var(--accent-warning)', padding: '2px', borderRadius: '50%' }} title="寶貝">
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffeaa7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>寶</div>
          </div>
        </div>
      </div>

    </aside>
  );
};

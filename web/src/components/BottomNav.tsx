import React from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  ShoppingBag, 
  DollarSign, 
  CheckSquare 
} from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const navItems = [
    { id: 'dashboard', name: '總覽', icon: LayoutDashboard },
    { id: 'calendar', name: '行事曆', icon: Calendar },
    { id: 'shopping', name: '採買', icon: ShoppingBag },
    { id: 'finance', name: '財務', icon: DollarSign },
    { id: 'chores', name: '家務', icon: CheckSquare },
  ];

  return (
    <nav className="glass-panel mobile-bottom-nav" style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      right: '16px',
      height: '64px',
      padding: '0 12px',
      display: 'none', // 桌機端隱藏，藉由媒體查詢在手機端啟用
      alignItems: 'center',
      justifyContent: 'space-around',
      borderRadius: '20px',
      zIndex: 999
    }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              flex: 1,
              height: '100%',
              padding: '4px 0',
              position: 'relative'
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute',
                top: '4px',
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--accent-primary)'
              }} />
            )}
            <Icon size={isActive ? 22 : 20} style={{
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s ease',
              marginTop: isActive ? '4px' : '0'
            }} />
            <span style={{
              fontSize: '10px',
              fontWeight: isActive ? 'bold' : 'normal'
            }}>
              {item.name}
            </span>
          </button>
        );
      })}
      
      <style>{`
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
};

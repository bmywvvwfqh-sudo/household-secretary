import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      margin: '0 0 24px 0',
      borderRadius: '16px',
      position: 'relative'
    }}>
      {/* 標題與狀態 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>🏠 我的溫馨家庭</h2>
        
        {/* LINE 連線標章 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(52, 211, 153, 0.15)',
          color: 'var(--accent-success)',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          <CheckCircle size={14} />
          <span>LINE 管家已連線</span>
        </div>

        {/* 網路狀態標章 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: isOnline ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
          color: isOnline ? 'var(--accent-success)' : 'var(--accent-danger)',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? '在線' : '離線模式'}</span>
        </div>
      </div>

      {/* 控制與使用者選單 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* 主題切換按鈕 */}
        <button
          onClick={toggleTheme}
          style={{
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)'
          }}
          title={theme === 'light' ? '切換暗黑模式' : '切換日光模式'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* 用戶資訊與下拉選單 */}
        {user && (
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)'
              }}
            >
              <img
                src={user.photoURL || 'https://via.placeholder.com/150'}
                alt="avatar"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }} className="desktop-only">
                {user.displayName || '使用者'}
              </span>
            </div>

            {/* 下拉選單彈窗 */}
            {showProfileMenu && (
              <>
                {/* 點擊外部關閉 */}
                <div
                  onClick={() => setShowProfileMenu(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                />
                
                <div
                  className="glass-panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '180px',
                    padding: '8px',
                    zIndex: 999,
                    animation: 'fadeIn 0.2s ease forwards'
                  }}
                >
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--glass-border)',
                    marginBottom: '6px'
                  }}>
                    {user.email}
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      signOut();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-danger)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      textAlign: 'left'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(214, 48, 49, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={16} />
                    <span>登出系統</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .desktop-only { display: none; }
        }
      `}</style>
    </header>
  );
};

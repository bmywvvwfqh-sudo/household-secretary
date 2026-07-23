import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';
import { OfflineBanner } from './components/OfflineBanner';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { DashboardTab } from './components/tabs/DashboardTab';
import { CalendarTab } from './components/tabs/CalendarTab';
import { ShoppingTab } from './components/tabs/ShoppingTab';
import { FinanceTab } from './components/tabs/FinanceTab';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-gradient)',
      color: 'var(--text-primary)',
      padding: '16px',
      gap: '24px'
    }}>
      {/* 側邊導航欄 (大螢幕顯示) */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* 主內容區 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, // 防止 flex item 溢出
        paddingBottom: '80px' // 為手機端底部導航留出空間
      }}>
        {/* 頂部 Header */}
        <Header />

        {/* 離線提示 Banner */}
        <OfflineBanner />

        {/* 內容主視窗 */}
        <main style={{ flex: 1 }}>
          {currentTab === 'dashboard' && <DashboardTab />}
          
          {/* 其他分頁的 Placeholder (驗證 Phase 1 UX 完整無破版) */}
          {currentTab === 'calendar' && <CalendarTab />}
          {currentTab === 'shopping' && <ShoppingTab />}
          {currentTab === 'finance' && <FinanceTab />}
          {currentTab === 'chores' && (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
              <h3>🏠 家務分配與輪值看板</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>將在 Phase 3 啟用此功能</p>
            </div>
          )}
        </main>
      </div>

      {/* 手機底部導航列 (小螢幕顯示) */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
        <ToastContainer />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

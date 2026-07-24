import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';
import { DashboardTab } from './components/tabs/DashboardTab';
import { CalendarTab } from './components/tabs/CalendarTab';
import { ShoppingTab } from './components/tabs/ShoppingTab';
import { FinanceTab } from './components/tabs/FinanceTab';
import { ChoresTab } from './components/tabs/ChoresTab';

type TabId = 'dashboard' | 'calendar' | 'shopping' | 'finance' | 'chores';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) return <LoginScreen />;

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'calendar':  return <CalendarTab />;
      case 'shopping':  return <ShoppingTab />;
      case 'finance':   return <FinanceTab />;
      case 'chores':    return <ChoresTab />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflowX: 'hidden', color: 'var(--text-primary)' }}>
      {/* 🔮 夢幻極光發光背景氣泡 */}
      <div className="bg-glow-container">
        <div className="bg-glow-blob blob-1"></div>
        <div className="bg-glow-blob blob-2"></div>
        <div className="bg-glow-blob blob-3"></div>
      </div>

      <Header />
      <div style={{ display: 'flex', maxWidth: '1250px', margin: '0 auto', padding: '16px', gap: '24px', position: 'relative', zIndex: 1 }}>
        {isDesktop && <Sidebar currentTab={activeTab} setCurrentTab={(tab) => setActiveTab(tab as TabId)} />}
        <main style={{ flex: 1, minWidth: 0, paddingBottom: '100px' }}>
          {renderTab()}
        </main>
      </div>
      <BottomNav currentTab={activeTab} setCurrentTab={(tab) => setActiveTab(tab as TabId)} />
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastContainer />
      <MainApp />
    </AuthProvider>
  </ErrorBoundary>
);

export default App;

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/ToastContainer';
import { DashboardTab } from './components/tabs/DashboardTab';
import { CalendarTab } from './components/tabs/CalendarTab';
import { ShoppingTab } from './components/tabs/ShoppingTab';
import { FinanceTab } from './components/tabs/FinanceTab';

type TabId = 'dashboard' | 'calendar' | 'shopping' | 'finance';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  if (!user) return <LoginScreen />;

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'calendar':  return <CalendarTab />;
      case 'shopping':  return <ShoppingTab />;
      case 'finance':   return <FinanceTab />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-gradient)', color: 'var(--text-primary)' }}>
      <Header />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 100px' }}>
        {renderTab()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as TabId)} />
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

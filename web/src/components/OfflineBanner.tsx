import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div style={{
      width: '100%',
      background: 'rgba(214, 48, 49, 0.85)',
      backdropFilter: 'blur(10px)',
      color: '#fff',
      textAlign: 'center',
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: 'bold',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <span>⚠️ 目前為離線模式，您的操作將在恢復連線後自動同步</span>
    </div>
  );
};

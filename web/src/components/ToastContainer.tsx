import React from 'react';
import { useToast } from '../hooks/useToast';

export const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  const typeStyles = {
    success: { borderLeft: '4px solid var(--accent-success)', color: 'var(--text-primary)' },
    error: { borderLeft: '4px solid var(--accent-danger)', color: 'var(--text-primary)' },
    warning: { borderLeft: '4px solid var(--accent-warning)', color: 'var(--text-primary)' },
    info: { borderLeft: '4px solid var(--accent-primary)', color: 'var(--text-primary)' },
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '350px',
      width: '100%',
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-panel"
          style={{
            display: 'flex',
            justifyContent: 'between',
            alignItems: 'center',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            ...typeStyles[toast.type],
            animation: 'slideIn 0.3s ease forwards',
          }}
          onClick={() => dismiss(toast.id)}
        >
          <div style={{ flex: 1 }}>{toast.message}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(toast.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginLeft: '12px',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

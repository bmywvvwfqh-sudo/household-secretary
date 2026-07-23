import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Calendar, MessageSquare, CreditCard } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { signIn, signInAsGuest } = useAuth();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'var(--bg-gradient)',
      color: 'var(--text-primary)',
    }}>
      <div className="glass-panel" style={{
        padding: '50px 40px',
        maxWidth: '450px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
      }}>
        {/* 背景裝飾微小漸層球 */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-secondary) 0%, rgba(255,255,255,0) 70%)',
          opacity: 0.5,
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '70px',
            height: '70px',
            borderRadius: '20px',
            background: 'var(--accent-primary)',
            color: '#fff',
            marginBottom: '24px',
            boxShadow: '0 8px 24px rgba(108, 92, 231, 0.3)'
          }}>
            <Sparkles size={36} />
          </div>

          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '10px',
            letterSpacing: '1px'
          }}>家庭秘書</h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '15px',
            marginBottom: '35px',
            lineHeight: '1.6'
          }}>
            太太的極速記事流、一鍵交辦家人<br />
            連結 Google 行事曆、專業財務帳戶，您的專屬 LINE 智慧管家。
          </p>

          {/* 功能簡介小圖卡 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '40px',
            textAlign: 'left'
          }}>
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', backdropFilter: 'none' }}>
              <MessageSquare size={18} color="var(--accent-primary)" style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>LINE 智慧管家</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>傳語音或圖文選單查詢</div>
            </div>
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', backdropFilter: 'none' }}>
              <Calendar size={18} color="var(--accent-success)" style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>行事曆雙軌同步</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Google 日曆無縫讀取</div>
            </div>
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', backdropFilter: 'none' }}>
              <CreditCard size={18} color="var(--accent-warning)" style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>多帳戶財務記帳</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>防衝突 Ledger 動態餘額</div>
            </div>
            <div className="glass-card" style={{ padding: '12px', borderRadius: '10px', backdropFilter: 'none' }}>
              <Sparkles size={18} color="var(--accent-danger)" style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>極速 Capture</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>一次性輸入批次拆解</div>
            </div>
          </div>

          <button
            onClick={signIn}
            style={{
              width: '100%',
              padding: '14px 28px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 8px 24px var(--card-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              marginBottom: '12px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 12px 30px var(--card-glow)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px var(--card-glow)';
            }}
          >
            使用 Google 帳號登入
          </button>

          <button
            onClick={signInAsGuest}
            style={{
              width: '100%',
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px dashed var(--accent-primary)',
              background: 'rgba(108, 92, 231, 0.1)',
              color: 'var(--accent-primary)',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.backgroundColor = 'rgba(108, 92, 231, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = 'rgba(108, 92, 231, 0.1)';
            }}
          >
            🛠️ 訪客快速通道 (免設定預覽)
          </button>
        </div>
      </div>
    </div>
  );
};

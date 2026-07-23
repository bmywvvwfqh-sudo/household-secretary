import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '../hooks/useToast';
import { ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BindingPanel: React.FC = () => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5分鐘倒數
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const familyId = "family-123"; // MVP 測試固定家庭 ID

  useEffect(() => {
    if (!code) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCode(null);
          toast.show('配對碼已過期，請重新產生。', 'warning');
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [code]);

  const generateBindingCode = async () => {
    setIsGenerating(true);
    // 生成隨機 6 位數
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分鐘後

    try {
      if (db) {
        // 真實 Firebase 寫入
        await setDoc(doc(db, 'bindingCodes', randomCode), {
          familyId,
          createdAt: Date.now(),
          expiresAt,
          attempts: 0,
          isUsed: false,
          createdBy: user?.uid || 'guest'
        });
      } else {
        // 訪客預覽 Mock
        console.log('[Mock] 生成配對碼:', randomCode);
      }

      setCode(randomCode);
      setTimeLeft(300);
      toast.show('配對碼生成成功！請在 LINE 聊天室中輸入此 6 位數配對碼完成綁定。', 'success');
    } catch (err: any) {
      console.error(err);
      toast.show(`生成配對碼失敗: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-card" style={{
      padding: '24px',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      background: 'var(--glass-bg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <ShieldCheck size={20} color="var(--accent-primary)" />
          <span>LINE 管家帳號綁定</span>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        將您的 LINE 帳號與家庭秘書連結！產生 6 位數配對碼後，在 LINE 聊天室中直接發送該數字即可完成對話框的雙向綁定。
      </p>

      {code ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '20px',
          borderRadius: '12px',
          background: 'rgba(108, 92, 231, 0.08)',
          border: '1px solid var(--accent-secondary)',
          textAlign: 'center',
          animation: 'scaleUp 0.3s ease'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>您的專屬配對碼</span>
          <span style={{
            fontSize: '36px',
            fontWeight: 'bold',
            letterSpacing: '8px',
            color: 'var(--accent-primary)',
            textShadow: '0 4px 10px rgba(108, 92, 231, 0.2)'
          }}>
            {code}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-danger)', fontWeight: 'bold' }}>
            <Clock size={14} />
            <span>有效時間剩餘: {formatTime(timeLeft)}</span>
          </div>
        </div>
      ) : (
        <button
          onClick={generateBindingCode}
          disabled={isGenerating}
          style={{
            width: '100%',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--accent-primary)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px var(--card-glow)'
          }}
        >
          <RefreshCw size={16} className={isGenerating ? "spin" : ""} />
          <span>{isGenerating ? '正在產生...' : '產生 6 位數配對碼'}</span>
        </button>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

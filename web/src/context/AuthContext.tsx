import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from '../firebase';
import { useToast } from '../hooks/useToast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      toast.show('登入成功，歡迎使用家庭秘書！', 'success');
    } catch (error: any) {
      console.error(error);
      toast.show(`登入失敗: ${error.message || '未知錯誤'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const signInAsGuest = () => {
    setLoading(true);
    const mockUser = {
      uid: 'guest-uid-123',
      displayName: '媽媽 (訪客體驗)',
      email: 'mom@family.com',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    } as User;
    setUser(mockUser);
    setLoading(false);
    toast.show('已使用 [訪客快速通道] 進入家庭秘書！', 'success');
  };

  const signOutUser = async () => {
    try {
      setLoading(true);
      if (user?.uid === 'guest-uid-123') {
        setUser(null);
      } else {
        await logout();
      }
      toast.show('已成功登出系統。', 'info');
    } catch (error: any) {
      console.error(error);
      toast.show(`登出失敗: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInAsGuest, signOut: signOutUser }}>
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-gradient)',
          color: 'var(--text-primary)'
        }}>
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
            <div className="spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--glass-border)',
              borderTop: '4px solid var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px',
              display: 'inline-block'
            }}></div>
            <p style={{ fontWeight: 'bold' }}>載入家庭祕書資料中...</p>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

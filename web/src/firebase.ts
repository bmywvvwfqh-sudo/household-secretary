import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let auth: any = null;
let db: any = null;
let googleProvider: any = null;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// 只有當存在有效的 Firebase API Key 時才初始化，否則本機預覽模式下完全不載入 SDK
if (apiKey && apiKey !== "mock-api-key") {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Firebase 初始化失敗，將使用 Mock 模式", error);
  }
}

export { auth, db, googleProvider };

export const loginWithGoogle = async () => {
  if (!auth) {
    throw new Error("Firebase 未配置，請使用訪客通道進行預覽。");
  }
  return signInWithPopup(auth, googleProvider);
};

export const logout = async () => {
  if (!auth) return;
  return signOut(auth);
};

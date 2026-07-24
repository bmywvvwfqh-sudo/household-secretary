import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let auth: any = null;
let db: any = null;
let googleProvider: any = null;

const firebaseConfig = {
  apiKey: "AIzaSyAaKzGUN30fLBKfOsdhgdRewJ64dW2Iyck",
  authDomain: "household-secretary.firebaseapp.com",
  projectId: "household-secretary",
  storageBucket: "household-secretary.firebasestorage.app",
  messagingSenderId: "203423127058",
  appId: "1:203423127058:web:5f3001c9894b4ad382eacb"
};

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase 初始化失敗，將使用 Mock 模式", error);
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

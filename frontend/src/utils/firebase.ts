import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBBV6MP2ROXHLGVq40eME0h-a6RxmSVWec",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trinetra-4e6bb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trinetra-4e6bb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trinetra-4e6bb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "232925304835",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:232925304835:web:624a102ef4b3e6e1fdd636"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
};

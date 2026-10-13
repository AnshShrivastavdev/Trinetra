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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_MOCK_FIREBASE_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trinetra-4e6bb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trinetra-4e6bb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trinetra-4e6bb.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "109102446581",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:109102446581:web:mockappid"
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

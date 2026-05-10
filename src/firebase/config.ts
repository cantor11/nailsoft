import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCPu8mTnLj_tYM1gwacitrfGlMaMjQDYEI",
  authDomain: "nail-studio-1a788.firebaseapp.com",
  projectId: "nail-studio-1a788",
  storageBucket: "nail-studio-1a788.firebasestorage.app",
  messagingSenderId: "647630861069",
  appId: "1:647630861069:web:5cb14d959dce159a69b644"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
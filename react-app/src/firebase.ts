import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDaJbo5MxHGGGa6iRdn6XLiRKQPxvws5N4",
  authDomain: "eventra-101da.firebaseapp.com",
  projectId: "eventra-101da",
  storageBucket: "eventra-101da.firebasestorage.app",
  messagingSenderId: "44095127960",
  appId: "1:44095127960:web:facdde0cc508a75e766bed",
  measurementId: "G-BYNPFVFVMC",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

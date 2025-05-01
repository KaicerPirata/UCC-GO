// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Import getAuth

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvqjeHQCT87IYBbHSJNON5wW6-QkzSQuQ",
  authDomain: "users-cf324.firebaseapp.com",
  projectId: "users-cf324",
  storageBucket: "users-cf324.firebasestorage.app",
  messagingSenderId: "857352624985",
  appId: "1:857352624985:web:65c744add737ca57138a48",
  measurementId: "G-V0969VD4TC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // Export auth instance

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClsGzyuIdUQy9xoxnv02VLB1BPa7mtZJo",
  authDomain: "taskflow-kanban-1gig9.firebaseapp.com",
  projectId: "taskflow-kanban-1gig9",
  storageBucket: "taskflow-kanban-1gig9.firebasestorage.app",
  messagingSenderId: "1064326546935",
  appId: "1:1064326546935:web:ac228c683a65d0404cdaf2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);



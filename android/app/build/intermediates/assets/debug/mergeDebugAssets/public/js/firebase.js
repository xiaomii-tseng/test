// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDrmErLaf1rLc0GC5-1ncj4cqbOfX11ZaE",
  authDomain: "fishing-dcf4c.firebaseapp.com",
  projectId: "fishing-dcf4c",
  storageBucket: "fishing-dcf4c.appspot.com",
  messagingSenderId: "883849375266",
  appId: "1:883849375266:web:2d3ad179436bf8deb5647b",
  measurementId: "G-Q7WVLL8Q7Z"
};

// 初始化 Firebase App
const app = initializeApp(firebaseConfig);

// 初始化 Firestore
const database = getFirestore(app);

// ✅ 導出 app 跟 database
export { app, database };

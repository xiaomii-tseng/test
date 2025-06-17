import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "./firebase.js";

// 🔧 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDrmErLaf1rLc0GC5-1ncj4cqbOfX11ZaE",
  authDomain: "fishing-dcf4c.firebaseapp.com",
  projectId: "fishing-dcf4c",
  storageBucket: "fishing-dcf4c.firebasestorage.app",
  messagingSenderId: "883849375266",
  appId: "1:883849375266:web:2d3ad179436bf8deb5647b",
};
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ 登入
window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    localStorage.setItem("userId", userCredential.user.uid);
  } catch (err) {
    showAlert("登入失敗：" + err.message);
  }
};

function showAlert(message) {
  document.getElementById("customAlertContent").textContent = message;
  new bootstrap.Modal(document.getElementById("customAlertModal")).show();
}
// ✅ 註冊
window.register = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showAlert("註冊成功，請重新登入");
  } catch (err) {
    showAlert("註冊失敗：" + err.message);
  }
};

// 其他 import、firebase 初始化...（已經存在）

// ✅ 放在 login.js 最底下
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "saves", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // ✅ 雲端已有存檔 → 載入並覆蓋 localStorage
      const data = userSnap.data();
      localStorage.setItem(
        "fishing-v3-backpack",
        JSON.stringify(data.backpack || [])
      );
      localStorage.setItem(
        "owned-equipment-v2",
        JSON.stringify(data.ownedEquipment || [])
      );
      localStorage.setItem(
        "equipped-items-v2",
        JSON.stringify(data.equippedItems || {})
      );
      localStorage.setItem("fish-dex-v2", JSON.stringify(data.fishDex || []));
      localStorage.setItem("fishing-player-level-v1", data.level || "1");
      localStorage.setItem("fishing-player-exp-v1", data.exp || "0");
    } else {
      // 🆕 是新帳號 → 給他一組初始資料
      const defaultSave = {
        backpack: [],
        ownedEquipment: [],
        equippedItems: {},
        fishDex: [],
        level: 1,
        exp: 0,
      };
      await setDoc(userRef, defaultSave);

      // 清空 localStorage → 防止殘留資料
      localStorage.clear();
      const keyMap = {
        backpack: "fishing-v3-backpack",
        ownedEquipment: "owned-equipment-v2",
        equippedItems: "equipped-items-v2",
        fishDex: "fish-dex-v2",
        level: "fishing-player-level-v1",
        exp: "fishing-player-exp-v1",
      };
      for (const [k, v] of Object.entries(defaultSave)) {
        localStorage.setItem(
          keyMap[k],
          typeof v === "object" ? JSON.stringify(v) : String(v)
        );
      }
    }

    // 導向遊戲主畫面
    location.href = "fishing.html";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("registerBtn").addEventListener("click", register);
});

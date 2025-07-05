import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth(app);
const db = getFirestore(app);

function showAlert(message) {
  document.getElementById("customAlertContent").textContent = message;
  new bootstrap.Modal(document.getElementById("customAlertModal")).show();
}

// ✅ 登入
window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    showAlert("登入中...");
    localStorage.setItem("userId", userCredential.user.uid);
  } catch (err) {
    showAlert("請確認帳號密碼是否正確");
  }
};

// ✅ 註冊步驟 1：點註冊 → 先檢查 email/password，開啟 modal
window.register = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    return showAlert("請輸入帳號與密碼");
  }

  const modal = new bootstrap.Modal(document.getElementById("usernameModal"));
  modal.show();
};

// ✨ 點擊動畫效果
function addClickBounce(el) {
  el.classList.add("click-bounce");
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove("click-bounce");
    },
    { once: true }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("registerBtn").addEventListener("click", register);

  // ✅ 註冊步驟 2：輸入名稱並送出 createUser
  document
    .getElementById("confirmUsernameBtn")
    .addEventListener("click", async () => {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();
      const playerName = document.getElementById("usernameInput").value.trim();

      if (!email || !password || !playerName) {
        return showAlert("請完整填寫帳號、密碼與玩家名稱");
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        showAlert("註冊成功，登入中...");

        // 儲存初始資料 + 玩家名稱
        const userRef = doc(db, "saves", user.uid);
        const defaultSave = {
          backpack: [],
          ownedEquipment: [],
          equippedItems: {},
          fishDex: [],
          level: 1,
          exp: 0,
          money: 0,
          name: playerName,
        };
        await setDoc(userRef, defaultSave);

        // ✅ 清空後重新初始化
        localStorage.clear();
        localStorage.setItem("fishing-player-level-v1", "1");
        localStorage.setItem("fishing-player-exp-v1", "0");
        localStorage.setItem("fishing-money", "0");
        localStorage.setItem("fishing-v3-backpack", "[]");
        localStorage.setItem("owned-equipment-v2", "[]");
        localStorage.setItem("equipped-items-v2", "{}");
        localStorage.setItem("fish-dex-v2", "[]");
        localStorage.setItem("player-stat-points", "1"); // 🟡 初始1點
        localStorage.setItem(
          "player-custom-bonus",
          JSON.stringify({
            increaseCatchRate: 0,
            increaseRareRate: 0,
            increaseBigFishChance: 0,
            increaseSellValue: 0,
            increaseExpGain: 0,
          })
        );

        const modal = bootstrap.Modal.getInstance(
          document.getElementById("usernameModal")
        );
        location.href = "fishing.html";
      } catch (err) {
        console.error("❌ 註冊失敗：", err);
        showAlert("註冊失敗，請檢查帳號是否已被使用");
      }
    });
});

document.querySelectorAll(".fnc-anm").forEach((btn) => {
  btn.addEventListener("click", () => addClickBounce(btn));
});

// ✅ 登入後讀取資料進 localStorage
onAuthStateChanged(auth, async (user) => {
  const loginBox = document.querySelector(".login-box");
  const loginLoading = document.getElementById("loginLoading");

  if (user) {
    const userRef = doc(db, "saves", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
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
      localStorage.setItem("fishing-money", data.money || "0");
      localStorage.setItem(
        "refine-crystal",
        (data.refineCrystal || 0).toString()
      );
      localStorage.setItem(
        "divine-materials",
        JSON.stringify(data.divineMaterials || {})
      );
      localStorage.setItem(
        "player-custom-bonus",
        JSON.stringify(
          data.customBonus || {
            increaseCatchRate: 0,
            increaseRareRate: 0,
            increaseBigFishChance: 0,
            increaseSellValue: 0,
            increaseExpGain: 0,
          }
        )
      );
      localStorage.setItem(
        "player-stat-points",
        (data.statPoints || 0).toString()
      );
    }

    // ✅ 成功登入 → 導向遊戲
    location.href = "fishing.html";
  } else {
    if (loginLoading) loginLoading.style.display = "none";
    if (loginBox) loginBox.classList.remove("login-box-none");
  }
});

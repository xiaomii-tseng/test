import {
  getFirestore,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "./firebase.js"; // 如果你有這行，保留它
import {
  refreshAllUI,
  addTicketToInventory,
  showAlert,
} from "./main.js";
const db = getFirestore(app); // 初始化 Firestore

export let ACHIEVEMENT_DEFS = {};
const STORAGE_KEY = "fishing-achievements-v1";

export async function loadAchievements() {
  const res = await fetch("achievements.json");
  ACHIEVEMENT_DEFS = await res.json();
}

export function getAchievementStatusMap() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}

export function saveAchievementStatusMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function checkAchievements() {
  const statusMap = getAchievementStatusMap();
  let changed = false;

  for (const [key, data] of Object.entries(ACHIEVEMENT_DEFS)) {
    if (statusMap[key] === "claimed") continue;
    const type = data.condition.type;
    const value = data.condition.value;

    let current = 0;
    switch (type) {
      case "level":
        current = parseInt(
          localStorage.getItem("fishing-player-level-v1") || "1"
        );
        break;
      case "money":
        current = parseInt(localStorage.getItem("fishing-money") || "0");
        break;
      case "fishCount":
        current = parseInt(localStorage.getItem("player-fish-count") || "0");
        break;
      case "mythicFish":
        current = parseInt(localStorage.getItem("mythic-fish-count") || "0");
        break;
      case "chestDraw":
        current = parseInt(localStorage.getItem("player-chest-count") || "0");
        break;
      case "mapDex":
        const dex = JSON.parse(localStorage.getItem("fish-dex-v2") || "[]");
        const mapName = data.condition.map;
        current = dex.filter((entry) => entry.maps === mapName).length;
        break;
    }

    if (statusMap[key] === "claimed" || statusMap[key] === "unlocked") continue; // 🔒 不重複處理
    if (current >= value) {
      statusMap[key] = "unlocked";
      showAlert(`🎉 成就解鎖：「${data.title}」`);
      changed = true;
    }
  }

  if (changed) saveAchievementStatusMap(statusMap);
}

export function claimAchievement(key) {
  const statusMap = getAchievementStatusMap();
  const def = ACHIEVEMENT_DEFS[key];
  if (!def || statusMap[key] !== "unlocked") return;

  const reward = def.reward;

  if (reward.money) {
    const val = parseInt(localStorage.getItem("fishing-money") || "0");
    localStorage.setItem("fishing-money", (val + reward.money).toString());
  }

  if (reward.refineCrystal) {
    const val = parseInt(localStorage.getItem("refine-crystal") || "0");
    localStorage.setItem(
      "refine-crystal",
      (val + reward.refineCrystal).toString()
    );
  }

  if (reward.statPoint) {
    const val = parseInt(localStorage.getItem("player-stat-points") || "0");
    localStorage.setItem(
      "player-stat-points",
      (val + reward.statPoint).toString()
    );
    // 🔥 新增這段，記錄額外點數來源
    const old = parseInt(
      localStorage.getItem("player-achievement-points") || "0",
      10
    );
    localStorage.setItem(
      "player-achievement-points",
      (old + reward.statPoint).toString()
    );
  }

  if (reward.mapPass) {
    addTicketToInventory(reward.mapPass);
  }

  if (reward.divineMaterial) {
    const existing = JSON.parse(
      localStorage.getItem("divine-materials") || "{}"
    );
    for (const [k, v] of Object.entries(reward.divineMaterial)) {
      existing[k] = (existing[k] || 0) + v;
    }
    localStorage.setItem("divine-materials", JSON.stringify(existing));
  }

  statusMap[key] = "claimed";
  saveAchievementStatusMap(statusMap);

  showAlert(`🎁 已領取「${def.title}」成就獎勵！`);

  const userId = localStorage.getItem("userId");
  if (userId) {
    const userRef = doc(db, "saves", userId);
    const dataToSave = {
      achievements: statusMap,
      playerFishCount: parseInt(
        localStorage.getItem("player-fish-count") || "0"
      ),
      mythicFishCount: parseInt(
        localStorage.getItem("mythic-fish-count") || "0"
      ),
      playerChestCount: parseInt(
        localStorage.getItem("player-chest-count") || "0"
      ),
    };
    setDoc(userRef, dataToSave, { merge: true });
  }
  refreshAllUI();
}

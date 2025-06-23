// 自動釣魚遊戲主邏輯

const GAME_VERSION = "2.6.0"; // 每次更新請手動更改版本號
const STORAGE_KEY = "fishing-v3-backpack";
const OWNED_EQUIPMENT_KEY = "owned-equipment-v2";
const EQUIPPED_KEY = "equipped-items-v2";
const FISH_DEX_KEY = "fish-dex-v2";
const LEVEL_KEY = "fishing-player-level-v1";
const EXP_KEY = "fishing-player-exp-v1";
const CRYSTAL_KEY = "refine-crystal";
const DIVINE_STORAGE_KEY = "divine-materials";
let backpack = loadBackpack();
// （移除未使用的 money 全域變數）
let selectedEquippedSlot = null;
let selectedEquipForAction = null;
let manualFishingTimeout = null;
let isAutoMode = true;
let isMultiSelectMode = false;
let currentSort = "desc";
let currentMapKey = "map1"; // 預設地圖
const NORMAL_CHEST_COST = 1500; // 普通寶箱
const HIGH_CHEST_COST = 12000; // 高級寶箱
const TICKET1_PRICE = 50000;
const TICKET2_PRICE = 80000;
const TICKET3_PRICE = 200000;
const selectedFishIds = new Set();
let fishTypes = [];
let allFishTypes = [];
let currentBgm = null;
let isMuted = true;
let userHasInteractedWithBgm = false;
let isAutoFishing = false;
let autoFishingTimeoutId = null;
const buffLabelMap = {
  increaseCatchRate: "增加上鉤率",
  increaseRareRate: "增加稀有率",
  increaseBigFishChance: "大體型機率",
  increaseSellValue: "增加販售金額",
  increaseExpGain: "經驗值加成",
};

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  limit,
  orderBy,
  query,
  collection,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "./firebase.js";

const auth = getAuth();
const db = getFirestore(app);

/** 取得排行榜前幾名玩家資料（預設10名） */
async function getTopPlayersByLevel(limitCount = 10) {
  const q = query(
    collection(db, "saves"),
    orderBy("level", "desc"),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  const result = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    result.push({
      uid: doc.id,
      name: data.name || "匿名",
      level: data.level || 1,
      money: data.money || 0,
      exp: data.exp || 0,
    });
  });
  return result;
}

/** 顯示排行榜 Modal，列出前幾名玩家 */
async function showLeaderboard() {
  const topPlayers = await getTopPlayersByLevel();
  const container = document.getElementById("leaderboardContent");
  container.innerHTML = topPlayers
    .map(
      (p, i) => `
    <div>${i + 1}. ${p.name} | Lv.${
        p.level
      } | 💰 ${p.money.toLocaleString()} G</div>
  `
    )
    .join("");
  new bootstrap.Modal(document.getElementById("leaderboardModal")).show();
}

document
  .getElementById("openLeaderboard")
  .addEventListener("click", async () => {
    const functionMenu = bootstrap.Modal.getInstance(
      document.getElementById("functionMenuModal")
    );
    if (functionMenu) functionMenu.hide();
    await showLeaderboard();
  });

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      showAlert("已登出！");
      window.location.href = "index.html"; // 登出後回登入頁面
    })
    .catch((error) => {
      console.error("登出失敗", error);
    });
});

document
  .getElementById("saveToCloudBtn")
  .addEventListener("click", async () => {
    saveToCloud();
  });

/** 顯示提示訊息的自訂 Modal */
function showAlert(message) {
  document.getElementById("customAlertContent").textContent = message;
  new bootstrap.Modal(document.getElementById("customAlertModal")).show();
}

/** 將遊戲存檔資料上傳至雲端（silent 為 true 時不顯示提示） */
function saveGameDataToCloud(silent = false) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (!silent) showAlert("請先登入");
      return;
    }
    const userId = user.uid;
    const username = user.email.split("@")[0]; // 提取 Email 前綴作為使用者名稱
    const saveData = {
      backpack: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"),
      ownedEquipment: JSON.parse(
        localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]"
      ),
      equippedItems: JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}"),
      fishDex: JSON.parse(localStorage.getItem(FISH_DEX_KEY) || "[]"),
      level: parseInt(localStorage.getItem(LEVEL_KEY) || "1", 10),
      exp: parseInt(localStorage.getItem(EXP_KEY) || "0", 10),
      money: parseInt(localStorage.getItem("fishing-money") || "0", 10),
      name: username,
      refineCrystal: parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10),
      divineMaterials: JSON.parse(
        localStorage.getItem(DIVINE_STORAGE_KEY) || "{}"
      ),
    };
    try {
      await setDoc(doc(db, "saves", userId), saveData);
      if (!silent) showAlert("存檔成功！");
    } catch (err) {
      console.error("❌ 存檔失敗", err);
      if (!silent) showAlert("存檔失敗");
    }
  });
}

/** 手動存檔（顯示提示訊息） */
function saveToCloud() {
  saveGameDataToCloud(false);
}

/** 自動存檔（不顯示提示訊息） */
function autoSaveToCloud() {
  saveGameDataToCloud(true);
}

/** 載入所有地圖的魚種資料（供圖鑑使用） */
async function loadAllFishTypes() {
  const mapKeys = Object.keys(MAP_CONFIG);
  const fishMap = new Map();
  for (const key of mapKeys) {
    const config = MAP_CONFIG[key];
    const res = await fetch(config.json);
    const data = await res.json();
    const processed = assignPriceByProbability(
      normalizeFishProbabilities(data),
      config
    );
    for (const fish of processed) {
      if (!fishMap.has(fish.name)) {
        fishMap.set(fish.name, { ...fish, maps: [config.name] });
      } else {
        const existing = fishMap.get(fish.name);
        existing.maps.push(config.name);
      }
    }
  }
  allFishTypes = Array.from(fishMap.values());
}

const MAP_CONFIG = {
  map1: {
    json: "fish.json",
    baseValue: 100,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.0,
    catchRateModifier: 1.0, // 正常上鉤率
    name: "清澈川流",
    background: "images-webp/index/index3.webp",
    music: "sound/map1.mp3",
    autoFishingAllowed: true,
  },
  map4: {
    json: "fish4.json",
    baseValue: 200,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.1,
    catchRateModifier: 0.9,
    name: "劍與魔法村",
    background: "images-webp/maps/map4.webp",
    requiredLevel: 40,
    requiredEquipNames: [
      "魔劍釣竿",
      "魔法小蝦",
      "魔法帽",
      "魔法長袍",
      "魔法長靴",
    ],
    requiredTicketName: "魔法通行證",
    disableEquip: true,
    ticketDurationMs: 30 * 60 * 1000,
    music: "sound/map1.mp3",
    autoFishingAllowed: true,
  },
  map2: {
    json: "fish2.json",
    baseValue: 400,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.2,
    catchRateModifier: 0.8, // 稍微難釣
    name: "機械城河",
    background: "images-webp/maps/map2.webp",
    requiredLevel: 80,
    requiredEquipNames: [
      "金屬釣竿",
      "金屬餌",
      "金屬頭盔",
      "金屬盔甲",
      "金屬鞋",
    ],
    requiredTicketName: "機械通行證",
    disableEquip: true,
    ticketDurationMs: 30 * 60 * 1000,
    music: "sound/map1.mp3",
    autoFishingAllowed: true,
  },
  map3: {
    json: "fish3.json",
    baseValue: 800,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.3,
    catchRateModifier: 0.7, // 較難上鉤
    name: "黃金遺址",
    background: "images-webp/maps/map3.webp",
    requiredLevel: 120,
    requiredEquipNames: ["黃金釣竿", "黃金", "黃金帽", "黃金外套", "黃金拖鞋"],
    requiredTicketName: "黃金通行證",
    disableEquip: true,
    ticketDurationMs: 30 * 60 * 1000,
    music: "sound/map2.wav",
    autoFishingAllowed: true,
  },
};

let currentMapConfig = MAP_CONFIG[currentMapKey];

/** 切換到指定地圖，檢查條件並初始化地圖資料 */
async function switchMap(mapKey) {
  const config = MAP_CONFIG[mapKey];
  if (!config) return showAlert("無此地圖");

  // 等級檢查
  const level = loadLevel();
  if (config.requiredLevel && level < config.requiredLevel) {
    return showAlert(`需要等級 ${config.requiredLevel} 才能進入`);
  }

  // 裝備檢查
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  const equippedNames = Object.values(equipped).map((e) => e?.name || "");
  const requiredParts = ["rod", "bait", "hat", "shoes", "outfit"];
  const isFullDivineSet = requiredParts.every((part) =>
    equipped[part]?.name?.startsWith("天神")
  );
  if (config.requiredEquipNames && !isFullDivineSet) {
    const missing = config.requiredEquipNames.filter(
      (name) => !equippedNames.includes(name)
    );
    if (missing.length > 0) {
      return showAlert(`需要穿戴：${missing.join("、")}`);
    }
  }

  // 通行證時間檢查
  if (config.ticketDurationMs) {
    const entryTime = parseInt(
      localStorage.getItem(`map-entry-${mapKey}`) || "0",
      10
    );
    if (entryTime > 0) {
      const now = Date.now();
      const elapsed = now - entryTime;
      if (elapsed <= config.ticketDurationMs) {
        // 在有效時間內，允許進入且不再要求通行證
        proceedToMap(config, mapKey);
        return;
      }
    }
  }

  // 通行證檢查與使用
  if (config.requiredTicketName) {
    let owned = loadOwnedEquipments();
    const index = owned.findIndex((e) => e.name === config.requiredTicketName);
    if (index === -1) {
      return showAlert(`缺少通行證：${config.requiredTicketName}`);
    }
    const confirm = await customConfirm(
      `即將消耗${config.requiredTicketName}，是否繼續？提醒: 此地圖無法更換裝備`
    );
    if (!confirm) return;
    // 移除通行證並記錄入場時間
    owned.splice(index, 1);
    saveOwnedEquipments(owned);
    localStorage.setItem(`map-entry-${mapKey}`, Date.now().toString());
  }

  // 清除舊地圖的自動釣魚循環
  stopAutoFishing();
  clearTimeout(manualFishingTimeout);

  // 切換地圖
  proceedToMap(config, mapKey);

  // 僅在自動模式下啟動自動釣魚
  if (config.autoFishingAllowed && isAutoMode) {
    startAutoFishing();
  }
}

// 將 switchMap 函數暴露到全域（供 HTML inline 使用）
window.switchMap = switchMap;

/** 更新背景圖片 */
function updateBackground(imagePath) {
  const wrapper = document.getElementById("backgroundWrapper");
  if (wrapper) {
    wrapper.style.backgroundImage = `url('${imagePath}')`;
  }
}

/** 載入目前已裝備的物品資料 */
function loadEquippedItems() {
  return JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
}

/** 裝備指定物品，若原本同欄位有裝備則卸下 */
function equipItem(item) {
  const equipped = loadEquippedItems();
  let owned = loadOwnedEquipments();
  // 1. 卸下原裝備，放回背包
  const prevEquipped = equipped[item.type];
  if (prevEquipped) {
    owned.push(prevEquipped);
  }
  // 2. 從背包移除要裝備的新裝備（依據 id）
  owned = owned.filter((e) => e.id !== item.id);
  // 3. 裝備新物品到對應欄位
  equipped[item.type] = item;
  // 4. 保存最新的裝備和背包清單
  saveEquippedItems(equipped);
  saveOwnedEquipments(owned);
  // 5. 更新介面
  updateEquippedUI();
  updateOwnedEquipListUI();
}

/** 載入已擁有的裝備清單 */
function loadOwnedEquipments() {
  return JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
}

/** 保存已擁有的裝備清單至本地存儲 */
function saveOwnedEquipments(data) {
  localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(data));
}

/** 保存當前裝備的資料至本地存儲 */
function saveEquippedItems(data) {
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(data));
}

/** 更新裝備欄位的 UI 顯示 */
function updateEquippedUI() {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  document.querySelectorAll(".slot").forEach((slotEl) => {
    const type = slotEl.dataset.slot;
    const item = equipped[type];
    // 清空欄位內容
    slotEl.innerHTML = "";
    if (item && item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.classList.add("equipped-icon");
      slotEl.appendChild(img);
    } else {
      // 顯示欄位預設名稱
      slotEl.textContent = getSlotLabel(type);
    }
  });
}

/** 取得裝備欄位的預設名稱 */
function getSlotLabel(type) {
  switch (type) {
    case "rod":
      return "釣竿";
    case "bait":
      return "魚餌";
    case "hat":
      return "帽子";
    case "outfit":
      return "衣服";
    case "shoes":
      return "鞋子";
    default:
      return "";
  }
}

/** 正規化魚的出現機率總和為 100% */
function normalizeFishProbabilities(fishList) {
  const total = fishList.reduce((sum, f) => sum + f.probability, 0);
  return fishList.map((fish) => ({
    ...fish,
    rawProbability: fish.probability,
    probability: parseFloat(((fish.probability / total) * 100).toFixed(4)),
  }));
}

/** 生成一個隨機 UUID 字串 */
function generateUUID() {
  return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 根據魚種出現機率取得對應的稀有度樣式 */
function getRarityClass(rawProbability) {
  if (rawProbability > 2) return "rarity-common"; // 普通：白色
  if (rawProbability > 0.3) return "rarity-uncommon"; // 高級：藍色
  if (rawProbability > 0.08) return "rarity-rare"; // 稀有：黃色
  if (rawProbability > 0.04) return "rarity-epic"; // 史詩：紫色
  if (rawProbability > 0.01) return "rarity-legend"; // 神話：紅色
  return "rarity-mythic"; // 傳奇：彩色邊框
}

// 精度條控制相關變數
let precisionInterval = null;
let pos = 0;
let direction = 1;
const speed = 5;
const intervalTime = 16;

/** 開始精度條（手動釣魚瞄準條） */
function startPrecisionBar() {
  if (precisionInterval) return;
  document.getElementById("precisionBarContainer").style.display = "flex";
  const track = document.getElementById("precisionTrack");
  const indicator = document.getElementById("precisionIndicator");
  const trackWidth = track.clientWidth;
  const indicatorWidth = indicator.clientWidth;
  // 隨機設定初始位置與方向
  pos = Math.floor(Math.random() * (trackWidth - indicatorWidth));
  direction = Math.random() < 0.5 ? 1 : -1;
  precisionInterval = setInterval(() => {
    pos += speed * direction;
    if (pos >= trackWidth - indicatorWidth) {
      pos = trackWidth - indicatorWidth;
      direction = -1;
    } else if (pos <= 0) {
      pos = 0;
      direction = 1;
    }
    indicator.style.left = pos + "px";
  }, intervalTime);
}

/** 在底部顯示捕獲結果卡片（魚資訊或逃脫） */
function logCatchCard(fishObj, fishType) {
  const bottomInfo = document.getElementById("bottomInfo");
  if (!bottomInfo) return;
  bottomInfo.innerHTML = "";
  bottomInfo.className = "bottom-info show";
  if (fishType && fishObj) {
    const card = document.createElement("div");
    card.className = "fish-card big-card";
    // 套用對應的稀有度樣式
    const rarityClass = getRarityClass(fishType.rawProbability);
    card.classList.add(rarityClass);
    card.innerHTML = `
      <img src="${fishType.image}" class="fish-icon" alt="${fishType.name}">
      <div class="fish-info">
        <div class="fish-name">${fishType.name}</div>
        <div class="fish-size">體型：${fishObj.size.toFixed(1)} %</div>
        <div class="fish-value">💰：${fishObj.finalPrice} G</div>
      </div>
    `;
    bottomInfo.appendChild(card);
  } else {
    bottomInfo.innerHTML = `<div class="fish-escape">魚跑掉了...</div>`;
  }
  clearTimeout(bottomInfo._hideTimer);
  bottomInfo._hideTimer = setTimeout(() => {
    bottomInfo.classList.remove("show");
  }, 3000);
}

/** 進入背包多選模式 */
function enterMultiSelectMode() {
  isMultiSelectMode = true;
  selectedFishIds.clear();
  document.getElementById("multiSelectActions").style.display = "flex";
  updateBackpackUI();
}

/** 切換單條魚卡片的選取狀態 */
function toggleFishSelection(id) {
  if (selectedFishIds.has(id)) {
    selectedFishIds.delete(id);
  } else {
    selectedFishIds.add(id);
  }
  updateCardSelectionUI();
}

/** 更新魚卡片選取狀態的 UI */
function updateCardSelectionUI() {
  document.querySelectorAll(".fish-card").forEach((card) => {
    const id = card.dataset.id;
    card.classList.toggle("selected", selectedFishIds.has(id));
  });
}

/** 為魚卡片元素添加事件處理（點擊選取） */
function handleFishCardEvents(cardEl, fishObj) {
  cardEl.addEventListener("click", () => {
    if (isMultiSelectMode) {
      toggleFishSelection(fishObj.id);
      // （多選模式下切換選取狀態後自動更新 UI）
    }
  });
}

/** 退出背包多選模式 */
function exitMultiSelectMode() {
  isMultiSelectMode = false;
  selectedFishIds.clear();
  document.getElementById("multiSelectActions").style.display = "none";
  updateBackpackUI();
}

/** 批量出售選取的魚並更新資源 */
function batchSellSelected() {
  if (selectedFishIds.size === 0) return; // 若沒有選取任何魚則不執行
  const buffs = getTotalBuffs();
  let rawTotal = 0;
  let finalTotal = 0;
  // 統計選中的魚價值並從背包移除
  backpack = backpack.filter((f) => {
    if (selectedFishIds.has(f.id)) {
      const base = f.finalPrice;
      const bonus = Math.floor(base * (buffs.increaseSellValue / 100));
      rawTotal += base;
      finalTotal += base + bonus;
      return false; // 移除這條魚
    }
    return true;
  });
  // 更新金錢
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  const newMoney = currentMoney + finalTotal;
  localStorage.setItem("fishing-money", newMoney.toString());
  updateMoneyUI();
  // 保存背包變化並更新UI
  saveBackpack();
  updateBackpackUI();
  exitMultiSelectMode();
  // 顯示結算結果
  document.getElementById("rawTotal").textContent = rawTotal.toLocaleString();
  document.getElementById("bonusTotal").textContent = (
    finalTotal - rawTotal
  ).toLocaleString();
  document.getElementById("finalTotal").textContent =
    finalTotal.toLocaleString();
  new bootstrap.Modal(document.getElementById("multiSellResultModal")).show();
}

/** 在底部顯示提示訊息（短暫顯示） */
function logCatch(message) {
  const bottomInfo = document.getElementById("bottomInfo");
  if (bottomInfo) {
    bottomInfo.textContent = message;
    bottomInfo.classList.add("show");
    // 清除先前的計時器，避免重複觸發隱藏
    clearTimeout(bottomInfo._hideTimer);
    bottomInfo._hideTimer = setTimeout(() => {
      bottomInfo.classList.remove("show");
    }, 3000);
  }
}

document
  .getElementById("precisionStopBtn")
  .addEventListener("click", stopPrecisionBar);

/** 停止精度條並判定釣魚結果 */
function stopPrecisionBar() {
  if (!precisionInterval) return;
  clearInterval(precisionInterval);
  precisionInterval = null;
  const track = document.getElementById("precisionTrack");
  const indicator = document.getElementById("precisionIndicator");
  const trackWidth = track.clientWidth;
  const indicatorWidth = indicator.clientWidth;
  const precisionRatio = pos / (trackWidth - indicatorWidth);
  const buffs = getTotalBuffs();
  const successChance =
    Math.min(50 + precisionRatio * 25) *
    ((buffs.increaseCatchRate * 0.3 + 100) / 100) *
    currentMapConfig.catchRateModifier;
  const isSuccess = Math.random() * 100 < successChance;
  if (isSuccess) {
    const fishType = getWeightedFishByPrecision(precisionRatio);
    addFishToBackpack(fishType);
  } else {
    logCatch("魚跑掉了...");
  }
  document.getElementById("precisionBarContainer").style.display = "none";
  if (!isAutoMode) {
    manualFishingTimeout = setTimeout(() => {
      startPrecisionBar();
    }, 3500);
  }
}

/** 依照機率計算每條魚的售價 */
function assignPriceByProbability(fishList, mapConfig) {
  return fishList.map((fish) => ({
    ...fish,
    price: mapConfig.priceFormula(fish.probability, mapConfig.baseValue),
    originalProbability: fish.probability,
  }));
}

const openBackpackBtn = document.getElementById("openBackpack");
if (openBackpackBtn) {
  openBackpackBtn.addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("backpackModal"));
    modal.show();
    enterMultiSelectMode();
  });
}

// 模式切換按鈕邏輯
const toggleBtn = document.getElementById("toggleModeBtn");
const fishingStatus = document.getElementById("fishingStatus");
// 初始化釣魚狀態顯示
if (fishingStatus) {
  fishingStatus.textContent = isAutoMode ? "自動釣魚中..." : "機率加成中...";
}
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    isAutoMode = !isAutoMode;
    toggleBtn.textContent = isAutoMode
      ? "點擊進入手動模式"
      : "點擊進入自動模式";
    // 更新狀態提示文字
    if (fishingStatus) {
      fishingStatus.textContent = isAutoMode
        ? "自動釣魚中..."
        : "機率加成中...";
    }
    // 停止當前釣魚並切換模式
    stopAutoFishing();
    clearTimeout(manualFishingTimeout);
    hidePrecisionBar();
    if (isAutoMode) {
      startAutoFishing();
    } else {
      manualFishingTimeout = setTimeout(() => {
        startPrecisionBar();
      }, 3500);
    }
  });
}

/** 隱藏精度條 UI */
function hidePrecisionBar() {
  clearInterval(precisionInterval);
  precisionInterval = null;
  const container = document.getElementById("precisionBarContainer");
  if (container) container.style.display = "none";
}

/** 為按鈕添加點擊彈跳動畫效果 */
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

/** 取得隨機的自動釣魚延遲時間（毫秒） */
function getRandomAutoFishingDelay() {
  // return 8000 + Math.random() * 5000;
  return 4500;
}

/** 執行一次自動釣魚嘗試 */
function doFishing() {
  // 自動釣魚的成功率 (60%)
  const successRate = 0.6;
  if (Math.random() < successRate) {
    const fishType = getRandomFish();
    if (fishType) {
      addFishToBackpack(fishType);
    } else {
      logCatch("沒釣到魚.");
    }
  } else {
    logCatch("魚跑掉了...");
  }
}

/** 開始自動釣魚循環 */
function startAutoFishing() {
  if (autoFishingTimeoutId !== null) return; // 防止重複啟動
  isAutoFishing = true;
  const scheduleNext = () => {
    if (!isAutoFishing || !currentMapConfig) return;
    doFishing();
    autoFishingTimeoutId = setTimeout(
      scheduleNext,
      getRandomAutoFishingDelay()
    );
  };
  // 初始延遲後開始第一次釣魚
  autoFishingTimeoutId = setTimeout(scheduleNext, getRandomAutoFishingDelay());
}

/** 停止自動釣魚循環 */
function stopAutoFishing() {
  isAutoFishing = false;
  if (autoFishingTimeoutId !== null) {
    clearTimeout(autoFishingTimeoutId);
    autoFishingTimeoutId = null;
  }
}

/** 根據精度條位置加權隨機選擇魚種（手動釣魚專用） */
function getWeightedFishByPrecision(precisionRatio) {
  const weightedFish = fishTypes.map((fish) => {
    const rarityWeight = 1 / fish.probability;
    const buffs = getTotalBuffs();
    const rareRateBonus = 1 + buffs.increaseRareRate / 100;
    const bias =
      1 +
      (rarityWeight * precisionRatio * 0.1 * rareRateBonus) /
        currentMapConfig.rarePenalty;
    return {
      ...fish,
      weight: fish.probability * bias,
    };
  });
  const total = weightedFish.reduce((sum, f) => sum + f.weight, 0);
  const rand = Math.random() * total;
  let sum = 0;
  for (const f of weightedFish) {
    sum += f.weight;
    if (rand < sum) return f;
  }
}

/** 隨機抽取魚種（自動釣魚） */
function getRandomFish() {
  const buffs = getTotalBuffs();
  const rareRateBonus = 1 + buffs.increaseRareRate / 100;
  const weightedFish = fishTypes.map((fish) => {
    const rarityWeight = 1 / fish.probability;
    const bias =
      1 + (rarityWeight * 0.05 * rareRateBonus) / currentMapConfig.rarePenalty;
    return {
      ...fish,
      weight: fish.probability * bias,
    };
  });
  const total = weightedFish.reduce((sum, f) => sum + f.weight, 0);
  const rand = Math.random() * total;
  let sum = 0;
  for (const f of weightedFish) {
    sum += f.weight;
    if (rand < sum) return f;
  }
  return weightedFish[0]; // 如果未選中則回傳第一個
}

/** 創建一條魚的實例（隨機體型和計算價格） */
function createFishInstance(fishType) {
  // 隨機產生體型，四捨五入至小數點一位
  const size = parseFloat((Math.random() * 100).toFixed(1));
  // 根據體型計算最終價格（最大提升35%）
  const buffs = getTotalBuffs();
  const bigFishBonus = 1 + buffs.increaseBigFishChance / 600;
  const adjustedSize = Math.min(size * bigFishBonus, 100); // 體型最大不超過100%
  const rawPrice = fishType.price * (1 + (adjustedSize / 100) * 0.35);
  const finalPrice = Math.floor(rawPrice);
  return {
    id: crypto.randomUUID(),
    name: fishType.name,
    size: size,
    finalPrice: finalPrice,
    caughtAt: new Date().toISOString(),
  };
}

/** 將捕獲的魚加入背包並更新相關狀態 */
function addFishToBackpack(fishType) {
  const fishObj = createFishInstance(fishType);
  backpack.push(fishObj);
  saveBackpack();
  updateFishDex(fishObj);
  updateBackpackUI();
  logCatchCard(fishObj, fishType);
  addExp(fishObj.finalPrice);
  maybeDropDivineItem();
}

/** 從本地存儲載入神話素材數據 */
function loadDivineMaterials() {
  return JSON.parse(localStorage.getItem(DIVINE_STORAGE_KEY) || "{}");
}

/** 保存神話素材數據到本地存儲 */
function saveDivineMaterials(materials) {
  localStorage.setItem(DIVINE_STORAGE_KEY, JSON.stringify(materials));
}

/** 可能掉落神話素材（依據當前地圖設定） */
function maybeDropDivineItem() {
  const dropTable = {
    map1: { name: "隕石碎片", chance: 0.0001 },
    map4: { name: "黃銅礦", chance: 0.0001 },
    map2: { name: "核廢料", chance: 0.0001 },
  };
  const drop = dropTable[currentMapKey];
  if (!drop || Math.random() >= drop.chance) return;
  const materials = loadDivineMaterials();
  materials[drop.name] = (materials[drop.name] || 0) + 1;
  saveDivineMaterials(materials);
  showAlert(`你撿到了一個 ${drop.name}！`);
  updateDivineUI?.();
}

/** 更新神話素材清單的 UI 顯示 */
function updateDivineUI() {
  const materials = loadDivineMaterials();
  const container = document.getElementById("divineItemList");
  if (!container) return;
  const items = Object.entries(materials)
    .map(([name, count]) => `<div>${name} x ${count}</div>`)
    .join("");
  container.innerHTML = items || "(目前尚未收集)";
}

/** 保存背包內容到本地存儲 */
function saveBackpack() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backpack));
}

/** 載入背包資料（如無則回傳空陣列） */
function loadBackpack() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

/** 更新畫面上的金幣數量顯示 */
function updateMoneyUI() {
  const el = document.getElementById("coinCount");
  if (el) {
    el.textContent = parseInt(
      localStorage.getItem("fishing-money") || "0",
      10
    ).toLocaleString();
  }
}

// （移除未使用的 saveMoney 和 loadMoney 函數）

/** 更新背包物品的 UI 列表 */
function updateBackpackUI() {
  const inventory = document.getElementById("inventory");
  if (!inventory) return;
  inventory.innerHTML = "";
  if (backpack.length === 0) {
    inventory.textContent = "(目前背包是空的)";
    return;
  }
  const grid = document.createElement("div");
  grid.className = "fish-grid";
  // 排序背包內容
  let entries = [...backpack];
  if (currentSort) {
    entries.sort((a, b) => {
      const priceA = a.finalPrice || 0;
      const priceB = b.finalPrice || 0;
      return currentSort === "asc" ? priceA - priceB : priceB - priceA;
    });
  }
  // 建立魚卡片元素並附加事件
  for (const fish of entries) {
    const fishType = allFishTypes.find((f) => f.name === fish.name);
    if (!fishType) continue;
    const rarityClass = getRarityClass(fishType.rawProbability);
    const card = document.createElement("div");
    card.className = `fish-card ${rarityClass}`;
    card.dataset.id = fish.id;
    card.innerHTML = `
      <img src="${fishType.image}" class="fish-icon" alt="${fish.name}">
      <div class="fish-info">
        <div class="fish-name">${fish.name}</div>
        <div class="fish-size">體型：${fish.size.toFixed(1)} %</div>
        <div class="fish-value">💰：${fish.finalPrice} G</div>
      </div>
    `;
    handleFishCardEvents(card, fish);
    grid.appendChild(card);
  }
  inventory.appendChild(grid);
}

/** 從裝備列表中隨機抽取一個裝備 */
function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

/** 隨機取得裝備稀有度（依據定義的機率） */
function getRandomRarity() {
  const rand = Math.random() * 100;
  let sum = 0;
  for (const entry of RARITY_PROBABILITIES) {
    sum += entry.chance;
    if (rand < sum) {
      return RARITY_TABLE.find((r) => r.label === entry.rarity);
    }
  }
  return RARITY_TABLE.find(
    (r) =>
      r.label === RARITY_PROBABILITIES[RARITY_PROBABILITIES.length - 1].rarity
  );
}

/** 隨機生成指定數量的 Buff */
function generateBuffs(count) {
  const shuffled = [...BUFF_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((buff) => ({
    type: buff.type,
    label: buff.label,
    value: getBuffValue(buff.type),
  }));
}

/** 根據 Buff 類型產生對應範圍的隨機值 */
function getBuffValue(type) {
  switch (type) {
    case "increaseCatchRate":
      return randomInt(1, 20);
    case "increaseRareRate":
      return randomInt(1, 30);
    case "increaseBigFishChance":
      return randomInt(1, 20);
    case "increaseSellValue":
      return randomInt(1, 7);
    case "increaseExpGain":
      return randomInt(1, 6);
    default:
      return 1;
  }
}

/** 取得 [min, max] 範圍內的隨機整數 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 顯示取得裝備的彈出卡片 Modal */
function showEquipmentGetModal(equip) {
  const card = document.getElementById("equipmentGetCard");
  card.innerHTML = `
    <div class="equipment-top">
      <img src="${equip.image}" alt="裝備圖示" class="equipment-icon" />
      <div class="equipment-name">${getEquipDisplayName(equip)}</div>
    </div>
    <ul class="equipment-buffs">
      ${equip.buffs.map((b) => `<li>${getBuffDisplay(b)}</li>`).join("")}
    </ul>
  `;
  const modal = new bootstrap.Modal(
    document.getElementById("equipmentGetModal")
  );
  modal.show();
}

/** 保存新獲得的裝備到擁有清單 */
function saveToOwnedEquipment(item) {
  const list = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  list.push(item);
  localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(list));
  updateOwnedEquipListUI();
}

/** 更新擁有裝備清單的 UI 列表 */
function updateOwnedEquipListUI() {
  const container = document.getElementById("ownedEquipList");
  if (!container) return;
  const owned = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  container.innerHTML = "";
  // 取得當前篩選條件
  const selectedType =
    document.getElementById("equipTypeFilter")?.value || "all";
  // 過濾裝備類型
  const filtered = owned.filter((e) => {
    if (selectedType === "all") return true;
    if (selectedType === "other") {
      return (
        e.type !== "rod" &&
        e.type !== "bait" &&
        e.type !== "hat" &&
        e.type !== "outfit" &&
        e.type !== "shoes"
      );
    }
    return e.type === selectedType;
  });
  for (const equip of filtered) {
    const card = document.createElement("div");
    card.className = "equipment-card";
    const isFav = equip.isFavorite ? "❤️" : "🤍";
    // 決定 Buff 顯示內容
    const buffList = equip.buffs
      .map((buff) => {
        if (buff.type === "note") return `<li>${buff.label}</li>`;
        return `<li>${buff.label} +${buff.value}%</li>`;
      })
      .join("");
    card.innerHTML = `
      <div class="equipment-top d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <img src="${equip.image}" alt="裝備圖示" class="equipment-icon" />
          <div class="equipment-name">${getEquipDisplayName(equip)}</div>
        </div>
        <button class="btn btn-sm btn-favorite" data-id="${
          equip.id
        }">${isFav}</button>
      </div>
      <ul class="equipment-buffs mt-2">
        ${buffList}
      </ul>
    `;
    container.appendChild(card);
    if (!equip.type.startsWith("ticket-")) {
      card.addEventListener("click", () => {
        selectedEquipForAction = equip;
        openEquipActionModal(equip);
      });
    }
    const favBtn = card.querySelector(".btn-favorite");
    favBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteEquip(equip.id);
    });
  }
}

/** 切換裝備的收藏狀態 */
function toggleFavoriteEquip(id) {
  const list = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  const target = list.find((e) => e.id === id);
  if (target) {
    target.isFavorite = !target.isFavorite;
    localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(list));
    updateOwnedEquipListUI();
  }
}

/** 打開裝備操作選單 Modal（裝備/精煉等） */
function openEquipActionModal(selectedEquip) {
  const modal = new bootstrap.Modal(
    document.getElementById("equipActionModal")
  );
  document.getElementById("refineBtn").onclick = () => {
    modal.hide();
    openRefineChoiceModal(selectedEquip);
  };
  const selectedCardHTML = generateEquipCardHTML(selectedEquip);
  document.getElementById("equipActionCard").innerHTML = selectedCardHTML;
  const equippedItem = getEquippedItemByType(selectedEquip.type);
  const equippedCardHTML = equippedItem
    ? generateEquipCardHTML(equippedItem)
    : `<div class="text-light">尚未裝備</div>`;
  document.getElementById("currentlyEquippedCard").innerHTML = equippedCardHTML;
  document.getElementById("equipBtn").onclick = () => {
    const isEquipLocked = localStorage.getItem("disable-equip") === "1";
    if (isEquipLocked) {
      showAlert("此地圖禁止更換裝備");
      return;
    }
    equipItem(selectedEquip);
    updateCharacterStats();
    modal.hide();
  };
  modal.show();
}

/** 生成裝備資訊卡片的 HTML */
function generateEquipCardHTML(equip) {
  const isFav = equip.isFavorite ? "❤️" : "🤍";
  return `
    <div class="equipment-card">
      <div class="equipment-top d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          <img src="${equip.image}" class="equipment-icon" />
          <div class="equipment-name">${getEquipDisplayName(equip)}</div>
        </div>
        <button class="btn btn-sm btn-favorite" data-id="${
          equip.id
        }">${isFav}</button>
      </div>
      <ul class="equipment-buffs mt-2">
        ${equip.buffs.map((b) => `<li>${getBuffDisplay(b)}</li>`).join("")}
      </ul>
    </div>
  `;
}

/** 取得指定類型欄位目前裝備的物品 */
function getEquippedItemByType(type) {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  return equipped[type] || null;
}

/** 更新角色的裝備屬性加成顯示 */
function updateCharacterStats() {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  let stats = {
    increaseCatchRate: 0,
    increaseRareRate: 0,
    increaseBigFishChance: 0,
    increaseSellValue: 0,
    increaseExpGain: 0,
  };
  for (const slot in equipped) {
    const item = equipped[slot];
    if (!item || !item.buffs) continue;
    for (const buff of item.buffs) {
      if (stats.hasOwnProperty(buff.type)) {
        stats[buff.type] += buff.value;
      }
    }
  }
  // 動態取得等級加成
  const level = loadLevel();
  const levelBuff = level * 0.25;
  document.querySelector(".increase-catch-rate").textContent = `增加上鉤率：${(
    stats.increaseCatchRate + levelBuff
  ).toFixed(2)}%`;
  document.querySelector(".increase-rare-rate").textContent = `增加稀有率：${(
    stats.increaseRareRate + levelBuff
  ).toFixed(2)}%`;
  document.querySelector(
    ".increase-big-fish-chance"
  ).textContent = `大體型機率：${(
    stats.increaseBigFishChance + levelBuff
  ).toFixed(2)}%`;
  document.querySelector(".increase-sellValue").textContent = `增加販售金額：${(
    stats.increaseSellValue + levelBuff
  ).toFixed(2)}%`;
  document.querySelector(".increase-exp-gain").textContent = `經驗值加成：${(
    stats.increaseExpGain + levelBuff
  ).toFixed(2)}%`;
}

document.querySelector(".cencel-equip-btn").addEventListener("click", () => {
  const isEquipLocked = localStorage.getItem("disable-equip") === "1";
  if (isEquipLocked) {
    showAlert("此地圖禁止更換裝備");
    return;
  }
  if (!selectedEquippedSlot) return;
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  const owned = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  const item = equipped[selectedEquippedSlot];
  if (!item) return;
  // 移除裝備並放回背包
  delete equipped[selectedEquippedSlot];
  owned.push(item);
  // 更新本地存儲
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(equipped));
  localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(owned));
  // 更新畫面
  updateEquippedUI();
  updateOwnedEquipListUI();
  updateCharacterStats();
  // 關閉裝備資訊 Modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("equipInfoModal")
  );
  if (modal) modal.hide();
  // 清除狀態
  selectedEquippedSlot = null;
});

/** 點擊裝備欄位顯示該裝備資訊 Modal */
document.querySelectorAll(".slot").forEach((slotDiv) => {
  slotDiv.addEventListener("click", () => {
    const slotKey = slotDiv.dataset.slot;
    const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
    const item = equipped[slotKey];
    if (item) {
      selectedEquippedSlot = slotKey;
      const isFav = item.isFavorite ? "❤️" : "🤍";
      const modalBody = document.getElementById("equipInfoBody");
      modalBody.innerHTML = `
        <div class="equipment-card">
          <div class="equipment-top d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <img src="${item.image}" class="equipment-icon" alt="${
        item.name
      }" />
              <div class="equipment-name">${getEquipDisplayName(item)}</div>
            </div>
            <div class="equipment-fav">${isFav}</div>
          </div>
          <ul class="equipment-buffs mt-2">
            ${item.buffs
              .map((buff) => `<li>${buff.label} +${buff.value}%</li>`)
              .join("")}
          </ul>
        </div>
      `;
      const modal = new bootstrap.Modal(
        document.getElementById("equipInfoModal")
      );
      modal.show();
    }
  });
});

/** 計算所有已裝備 Buff 的總加成（含等級加成） */
function getTotalBuffs() {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  const buffs = {
    increaseCatchRate: 0,
    increaseRareRate: 0,
    increaseBigFishChance: 0,
    increaseSellValue: 0,
    increaseExpGain: 0,
  };
  for (const item of Object.values(equipped)) {
    if (!item?.buffs) continue;
    for (const buff of item.buffs) {
      if (buffs.hasOwnProperty(buff.type)) {
        buffs[buff.type] += buff.value;
      }
    }
  }
  // 加入等級加成並取一位小數
  const level = loadLevel();
  const levelBuff = level * 0.25;
  for (const key in buffs) {
    buffs[key] += levelBuff;
    buffs[key] = Math.round(buffs[key] * 10) / 10;
  }
  buffs.increaseCatchRate = Math.min(buffs.increaseCatchRate, 99);
  return buffs;
}

// 魚圖鑑資料初始化（佔位操作，實際圖鑑在 Modal 開啟時更新）
fishTypes.forEach((fishType) => {
  const records = backpack.filter((f) => f.name === fishType.name);
  if (records.length === 0) return;
});

/** 取得已發現的魚種名稱列表 */
function getDiscoveredFishNames() {
  return [...new Set(backpack.map((f) => f.name))];
}

/** 根據選擇的篩選條件渲染魚類圖鑑 */
function renderFishBook() {
  const grid = document.getElementById("fishBookGrid");
  grid.innerHTML = "";
  const selectedRarity =
    document.getElementById("rarityFilter")?.value || "all";
  const selectedMap = document.getElementById("mapFilter")?.value || "all";
  const dex = loadFishDex();
  const discoveredNames = dex.map((d) => d.name);
  const mapName = selectedMap === "all" ? null : MAP_CONFIG[selectedMap].name;
  // 篩選該地圖出現的魚種列表
  const filteredFishTypes = allFishTypes.filter(
    (fish) => !mapName || (fish.maps || []).includes(mapName)
  );
  // 計算該地圖中已被發現的魚種數量
  const filteredDiscoveredCount = filteredFishTypes.filter((fish) =>
    discoveredNames.includes(fish.name)
  ).length;
  // 顯示圖鑑收集進度 (已發現/總數)
  document.getElementById(
    "fishBookProgress"
  ).textContent = `(${filteredDiscoveredCount}/${filteredFishTypes.length})`;
  for (const fishType of allFishTypes) {
    const data = dex.find((d) => d.name === fishType.name);
    if (!data) continue;
    const matchesRarity =
      selectedRarity === "all" || data.rarity === `rarity-${selectedRarity}`;
    const matchesMap =
      selectedMap === "all" ||
      (fishType.maps || []).includes(MAP_CONFIG[selectedMap].name);
    if (!matchesRarity || !matchesMap) continue;
    const card = document.createElement("div");
    card.className = `fish-card book-card ${data.rarity}`;
    card.innerHTML = `
      <img src="${fishType.image}" class="fish-icon2" alt="${fishType.name}">
      <div class="fish-info">
        <div class="fish-name2">${fishType.name}</div>
        <div class="fish-text">最大尺寸：${data.maxSize.toFixed(1)} %</div>
        <div class="fish-text">最高售價：${data.maxPrice} G</div>
        <div class="fish-text">首次釣到：${new Date(
          data.firstCaught
        ).toLocaleDateString()}</div>
        <div class="fish-text">出沒地圖：${(fishType.maps || []).join(
          "、"
        )}</div>
      </div>
    `;
    grid.appendChild(card);
  }
}

/** 載入本地存儲的魚圖鑑資料 */
function loadFishDex() {
  return JSON.parse(localStorage.getItem(FISH_DEX_KEY) || "[]");
}

/** 保存魚圖鑑資料到本地存儲 */
function saveFishDex(dexList) {
  localStorage.setItem(FISH_DEX_KEY, JSON.stringify(dexList));
}

/** 更新魚圖鑑資料（新增或更新記錄） */
function updateFishDex(fish) {
  const dex = JSON.parse(localStorage.getItem(FISH_DEX_KEY) || "[]");
  const existing = dex.find((d) => d.name === fish.name);
  const fishType = fishTypes.find((f) => f.name === fish.name);
  const rarity = getRarityClass(fishType.rawProbability);
  const maps = fishType.maps || "未知";
  if (!existing) {
    dex.push({
      name: fish.name,
      maxSize: fish.size,
      maxPrice: fish.finalPrice,
      firstCaught: fish.caughtAt,
      rarity: rarity,
      maps: maps,
    });
  } else {
    existing.maxSize = Math.max(existing.maxSize, fish.size);
    existing.maxPrice = Math.max(existing.maxPrice, fish.finalPrice);
    existing.firstCaught =
      new Date(fish.caughtAt) < new Date(existing.firstCaught)
        ? fish.caughtAt
        : existing.firstCaught;
    existing.rarity = rarity;
    existing.maps = maps;
  }
  localStorage.setItem(FISH_DEX_KEY, JSON.stringify(dex));
}

// 高級寶箱設定
const HIGH_TIER_RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 83.5 },
  { rarity: "高級", chance: 15 },
  { rarity: "稀有", chance: 1.5 },
];

/** 隨機生成高級寶箱對應數量的 Buff */
function generateHighTierBuffs(count) {
  const shuffled = [...BUFF_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((buff) => ({
    type: buff.type,
    label: buff.label,
    value: getHighTierBuffValue(buff.type),
  }));
}

/** 根據 Buff 類型產生高級範圍的隨機值 */
function getHighTierBuffValue(type) {
  switch (type) {
    case "increaseCatchRate":
      return randomInt(1, 40);
    case "increaseRareRate":
      return randomInt(1, 60);
    case "increaseBigFishChance":
      return randomInt(1, 40);
    case "increaseSellValue":
      return randomInt(1, 20);
    case "increaseExpGain":
      return randomInt(1, 12);
    default:
      return 1;
  }
}

/** 開啟寶箱並取得隨機裝備 */
function openChest(cost, getRarityFn, generateBuffsFn) {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  if (currentMoney < cost) return;
  localStorage.setItem("fishing-money", (currentMoney - cost).toString());
  updateMoneyUI();
  fetch("item.json")
    .then((res) => res.json())
    .then((items) => {
      const item = getRandomItem(items);
      const rarity = getRarityFn();
      const buffs = generateBuffsFn(rarity.buffCount);
      const newEquip = {
        id: crypto.randomUUID(),
        name: item.name,
        image: item.image,
        type: item.type,
        rarity: rarity.key,
        buffs: buffs,
        isFavorite: false,
        refineLevel: 0,
      };
      saveToOwnedEquipment(newEquip);
      showEquipmentGetModal(newEquip);
    });
}

// 綁定寶箱按鈕事件
document.querySelector(".chest1").addEventListener("click", () => {
  openChest(NORMAL_CHEST_COST, getRandomRarity, generateBuffs);
});
document.querySelector(".chest2").addEventListener("click", () => {
  openChest(HIGH_CHEST_COST, getHighTierRarity, generateHighTierBuffs);
});

/** 隨機取得高級寶箱的裝備稀有度 */
function getHighTierRarity() {
  const rand = Math.random() * 100;
  let sum = 0;
  for (const entry of HIGH_TIER_RARITY_PROBABILITIES) {
    sum += entry.chance;
    if (rand < sum) {
      return RARITY_TABLE.find((r) => r.label === entry.rarity);
    }
  }
  return RARITY_TABLE[RARITY_TABLE.length - 1];
}

/** 從本地存儲載入玩家等級 */
function loadLevel() {
  return parseInt(localStorage.getItem(LEVEL_KEY) || "1", 10);
}

/** 從本地存儲載入玩家經驗值 */
function loadExp() {
  return parseInt(localStorage.getItem(EXP_KEY) || "0", 10);
}

/** 保存玩家等級至本地存儲 */
function saveLevel(level) {
  localStorage.setItem(LEVEL_KEY, level.toString());
}

/** 保存玩家經驗值至本地存儲 */
function saveExp(exp) {
  localStorage.setItem(EXP_KEY, exp.toString());
}

/** 計算指定等級所需的經驗值 */
function getExpForLevel(level) {
  const growth = Math.pow(1.05, level - 1);
  if (level <= 40) return Math.floor(1400 * growth);
  if (level <= 80) return Math.floor(1800 * growth);
  return Math.floor(800 * growth);
}

/** 增加經驗值並檢查升級 */
function addExp(gained) {
  const buffs = getTotalBuffs();
  const expBonus = Math.floor(gained * (buffs.increaseExpGain / 100));
  let exp = loadExp() + gained + expBonus;
  let level = loadLevel();
  let required = getExpForLevel(level);
  while (exp >= required) {
    exp -= required;
    level++;
    required = getExpForLevel(level);
    // 顯示升級提示
    showLevelUpModal(level);
    updateCharacterStats();
  }
  saveLevel(level);
  saveExp(exp);
  updateLevelUI();
}

/** 更新等級和經驗值的顯示 UI */
function updateLevelUI() {
  const level = loadLevel();
  const exp = loadExp();
  const required = getExpForLevel(level);
  const percent = ((exp / required) * 100).toFixed(2);
  document.querySelector(".level").textContent = `等級: ${level}`;
  document.querySelector(".exp").textContent = `經驗值: ${percent}%`;
}

/** 進入地圖，載入魚種資料並更新畫面 */
function proceedToMap(config, mapKey) {
  currentMapKey = mapKey;
  currentMapConfig = config;
  localStorage.setItem("disable-equip", config.disableEquip ? "1" : "0");
  fetch(config.json)
    .then((res) => res.json())
    .then((data) => {
      fishTypes = assignPriceByProbability(
        normalizeFishProbabilities(data),
        config
      );
      updateBackground(config.background);
      document.getElementById(
        "currentMapDisplay"
      ).textContent = `目前地圖：${config.name}`;
      updateBackpackUI?.();
      playMapMusic(config.music);
    });
}

/** 顯示升級效果的提示 */
function showLevelUpModal(level) {
  const el = document.createElement("div");
  el.className = "level-up-toast";
  el.textContent = `Lv.${level} 升級了！`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 3000);
    }, 3500);
  }, 10);
}

// 每秒檢查是否超過通行證時間
setInterval(() => {
  const config = MAP_CONFIG[currentMapKey];
  const timerEl = document.getElementById("ticketTimer");
  if (!config?.ticketDurationMs || !timerEl) {
    if (timerEl) timerEl.style.display = "none";
    return;
  }
  const entryTime = parseInt(
    localStorage.getItem(`map-entry-${currentMapKey}`) || "0",
    10
  );
  if (!entryTime) {
    timerEl.style.display = "none";
    return;
  }
  const now = Date.now();
  const remainingMs = config.ticketDurationMs - (now - entryTime);
  if (remainingMs <= 0) {
    timerEl.style.display = "none";
    showAlert("通行證已過期，已返回清澈川流");
    switchMap("map1");
  } else {
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    timerEl.textContent = `通行證剩餘 ${mins}:${secs
      .toString()
      .padStart(2, "0")}`;
    timerEl.style.display = "block";
  }
}, 1000);

// 每30秒自動保存進度（需登入）
setInterval(() => {
  if (auth.currentUser) {
    autoSaveToCloud();
  }
}, 30000);

/** 自訂確認對話框（Modal），返回使用者選擇的結果 */
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = new bootstrap.Modal(
      document.getElementById("customConfirmModal")
    );
    document.getElementById("customConfirmMessage").textContent = message;
    const okBtn = document.getElementById("customConfirmOK");
    const cancelBtn = document.getElementById("customConfirmCancel");
    const cleanup = () => {
      okBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    okBtn.onclick = () => {
      cleanup();
      modal.hide();
      resolve(true);
    };
    cancelBtn.onclick = () => {
      cleanup();
      modal.hide();
      resolve(false);
    };
    modal.show();
  });
}

/** 將購買的通行證加入裝備清單 */
function addTicketToInventory(ticketType) {
  const owned = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  let name = "";
  let buffLabel = "";
  let image = "";
  if (ticketType === "ticket-map2") {
    name = "機械通行證";
    buffLabel = "機械城河通關所需證明";
    image = "images-webp/shop/ticket1.webp";
  } else if (ticketType === "ticket-map3") {
    name = "黃金通行證";
    buffLabel = "黃金遺址通關所需證明";
    image = "images-webp/shop/ticket2.webp";
  } else if (ticketType === "ticket-map4") {
    name = "魔法通行證";
    buffLabel = "劍與魔法村通關所需證明";
    image = "images-webp/shop/ticket3.webp";
  } else {
    console.warn("未知的 ticketType：", ticketType);
    return;
  }
  const item = {
    id: crypto.randomUUID(),
    name,
    image,
    type: ticketType,
    rarity: "common",
    buffs: [
      {
        type: "note",
        label: buffLabel,
        value: 0,
      },
    ],
    isFavorite: true,
  };
  owned.push(item);
  localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(owned));
  updateOwnedEquipListUI();
  showAlert(`獲得 ${name}！`);
}

/** 播放指定地圖的背景音樂 */
function playMapMusic(musicPath, forcePlay = false) {
  if (currentBgm) {
    currentBgm.pause();
    currentBgm.currentTime = 0;
  }
  currentBgm = new Audio(musicPath);
  currentBgm.loop = true;
  currentBgm.volume = 0.5;
  currentBgm.muted = isMuted;
  const icon = document.getElementById("bgmIcon");
  if (userHasInteractedWithBgm || forcePlay) {
    currentBgm
      .play()
      .then(() => {
        icon.src = "images-webp/icons/voice.webp";
      })
      .catch(() => {
        icon.src = "images-webp/icons/voice2.webp";
      });
  } else {
    icon.src = "images-webp/icons/voice2.webp";
  }
}

/** 更新提煉結晶的 UI 顯示 */
function updateCrystalUI() {
  const count = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
  const el = document.getElementById("crystalCount");
  if (el) {
    el.textContent = `${count} 顆`;
  }
  const el2 = document.getElementById("refineCrystalDisplay");
  if (el2) {
    el2.textContent = `提煉結晶：${count} 個`;
  }
}

/** 打開精煉方式選擇 Modal */
function openRefineChoiceModal(equip) {
  const modal = new bootstrap.Modal(
    document.getElementById("refineChoiceModal")
  );
  modal.show();
  // 綁定選項按鈕行為
  document.getElementById("refineForgeBtn").onclick = () => {
    modal.hide();
    openRefineModal(equip);
  };
  document.getElementById("refineDivineBtn").onclick = () => {
    modal.hide();
    openDivineModal(equip);
  };
}

/** 打開鍛造精煉 Modal，顯示裝備資訊 */
function openRefineModal(equip) {
  selectedEquipForAction = equip;
  const modal = new bootstrap.Modal(
    document.getElementById("refineEquipModal")
  );
  modal.show();
  const refineLevel = equip.refineLevel ?? 0;
  const cost = (refineLevel + 2) * 2;
  const ownedRaw = parseInt(localStorage.getItem(CRYSTAL_KEY), 10);
  const owned = isNaN(ownedRaw) ? 0 : ownedRaw;
  const buffIncrements = [0, 5, 5, 5, 7, 8, 10, 10, 15];
  const previewIncrease = buffIncrements[refineLevel + 1];
  document.getElementById("refineEquipCard").innerHTML =
    generateEquipCardHTML(equip);
  document.getElementById(
    "refineLevelInfo"
  ).textContent = `目前等級：+${refineLevel}`;
  if (previewIncrease !== undefined) {
    document.getElementById(
      "refineBuffPreview"
    ).textContent = `效果：隨機 Buff 提升 ${previewIncrease}%`;
    document.getElementById(
      "refineCrystalCost"
    ).textContent = `消耗提煉結晶：${cost} 顆`;
  } else {
    document.getElementById("refineBuffPreview").textContent = `效果：-`;
    document.getElementById(
      "refineCrystalCost"
    ).textContent = `消耗提煉結晶：-`;
  }
  document.getElementById(
    "refineCrystalOwned"
  ).textContent = `目前擁有：${owned} 顆`;
  const successRates = [1.0, 0.85, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1];
  const currentRate = successRates[refineLevel] ?? 0;
  document.getElementById(
    "refineSuccessRate"
  ).textContent = `成功率：${Math.round(currentRate * 100)}%`;
  document.getElementById("confirmRefineBtn").onclick = () =>
    refineEquipment(equip);
}

/** 執行裝備精煉的邏輯 */
function refineEquipment(equip) {
  if (!equip || !equip.buffs || equip.buffs.length === 0) {
    showAlert("此裝備無 buff，無法精煉！");
    return;
  }
  const refineLevel = equip.refineLevel ?? 0;
  if (refineLevel >= 8) {
    showAlert("已達精煉上限！");
    return;
  }
  const cost = (refineLevel + 2) * 2;
  let crystals = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
  if (crystals < cost) {
    showAlert(`提煉需要 ${cost} 顆提煉結晶，目前只有 ${crystals}`);
    return;
  }
  // 扣除結晶
  crystals -= cost;
  localStorage.setItem(CRYSTAL_KEY, crystals.toString());
  // 計算精煉成功或失敗
  const successRates = [1.0, 0.85, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1];
  const chance = successRates[refineLevel];
  const success = Math.random() < chance;
  if (success) {
    equip.refineLevel++;
    const index = Math.floor(Math.random() * equip.buffs.length);
    // 每級增加的屬性數值
    const buffIncrements = [0, 5, 5, 5, 7, 8, 10, 10, 15]; // 索引對應精煉等級
    const increase = buffIncrements[equip.refineLevel] ?? 5;
    equip.buffs[index].value += increase;
    // （可選提示：精煉成功/失敗，這裡已移除彈窗避免打斷流程）
  } else {
    // （失敗不提升等級，不提示）
  }
  // 儲存裝備變更並更新相關 UI
  const owned = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  const idx = owned.findIndex((e) => e.id === equip.id);
  if (idx !== -1) owned[idx] = equip;
  localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(owned));
  updateOwnedEquipListUI();
  updateCrystalUI?.();
  updateCharacterStats?.();
  // 更新精煉裝備卡片內容
  const card = document.getElementById("refineEquipCard");
  if (card) {
    card.innerHTML = generateEquipCardHTML(equip);
    const actualCard = card.querySelector(".equipment-card");
    if (actualCard) {
      actualCard.classList.remove("forge-success", "forge-fail");
      void actualCard.offsetWidth;
      actualCard.classList.add(success ? "forge-success" : "forge-fail");
    }
  }
  // 更新精煉資訊顯示
  const levelInfo = document.getElementById("refineLevelInfo");
  if (levelInfo) {
    levelInfo.textContent = `目前等級：+${equip.refineLevel}`;
  }
  const costInfo = document.getElementById("refineCrystalCost");
  if (costInfo) {
    const nextCost = (equip.refineLevel + 2) * 2;
    costInfo.textContent = `消耗提煉結晶：${nextCost} 顆`;
  }
  const buffIncrements = [0, 5, 5, 5, 7, 8, 10, 10, 15];
  const previewIncrease = buffIncrements[equip.refineLevel + 1] ?? 0;
  const buffPreview = document.getElementById("refineBuffPreview");
  if (buffPreview) {
    if (previewIncrease !== undefined) {
      buffPreview.textContent = `效果：隨機 Buff 提升 ${previewIncrease}%`;
    } else {
      buffPreview.textContent = `效果：-`;
    }
  }
  const rateInfo = document.getElementById("refineSuccessRate");
  if (rateInfo) {
    const successRates2 = [1.0, 0.85, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1];
    const currentRate = successRates2[equip.refineLevel] ?? 0;
    rateInfo.textContent = `成功率：${Math.round(currentRate * 100)}%`;
  }
  updateCrystalUI();
  const refineCrystalInfo = document.getElementById("refineCrystalOwned");
  if (refineCrystalInfo) {
    const current = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
    refineCrystalInfo.textContent = `目前擁有：${current} 顆`;
  }
}

/** 取得 Buff 的顯示文字 */
function getBuffDisplay(buff) {
  const label = buffLabelMap[buff.type] || buff.type;
  return `${label} +${buff.value}%`;
}

/** 修正舊版本裝備資料（補充缺失屬性） */
function patchLegacyEquipments() {
  const owned = JSON.parse(localStorage.getItem(OWNED_EQUIPMENT_KEY) || "[]");
  let changed = false;
  for (const equip of owned) {
    if (equip.refineLevel == null) {
      equip.refineLevel = 0;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(OWNED_EQUIPMENT_KEY, JSON.stringify(owned));
  }
}

/** 取得裝備顯示名稱（附加精煉等級） */
function getEquipDisplayName(equip) {
  const level = equip.refineLevel ?? 0;
  return level > 0 ? `${equip.name} +${level}` : equip.name;
}

/** 打開裝備神化 Modal，顯示所需材料 */
function openDivineModal(equip) {
  selectedEquipForAction = equip;
  const reqs = {
    隕石碎片: { count: 1, icon: "images-webp/icons/ore2.webp" },
    黃銅礦: { count: 1, icon: "images-webp/icons/ore3.webp" },
    核廢料: { count: 1, icon: "images-webp/icons/ore4.webp" },
  };
  // 動態更新神化材料需求清單 UI
  const listHtml = Object.entries(reqs)
    .map(([name, { count, icon }]) => {
      const owned = loadDivineMaterials()[name] || 0;
      return `
        <div class="d-flex align-items-center gap-2 mb-1">
          <img src="${icon}" width="30" height="30" alt="${name}" />
          <span class="god-name">${name}：${owned}/${count}</span>
        </div>
      `;
    })
    .join("");
  document.getElementById("divineEquipCard").innerHTML =
    generateEquipCardHTML(equip);
  document.getElementById("divineMaterialReqs").innerHTML = listHtml;
  const modal = new bootstrap.Modal(document.getElementById("divineModal"));
  modal.show();
  document.getElementById("confirmDivineBtn").onclick = async () => {
    const freshMaterials = loadDivineMaterials();
    // 檢查材料是否足夠
    const allEnough = Object.entries(reqs).every(
      ([name, { count }]) => (freshMaterials[name] || 0) >= count
    );
    if (!allEnough) return showAlert("材料不足，無法神化");
    // 扣除材料
    for (const [name, { count }] of Object.entries(reqs)) {
      freshMaterials[name] -= count;
    }
    saveDivineMaterials(freshMaterials);
    // 原始名稱 → 神裝名稱對照
    const convertMap = {
      普通釣竿: "天神釣竿",
      蚯蚓: "天神餌",
      漁夫帽: "天神盔",
      防風外套: "天神鎧",
      長靴: "天神靴",
      魔劍釣竿: "天神釣竿",
      魔法小蝦: "天神餌",
      魔法帽: "天神盔",
      魔法長袍: "天神鎧",
      魔法長靴: "天神靴",
      金屬釣竿: "天神釣竿",
      金屬餌: "天神餌",
      金屬頭盔: "天神盔",
      金屬盔甲: "天神鎧",
      金屬鞋: "天神靴",
      黃金釣竿: "天神釣竿",
      黃金: "天神餌",
      黃金帽: "天神盔",
      黃金外套: "天神鎧",
      黃金拖鞋: "天神靴",
    };
    const newName = convertMap[equip.name];
    if (!newName) return showAlert("此裝備無法神化");
    // 從 god.json 讀取神化裝備模板資料
    const res = await fetch("god.json");
    const itemList = await res.json();
    const divineTemplate = itemList.find((i) => i.name === newName);
    if (!divineTemplate) return showAlert(`找不到神化裝備資料：${newName}`);
    // 建立新的神化裝備物件
    const newEquip = {
      ...divineTemplate,
      id: crypto.randomUUID(),
      refineLevel: equip.refineLevel ?? 0,
      buffs: equip.buffs,
      isFavorite: equip.isFavorite ?? false,
    };
    // 用新神裝替換原裝備
    let owned = loadOwnedEquipments();
    owned = owned.filter((e) => e.id !== equip.id);
    owned.push(newEquip);
    saveOwnedEquipments(owned);
    updateOwnedEquipListUI();
    updateCharacterStats?.();
    updateDivineUI?.();
    showAlert(`✨ 神化成功！你獲得了${newName}`);
    modal.hide();
  };
}

// 綁定裝備篩選下拉選單事件
document
  .getElementById("equipTypeFilter")
  ?.addEventListener("change", updateOwnedEquipListUI);
document.getElementById("openTutorial").addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById("tutorialModal"));
  modal.show();
});

// （移除重複的 refineBtn 全域綁定，統一在 openEquipActionModal 中處理）

document.getElementById("bgmToggleBtn").addEventListener("click", () => {
  userHasInteractedWithBgm = true;
  if (!currentBgm && currentMapConfig?.music) {
    isMuted = false;
    playMapMusic(currentMapConfig.music, true);
    return;
  }
  isMuted = !isMuted;
  if (currentBgm) {
    currentBgm.muted = isMuted;
    if (!isMuted && currentBgm.paused) {
      currentBgm.play().catch((e) => console.warn("播放失敗", e));
    }
    const icon = document.getElementById("bgmIcon");
    icon.src = isMuted
      ? "images-webp/icons/voice2.webp"
      : "images-webp/icons/voice.webp";
  }
});

/** 購買地圖通行證（入場券）並執行相關操作 */
function buyTicket(ticketType, price) {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  if (currentMoney < price) return showAlert("金錢不足！");
  localStorage.setItem("fishing-money", (currentMoney - price).toString());
  updateMoneyUI();
  addTicketToInventory(ticketType);
}

// 綁定通行證購買按鈕事件
document.getElementById("buyMap4Ticket").addEventListener("click", () => {
  buyTicket("ticket-map4", TICKET1_PRICE);
});
document.getElementById("buyMap2Ticket").addEventListener("click", () => {
  buyTicket("ticket-map2", TICKET2_PRICE);
});
document.getElementById("buyMap3Ticket").addEventListener("click", () => {
  buyTicket("ticket-map3", TICKET3_PRICE);
});

document
  .getElementById("dismantleAllBtn")
  .addEventListener("click", async () => {
    const confirmed = await customConfirm("你確定要拆解所有未收藏的裝備嗎?");
    if (!confirmed) return;
    let list = loadOwnedEquipments();
    const beforeCount = list.length;
    const nonFavorite = list.filter((e) => !e.isFavorite);
    const gainedCrystals = nonFavorite.reduce((sum, item) => {
      const count = (item.buffs || []).filter((b) => b.type !== "note").length;
      return sum + count;
    }, 0);
    list = list.filter((e) => e.isFavorite);
    saveOwnedEquipments(list);
    // 更新結晶數量
    const oldCrystals = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
    localStorage.setItem(
      CRYSTAL_KEY,
      (oldCrystals + gainedCrystals).toString()
    );
    updateOwnedEquipListUI();
    showAlert(
      `已拆解 ${
        beforeCount - list.length
      } 件裝備，獲得 ${gainedCrystals} 顆提煉結晶！`
    );
    updateCrystalUI?.();
  });

document.getElementById("openMaps").addEventListener("click", () => {
  const functionMenu = bootstrap.Modal.getInstance(
    document.getElementById("functionMenuModal")
  );
  if (functionMenu) functionMenu.hide();
  new bootstrap.Modal(document.getElementById("mapSelectModal")).show();
});
document.getElementById("openFunctionMenu").addEventListener("click", () => {
  const modal = new bootstrap.Modal(
    document.getElementById("functionMenuModal")
  );
  modal.show();
});
document.getElementById("openFishBook").addEventListener("click", () => {
  const functionMenu = bootstrap.Modal.getInstance(
    document.getElementById("functionMenuModal")
  );
  if (functionMenu) functionMenu.hide();
  renderFishBook();
  new bootstrap.Modal(document.getElementById("fishBookModal")).show();
});
document
  .getElementById("rarityFilter")
  .addEventListener("change", renderFishBook);
document.getElementById("mapFilter").addEventListener("change", renderFishBook);
document.getElementById("openShop").addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById("shopModal"));
  modal.show();
});
document.getElementById("selectAllBtn").addEventListener("click", () => {
  for (const fish of backpack) {
    selectedFishIds.add(fish.id);
  }
  updateCardSelectionUI();
});
document.getElementById("multiSellBtn").addEventListener("click", () => {
  batchSellSelected();
  exitMultiSelectMode();
  enterMultiSelectMode();
});
document
  .getElementById("cancelMultiSelectBtn")
  .addEventListener("click", () => {
    exitMultiSelectMode();
    enterMultiSelectMode();
  });
document.getElementById("sortSelect").addEventListener("change", (e) => {
  currentSort = e.target.value;
  updateBackpackUI();
});
document.querySelectorAll(".fnc-anm").forEach((btn) => {
  btn.addEventListener("click", () => addClickBounce(btn));
});
document.getElementById("openEquip").addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById("equipModal"));
  modal.show();
  updateOwnedEquipListUI();
  updateEquippedUI();
  updateCharacterStats();
});

document.getElementById("dismantleBtn").addEventListener("click", () => {
  if (!selectedEquipForAction) return;
  if (selectedEquipForAction.isFavorite) {
    showAlert("此裝備已收藏");
    return;
  }
  // 計算該裝備可獲得的提煉結晶數量
  const gained = (selectedEquipForAction.buffs || []).filter(
    (b) => b.type !== "note"
  ).length;
  // 更新結晶數量
  const current = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
  localStorage.setItem(CRYSTAL_KEY, (current + gained).toString());
  // 移除裝備
  let owned = loadOwnedEquipments();
  owned = owned.filter((e) => e.id !== selectedEquipForAction.id);
  saveOwnedEquipments(owned);
  // 更新畫面
  updateOwnedEquipListUI();
  updateCrystalUI?.();
  // 關閉裝備操作 Modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("equipActionModal")
  );
  if (modal) modal.hide();
  // 清除選擇狀態
  selectedEquipForAction = null;
  showAlert(`已拆解裝備，獲得 ${gained} 顆提煉結晶！`);
  updateCrystalUI();
});

document
  .getElementById("confirmMultiSellResult")
  .addEventListener("click", () => {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("multiSellResultModal")
    );
    if (modal) modal.hide();
  });

window.addEventListener("DOMContentLoaded", async () => {
  switchMap("map1");
  updateMoneyUI();
  updateCrystalUI();
  patchLegacyEquipments();
  // 顯示版本資訊 Modal（若首次執行）
  const seenVersion = localStorage.getItem("seen-version");
  if (seenVersion !== GAME_VERSION) {
    const versionModal = new bootstrap.Modal(
      document.getElementById("versionModal")
    );
    versionModal.show();
    document
      .getElementById("versionConfirmBtn")
      .addEventListener("click", () => {
        localStorage.setItem("seen-version", GAME_VERSION);
        versionModal.hide();
      });
  }
  // 載入所有魚種資料（供圖鑑使用）
  await loadAllFishTypes();
  // 顯示當前登入的帳號資訊
  onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      const username = user.email.split("@")[0];
      const el = document.getElementById("accountDisplay");
      if (el) {
        el.textContent = `目前帳號：${username}`;
      }
    }
  });
});

// PWA 支援：註冊 Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("✅ Service Worker registered"))
    .catch((err) => console.error("SW registration failed:", err));
}

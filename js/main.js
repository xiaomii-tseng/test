// 📁 自動釣魚遊戲主邏輯

const GAME_VERSION = "2.6.0"; // 每次更新請手動更改版本號
const STORAGE_KEY = "fishing-v3-backpack";
const ownedEquipment = "owned-equipment-v2";
const EQUIPPED_KEY = "equipped-items-v2";
const FISH_DEX_KEY = "fish-dex-v2";
const LEVEL_KEY = "fishing-player-level-v1";
const EXP_KEY = "fishing-player-exp-v1";
const CRYSTAL_KEY = "refine-crystal";
const DIVINE_STORAGE_KEY = "divine-materials";
let backpack = loadBackpack();
let money = loadMoney();
let autoFishingInterval = null;
let selectedEquippedSlot = null;
let selectedEquipForAction = null;
let manualFishingTimeout = null;
let isAutoMode = true;
let isMultiSelectMode = false;
let currentSort = "asc";
let currentMapKey = "map1"; // 預設地圖
const chestCost = 6000; // 高級寶箱
const CHEST_COST = 1200; // 普通寶箱
const ticket1Price = 15000;
const ticket2Price = 35000;
const ticket3Price = 75000;
const selectedFishIds = new Set();
let fishTypes = [];
let allFishTypes = [];
let currentBgm = null;
let isMuted = false;
let userHasInteractedWithBgm = false;
let autoFishingIntervalId = null;
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
      name: data.name || "匿名", // 👈 加這行
      level: data.level || 1,
      money: data.money || 0,
      exp: data.exp || 0,
    });
  });
  return result;
}

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

    const topPlayers = await getTopPlayersByLevel(); // ← 你前面提供的 function
    const content = document.getElementById("leaderboardContent");
    content.innerHTML = topPlayers
      .map(
        (p, i) => `
          <div>${i + 1}. ${p.name} | Lv.${
          p.level
        } | 💰 ${p.money.toLocaleString()} G</div>
          `
      )
      .join("");

    new bootstrap.Modal(document.getElementById("leaderboardModal")).show();
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
function showAlert(message) {
  document.getElementById("customAlertContent").textContent = message;
  new bootstrap.Modal(document.getElementById("customAlertModal")).show();
}
function saveToCloud() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showAlert("請先登入");
      return;
    }

    const userId = user.uid;
    const username = user.email.split("@")[0]; // 👈 取 email 前綴
    const saveData = {
      backpack: JSON.parse(localStorage.getItem("fishing-v3-backpack") || "[]"),
      ownedEquipment: JSON.parse(
        localStorage.getItem("owned-equipment-v2") || "[]"
      ),
      equippedItems: JSON.parse(
        localStorage.getItem("equipped-items-v2") || "{}"
      ),
      fishDex: JSON.parse(localStorage.getItem("fish-dex-v2") || "[]"),
      level: parseInt(
        localStorage.getItem("fishing-player-level-v1") || "1",
        10
      ),
      exp: parseInt(localStorage.getItem("fishing-player-exp-v1") || "0", 10),
      money: parseInt(localStorage.getItem("fishing-money") || "0", 10),
      name: username, // ✅ 存帳號名稱
      refineCrystal: parseInt(
        localStorage.getItem("refine-crystal") || "0",
        10
      ),
      divineMaterials: JSON.parse(
        localStorage.getItem("divine-materials") || "{}"
      ),
    };

    try {
      await setDoc(doc(db, "saves", userId), saveData);
      showAlert("存檔成功！");
    } catch (err) {
      console.error("❌ 存檔失敗", err);
      showAlert("存檔失敗");
    }
  });
}

function autoSaveToCloud() {
  onAuthStateChanged(auth, async (user) => {
    const userId = user.uid;
    const username = user.email.split("@")[0]; // ← 補這行！

    const saveData = {
      backpack: JSON.parse(localStorage.getItem("fishing-v3-backpack") || "[]"),
      ownedEquipment: JSON.parse(
        localStorage.getItem("owned-equipment-v2") || "[]"
      ),
      equippedItems: JSON.parse(
        localStorage.getItem("equipped-items-v2") || "{}"
      ),
      fishDex: JSON.parse(localStorage.getItem("fish-dex-v2") || "[]"),
      level: parseInt(
        localStorage.getItem("fishing-player-level-v1") || "1",
        10
      ),
      exp: parseInt(localStorage.getItem("fishing-player-exp-v1") || "0", 10),
      money: parseInt(localStorage.getItem("fishing-money") || "0", 10),
      name: username,
    };

    try {
      await setDoc(doc(db, "saves", userId), saveData);
    } catch (err) {}
  });
}

// 更新圖鑑數量
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
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob)),
    rarePenalty: 1.0,
    catchRateModifier: 1.0, // 正常上鉤率
    name: "清澈川流",
    background: "images/index/index3.jpg",
    music: "sound/map1.mp3",
    autoFishingAllowed: true,
  },
  map4: {
    json: "fish4.json",
    baseValue: 200,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob)),
    rarePenalty: 1.1,
    catchRateModifier: 0.9,
    name: "劍與魔法村",
    background: "images/maps/map4.jpg",
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
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob)),
    rarePenalty: 1.2,
    catchRateModifier: 0.8, // 稍微難釣
    name: "機械城河",
    background: "images/maps/map2.jpg",
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
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob)),
    rarePenalty: 1.3,
    catchRateModifier: 0.7, // 較難上鉤
    name: "黃金遺址",
    background: "images/maps/map3.jpg",
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

// 🎣 讀取 fish.json 並開始自動釣魚
async function switchMap(mapKey) {
  const config = MAP_CONFIG[mapKey];
  if (!config) return showAlert("無此地圖");

  // 等級檢查
  const level = loadLevel();
  if (config.requiredLevel && level < config.requiredLevel) {
    return showAlert(`需要等級 ${config.requiredLevel} 才能進入`);
  }

  // 裝備檢查
  const equipped = JSON.parse(
    localStorage.getItem("equipped-items-v2") || "{}"
  );
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
        // ✅ 在有效時間內 → 允許進入，不再要求通行證
        proceedToMap(config, mapKey);
        return;
      }
    }
  }

  // 通行證檢查 + 提示 + 移除
  if (config.requiredTicketName) {
    let ownedEquipments = JSON.parse(
      localStorage.getItem("owned-equipment-v2") || "[]"
    );
    const index = ownedEquipments.findIndex(
      (e) => e.name === config.requiredTicketName
    );
    if (index === -1) {
      return showAlert(`缺少通行證：${config.requiredTicketName}`);
    }

    const confirm = await customConfirm(
      `即將消耗【${config.requiredTicketName}】，是否繼續？提醒: 此地圖無法更換裝備`
    );
    if (!confirm) return;

    // 移除通行證
    ownedEquipments.splice(index, 1);
    localStorage.setItem("owned-equipment-v2", JSON.stringify(ownedEquipments));
    localStorage.setItem(`map-entry-${mapKey}`, Date.now().toString());
  }

  // ✅ 清除舊地圖釣魚循環
  stopAutoFishing();
  clearTimeout(manualFishingTimeout);

  // ✅ 切換地圖
  proceedToMap(config, mapKey);

  // ✅ 僅在玩家選擇自動模式時啟動
  if (config.autoFishingAllowed && isAutoMode) {
    startAutoFishing();
  }
}

window.switchMap = switchMap;
function updateBackground(imagePath) {
  const wrapper = document.getElementById("backgroundWrapper");
  if (wrapper) {
    wrapper.style.backgroundImage = `url('${imagePath}')`;
  }
}

// 載入目前已裝備的資料
function loadEquippedItems() {
  return JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
}
function equipItem(item) {
  const equipped = loadEquippedItems();
  let owned = loadOwnedEquipments();

  // 1. 卸下原裝備 → 加回背包
  const prevEquipped = equipped[item.type];
  if (prevEquipped) {
    owned.push(prevEquipped);
  }

  // 2. 從背包移除要穿的新裝備（根據 id）
  owned = owned.filter((e) => e.id !== item.id);

  // 3. 設定新的裝備到該欄位
  equipped[item.type] = item;

  // 4. 儲存
  saveEquippedItems(equipped);
  saveOwnedEquipments(owned);

  // 5. 更新畫面
  updateEquippedUI();
  updateOwnedEquipListUI();
}

function loadOwnedEquipments() {
  return JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
}
function saveOwnedEquipments(data) {
  localStorage.setItem(ownedEquipment, JSON.stringify(data));
}

// 儲存裝備
function saveEquippedItems(data) {
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(data));
}

// 穿裝備
function updateEquippedUI() {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");

  document.querySelectorAll(".slot").forEach((slotEl) => {
    const type = slotEl.dataset.slot;
    const item = equipped[type];

    // 清空內容
    slotEl.innerHTML = "";

    if (item && item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.classList.add("equipped-icon"); // 可加 CSS 控制尺寸
      slotEl.appendChild(img);
    } else {
      // 顯示預設欄位名稱
      slotEl.textContent = getSlotLabel(type);
    }
  });
}

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

// 正規化魚的機率100%
function normalizeFishProbabilities(fishList) {
  const total = fishList.reduce((sum, f) => sum + f.probability, 0);
  return fishList.map((fish) => ({
    ...fish,
    probability: parseFloat(((fish.probability / total) * 100).toFixed(4)),
  }));
}
// UUID
function generateUUID() {
  return "xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
// 魚的卡片邊框
function getRarityClass(probability) {
  if (probability > 2) return "rarity-common"; // 普通：白色
  if (probability > 0.3) return "rarity-uncommon"; // 高級：藍色
  if (probability > 0.08) return "rarity-rare"; // 稀有：黃色
  if (probability > 0.04) return "rarity-epic"; // 史詩：紫色
  if (probability > 0.01) return "rarity-legend"; // 神話：紅色
  return "rarity-mythic"; // 傳奇：彩色邊框
}
// 🎯 精度條控制
let precisionInterval = null;
let pos = 0;
let direction = 1;
const speed = 5;
const intervalTime = 16;

function startPrecisionBar() {
  if (precisionInterval) return;
  document.getElementById("precisionBarContainer").style.display = "flex";
  const track = document.getElementById("precisionTrack");
  const indicator = document.getElementById("precisionIndicator");
  const trackWidth = track.clientWidth;
  const indicatorWidth = indicator.clientWidth;

  // 隨機起始位置與方向 👇
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

// 釣魚資訊
function logCatchCard(fishObj, fishType) {
  const bottomInfo = document.getElementById("bottomInfo");
  if (!bottomInfo) return;

  bottomInfo.innerHTML = ""; // 清空
  bottomInfo.className = "bottom-info show"; // 重設 class

  if (fishType && fishObj) {
    const card = document.createElement("div");
    card.className = "fish-card big-card";

    // 🪄 加上稀有度 class
    const rarityClass = getRarityClass(fishType.probability);
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
// 多選與單選的function
function enterMultiSelectMode() {
  isMultiSelectMode = true;
  selectedFishIds.clear();
  document.getElementById("multiSelectActions").style.display = "flex";
  updateBackpackUI();
}
function toggleFishSelection(id) {
  if (selectedFishIds.has(id)) {
    selectedFishIds.delete(id);
  } else {
    selectedFishIds.add(id);
  }
  updateCardSelectionUI();
}
function updateCardSelectionUI() {
  document.querySelectorAll(".fish-card").forEach((card) => {
    const id = card.dataset.id;
    card.classList.toggle("selected", selectedFishIds.has(id));
  });
}
// 多選與單選
function handleFishCardEvents(cardEl, fishObj) {
  cardEl.addEventListener("click", () => {
    if (isMultiSelectMode) {
      toggleFishSelection(fishObj.id);
      updateCardSelectionUI();
    }
  });
}
function exitMultiSelectMode() {
  isMultiSelectMode = false;
  selectedFishIds.clear();
  document.getElementById("multiSelectActions").style.display = "none";
  updateBackpackUI();
}

function batchSellSelected() {
  if (selectedFishIds.size === 0) return; // ⛔ 若沒選取，直接不處理

  const buffs = getTotalBuffs();
  let rawTotal = 0;
  let finalTotal = 0;

  // 統計價格與刪除背包內的魚
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

  // 更新資料
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  const newMoney = currentMoney + finalTotal;
  localStorage.setItem("fishing-money", newMoney);
  updateMoneyUI();
  saveBackpack();
  updateBackpackUI();
  updateMoneyUI();
  exitMultiSelectMode();

  // 顯示結果 Modal
  document.getElementById("rawTotal").textContent = rawTotal.toLocaleString();
  document.getElementById("bonusTotal").textContent = (
    finalTotal - rawTotal
  ).toLocaleString();
  document.getElementById("finalTotal").textContent =
    finalTotal.toLocaleString();
  new bootstrap.Modal(document.getElementById("multiSellResultModal")).show();
}

function logCatch(message) {
  const bottomInfo = document.getElementById("bottomInfo");
  if (bottomInfo) {
    bottomInfo.textContent = message;
    bottomInfo.classList.add("show");

    // 清除先前計時器（避免多次觸發）
    clearTimeout(bottomInfo._hideTimer);
    bottomInfo._hideTimer = setTimeout(() => {
      bottomInfo.classList.remove("show");
    }, 3000);
  }
}
document
  .getElementById("precisionStopBtn")
  .addEventListener("click", stopPrecisionBar);

// 關閉指示器
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

// 計算魚的價值
function assignPriceByProbability(fishList, mapConfig) {
  return fishList.map((fish) => ({
    ...fish,
    price: mapConfig.priceFormula(fish.probability, mapConfig.baseValue),
  }));
}

// 👜 點擊背包按鈕打開 Modal
const openBackpackBtn = document.getElementById("openBackpack");
if (openBackpackBtn) {
  openBackpackBtn.addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("backpackModal"));
    modal.show();

    // 新增這兩行 👇
    enterMultiSelectMode();
  });
}

// 🔁 模式切換邏輯
const toggleBtn = document.getElementById("toggleModeBtn");
const fishingStatus = document.getElementById("fishingStatus");
// 初始化狀態
if (fishingStatus) {
  fishingStatus.textContent = isAutoMode ? "自動釣魚中..." : "機率加成中...";
}
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    isAutoMode = !isAutoMode;
    toggleBtn.textContent = isAutoMode
      ? "點擊進入手動模式"
      : "點擊進入自動模式";
    // 🐟 更新狀態提示文字
    if (fishingStatus) {
      fishingStatus.textContent = isAutoMode
        ? "自動釣魚中..."
        : "機率加成中...";
    }
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
// 關閉精度條
function hidePrecisionBar() {
  clearInterval(precisionInterval);
  precisionInterval = null;
  const container = document.getElementById("precisionBarContainer");
  if (container) container.style.display = "none";
}
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
function getRandomAutoFishingDelay() {
  // return 15000 + Math.random() * 5000;
  return 4500;
}
function doFishing() {
  // 自動釣魚固定機率（例如 50% 成功）
  const successRate = 0.75;

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
// ⏳ 自動釣魚主迴圈
function startAutoFishing() {
  if (autoFishingTimeoutId !== null) return; // 防止重複啟動
  isAutoFishing = true;
  const scheduleNext = () => {
    if (!isAutoFishing || !currentMapConfig) return;
    doFishing(false); // 執行一次釣魚
    autoFishingTimeoutId = setTimeout(
      scheduleNext,
      getRandomAutoFishingDelay()
    );
  };
  // 初始延遲觸發第一次釣魚
  autoFishingTimeoutId = setTimeout(scheduleNext, getRandomAutoFishingDelay());
}

function stopAutoFishing() {
  isAutoFishing = false;
  if (autoFishingTimeoutId !== null) {
    clearTimeout(autoFishingTimeoutId);
    autoFishingTimeoutId = null;
  }
}

// 手動釣魚增加稀有度
function getWeightedFishByPrecision(precisionRatio) {
  // 建立一個新的魚池，加權機率會隨 precisionRatio 提升而往稀有魚偏移
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

// 🎯 機率抽魚
function getRandomFish() {
  const total = fishTypes.reduce((sum, f) => sum + f.probability, 0);
  const rand = Math.random() * total;
  let sum = 0;
  for (let f of fishTypes) {
    sum += f.probability;
    if (rand < sum) return f;
  }
}

// 打包卡片資訊
function createFishInstance(fishType) {
  // 隨機產生體型並四捨五入至小數點一位
  const size = parseFloat((Math.random() * 100).toFixed(1));
  // 根據體型計算最終價格（最高增加35%）
  const buffs = getTotalBuffs();
  const bigFishBonus = 1 + buffs.increaseBigFishChance / 600;
  const adjustedSize = Math.min(size * bigFishBonus, 100); // 限制不超過100%

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

// 🧳 新增魚到背包並保存
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
// 神話道具存本地
function loadDivineMaterials() {
  return JSON.parse(localStorage.getItem(DIVINE_STORAGE_KEY) || "{}");
}
function saveDivineMaterials(materials) {
  localStorage.setItem(DIVINE_STORAGE_KEY, JSON.stringify(materials));
}
// 神話道具
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
  updateDivineUI?.(); // 若有 UI 更新函數就呼叫
}
function updateDivineUI() {
  const materials = loadDivineMaterials();
  const container = document.getElementById("divineItemList");
  if (!container) return;

  const items = Object.entries(materials)
    .map(([name, count]) => `<div>${name} x ${count}</div>`)
    .join("");

  container.innerHTML = items || "(目前尚未收集)";
}
// 💾 LocalStorage 儲存 & 載入
function saveBackpack() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backpack));
}
function loadBackpack() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}
function updateMoneyUI() {
  const el = document.getElementById("coinCount");
  if (el)
    el.textContent = parseInt(
      localStorage.getItem("fishing-money") || "0",
      10
    ).toLocaleString();
}
function saveMoney() {
  localStorage.setItem("fishing-money", money);
}
function loadMoney() {
  return parseInt(localStorage.getItem("fishing-money") || "0", 10);
}

// 📦 更新背包畫面
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

  // ✨ 排序處理
  let entries = [...backpack];
  if (currentSort) {
    entries.sort((a, b) => {
      const priceA = a.finalPrice || 0;
      const priceB = b.finalPrice || 0;
      return currentSort === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  // 🔁 建立卡片（用排序後的 entries）
  for (const fish of entries) {
    const fishType = allFishTypes.find((f) => f.name === fish.name);
    if (!fishType) continue;

    const rarityClass = getRarityClass(fishType.probability);
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

// 抽寶箱
const BUFF_TYPES = [
  { type: "increaseCatchRate", label: "增加上鉤率" },
  { type: "increaseRareRate", label: "增加稀有率" },
  { type: "increaseBigFishChance", label: "大體型魚機率" },
  { type: "increaseSellValue", label: "增加販售金額" },
  { type: "increaseExpGain", label: "經驗獲得加成" },
];

const RARITY_TABLE = [
  { key: "common", label: "普通", buffCount: 1 },
  { key: "uncommon", label: "高級", buffCount: 2 },
  { key: "rare", label: "稀有", buffCount: 3 },
];

const RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 83.5 },
  { rarity: "高級", chance: 15 },
  { rarity: "稀有", chance: 1.5 },
];

document.querySelector(".shop-chest").addEventListener("click", () => {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < CHEST_COST) {
    return;
  }

  // 扣錢
  const updatedMoney = currentMoney - CHEST_COST;
  localStorage.setItem("fishing-money", updatedMoney.toString());
  updateMoneyUI(); // 若有即時更新顯示金額的 function

  // 正常抽裝備
  fetch("item.json")
    .then((res) => res.json())
    .then((items) => {
      const item = getRandomItem(items);
      const rarity = getRandomRarity();
      const buffs = generateBuffs(rarity.buffCount);

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
});

// 從 item.json 抽一個
function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

// 隨機稀有度（可機率控制）
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

// 給對應數量 buff
function generateBuffs(count) {
  const shuffled = [...BUFF_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((buff) => ({
    type: buff.type,
    label: buff.label,
    value: getBuffValue(buff.type),
  }));
}

// 可根據 buff 類型定義不同範圍
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

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 跳出卡片
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

// 儲存到 localStorage
function saveToOwnedEquipment(item) {
  const list = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  list.push(item);
  localStorage.setItem(ownedEquipment, JSON.stringify(list));
  updateOwnedEquipListUI();
}
function updateOwnedEquipListUI() {
  const container = document.getElementById("ownedEquipList");
  if (!container) return;

  const owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  container.innerHTML = "";

  for (const equip of owned) {
    const card = document.createElement("div");
    card.className = "equipment-card";

    const isFav = equip.isFavorite ? "❤️" : "🤍";

    // 🔧 決定 buff 顯示方式
    const buffList = equip.buffs
      .map((buff) => {
        // 如果是備註型（如通行證），就只顯示 label，不顯示 +x%
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

    // 🧭 通行證不開啟 modal（避免誤操作）
    if (!equip.type.startsWith("ticket-")) {
      card.addEventListener("click", () => {
        selectedEquipForAction = equip;
        openEquipActionModal(equip);
      });
    }

    // ❤️ 愛心收藏功能（仍可用）
    const favBtn = card.querySelector(".btn-favorite");
    favBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteEquip(equip.id);
    });
  }
}

// 愛心
function toggleFavoriteEquip(id) {
  const list = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  const target = list.find((e) => e.id === id);
  if (target) {
    target.isFavorite = !target.isFavorite;
    localStorage.setItem(ownedEquipment, JSON.stringify(list));
    updateOwnedEquipListUI();
  }
}

// 選取的裝備
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

// 顯示裝備能力
function generateEquipCardHTML(equip) {
  const isFav = equip.isFavorite ? "❤️" : "🤍";

  return `
    <div class="equipment-card">
      <div class="equipment-top d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          <img src="${equip.image}" class="equipment-icon" />
          <div class="equipment-name">${getEquipDisplayName(equip)}</div>
        </div>
        <button class="btn btn-sm btn-favorite" data-id="${equip.id}">
          ${isFav}
        </button>
      </div>
      <ul class="equipment-buffs mt-2">
        ${equip.buffs.map((b) => `<li>${getBuffDisplay(b)}</li>`).join("")}
      </ul>
    </div>
  `;
}

// 取得穿戴的裝備
function getEquippedItemByType(type) {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  return equipped[type] || null;
}

// 取得裝備數值
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

  // ✅ 動態取得最新等級加成
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

// 脫下裝備
document.querySelector(".cencel-equip-btn").addEventListener("click", () => {
  const isEquipLocked = localStorage.getItem("disable-equip") === "1";
  if (isEquipLocked) {
    showAlert("此地圖禁止更換裝備");
    return;
  }
  if (!selectedEquippedSlot) return;

  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  const owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");

  const item = equipped[selectedEquippedSlot];
  if (!item) return;

  // 移除裝備並放回背包
  delete equipped[selectedEquippedSlot];
  owned.push(item);

  // 更新 localStorage
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(equipped));
  localStorage.setItem(ownedEquipment, JSON.stringify(owned));

  // 更新畫面
  updateEquippedUI();
  updateOwnedEquipListUI();
  updateCharacterStats();

  // 關閉 Modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("equipInfoModal")
  );
  if (modal) modal.hide();

  // 清除狀態
  selectedEquippedSlot = null;
});

// 顯示當前裝備資訊
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

// buff實裝
function getTotalBuffs() {
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");

  const buffs = {
    increaseCatchRate: 0,
    increaseRareRate: 0,
    increaseBigFishChance: 0,
    increaseSellValue: 0,
    increaseExpGain: 0, // ✅ 新增
  };

  for (const item of Object.values(equipped)) {
    if (!item?.buffs) continue;
    for (const buff of item.buffs) {
      if (buffs.hasOwnProperty(buff.type)) {
        buffs[buff.type] += buff.value;
      }
    }
  }

  // ✅ 加入等級加成
  const level = loadLevel();
  const levelBuff = level * 0.25;
  for (const key in buffs) {
    buffs[key] += levelBuff;
    buffs[key] = Math.round(buffs[key] * 10) / 10;
  }
  buffs.increaseCatchRate = Math.min(buffs.increaseCatchRate, 99);
  return buffs;
}

// 魚圖鑑
fishTypes.forEach((fishType) => {
  const records = backpack.filter((f) => f.name === fishType.name);
  if (records.length === 0) return;
});
function getDiscoveredFishNames() {
  return [...new Set(backpack.map((f) => f.name))];
}
function renderFishBook() {
  const grid = document.getElementById("fishBookGrid");
  grid.innerHTML = "";

  const selectedRarity =
    document.getElementById("rarityFilter")?.value || "all";
  const selectedMap = document.getElementById("mapFilter")?.value || "all";
  const dex = loadFishDex();
  const discoveredNames = dex.map((d) => d.name);
  const total = allFishTypes.length;

  document.getElementById(
    "fishBookProgress"
  ).textContent = `(${discoveredNames.length}/${total})`;

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

function loadFishDex() {
  return JSON.parse(localStorage.getItem(FISH_DEX_KEY) || "[]");
}
function saveFishDex(dexList) {
  localStorage.setItem(FISH_DEX_KEY, JSON.stringify(dexList));
}
function updateFishDex(fish) {
  const dex = JSON.parse(localStorage.getItem(FISH_DEX_KEY) || "[]");
  const existing = dex.find((d) => d.name === fish.name);
  const fishType = fishTypes.find((f) => f.name === fish.name);

  const rarity = getRarityClass(fishType.probability);
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
    existing.rarity = rarity; // 確保更新稀有度（若機率資料更新）
    existing.maps = maps; // ✅ 加入/更新 maps 欄位
  }

  localStorage.setItem(FISH_DEX_KEY, JSON.stringify(dex));
}

// 新增高級寶箱
const HIGH_TIER_RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 83.5 },
  { rarity: "高級", chance: 15 },
  { rarity: "稀有", chance: 1.5 },
];
function generateHighTierBuffs(count) {
  const shuffled = [...BUFF_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((buff) => ({
    type: buff.type,
    label: buff.label,
    value: getHighTierBuffValue(buff.type),
  }));
}

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

document.querySelector(".chest2").addEventListener("click", () => {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < chestCost) return;

  localStorage.setItem("fishing-money", (currentMoney - chestCost).toString());
  updateMoneyUI();

  fetch("item.json")
    .then((res) => res.json())
    .then((items) => {
      const item = getRandomItem(items);
      const rarity = getHighTierRarity(); // ✅ 高級寶箱專用稀有度機率
      const buffs = generateHighTierBuffs(rarity.buffCount); // ✅ 高級寶箱專用 buff 數值

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
});
function getHighTierRarity() {
  const rand = Math.random() * 100;
  let sum = 0;
  for (const entry of HIGH_TIER_RARITY_PROBABILITIES) {
    sum += entry.chance;
    if (rand < sum) {
      return RARITY_TABLE.find((r) => r.label === entry.rarity);
    }
  }
  return RARITY_TABLE[RARITY_TABLE.length - 1]; // 預設 fallback
}

// 等級系統
function loadLevel() {
  return parseInt(localStorage.getItem(LEVEL_KEY) || "1", 10);
}
function loadExp() {
  return parseInt(localStorage.getItem(EXP_KEY) || "0", 10);
}
function saveLevel(level) {
  localStorage.setItem(LEVEL_KEY, level.toString());
}
function saveExp(exp) {
  localStorage.setItem(EXP_KEY, exp.toString());
}
function getExpForLevel(level) {
  return Math.floor(1300 * Math.pow(1.06, level - 1));
}
// 加經驗並檢查升等
addExp(rawTotal);
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
    // 可選：彈窗提示升級
    showLevelUpModal(level);
    updateCharacterStats();
  }

  saveLevel(level);
  saveExp(exp);
  updateLevelUI();
}
function updateLevelUI() {
  const level = loadLevel();
  const exp = loadExp();
  const required = getExpForLevel(level);
  const percent = ((exp / required) * 100).toFixed(2);

  document.querySelector(".level").textContent = `等級: ${level}`;
  document.querySelector(".exp").textContent = `經驗值: ${percent}%`;
}
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
// ⏱ 每10秒檢查是否超過通行證時間
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

setInterval(() => {
  if (auth.currentUser) {
    autoSaveToCloud();
  }
}, 30000);

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

// 入場券
function addTicketToInventory(ticketType) {
  const owned = JSON.parse(localStorage.getItem("owned-equipment-v2") || "[]");

  let name = "";
  let buffLabel = "";
  let image = "";

  if (ticketType === "ticket-map2") {
    name = "機械通行證";
    buffLabel = "機械城河通關所需證明";
    image = "images/shop/ticket1.png";
  } else if (ticketType === "ticket-map3") {
    name = "黃金通行證";
    buffLabel = "黃金遺址通關所需證明";
    image = "images/shop/ticket2.png";
  } else if (ticketType === "ticket-map4") {
    name = "魔法通行證";
    buffLabel = "劍與魔法村通關所需證明";
    image = "images/shop/ticket3.png"; // ⬅ 你自己準備好圖
  } else {
    console.warn("未知 ticketType：", ticketType);
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
  localStorage.setItem("owned-equipment-v2", JSON.stringify(owned));
  updateOwnedEquipListUI();
  showAlert(`獲得 ${name}！`);
}

// 音樂
function playMapMusic(musicPath) {
  if (currentBgm) {
    currentBgm.pause();
    currentBgm.currentTime = 0;
  }

  currentBgm = new Audio(musicPath);
  currentBgm.loop = true;
  currentBgm.volume = 0.5;
  currentBgm.muted = isMuted;

  // ⛔ 只有使用者手動開啟過音樂才播放
  if (userHasInteractedWithBgm) {
    currentBgm.play().catch((e) => {
      console.warn("音樂播放失敗：", e);
    });
  }
}
// 更新結晶
// 更新結晶
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

// 選擇提煉方式
function openRefineChoiceModal(equip) {
  const modal = new bootstrap.Modal(
    document.getElementById("refineChoiceModal")
  );
  modal.show();

  // 綁定兩個選項按鈕的行為
  document.getElementById("refineForgeBtn").onclick = () => {
    modal.hide();
    openRefineModal(equip); // 你之前寫的鍛造 modal
  };

  document.getElementById("refineDivineBtn").onclick = () => {
    modal.hide();
    openDivineModal(equip);
  };
}
// 打開鍛造
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

  const buffIncrements = [0, 4, 5, 6, 7, 8, 10, 10, 15];
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
  const successRates = [1.0, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
  const currentRate = successRates[refineLevel] ?? 0;
  document.getElementById(
    "refineSuccessRate"
  ).textContent = `成功率：${Math.round(currentRate * 100)}%`;
  document.getElementById("confirmRefineBtn").onclick = () =>
    refineEquipment(equip);
}

// 精煉邏輯
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

  // 扣結晶
  crystals -= cost;
  localStorage.setItem(CRYSTAL_KEY, crystals);

  // 成功率表
  const successRates = [1.0, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
  const chance = successRates[refineLevel];
  const success = Math.random() < chance;

  if (success) {
    equip.refineLevel++;
    const index = Math.floor(Math.random() * equip.buffs.length);

    // 每級增加的數值表
    const buffIncrements = [0, 4, 5, 6, 7, 8, 10, 10, 15]; // index = refineLevel
    const increase = buffIncrements[equip.refineLevel] ?? 5; // fallback: default +5

    equip.buffs[index].value += increase;

    // showAlert(
    //   `✅ 精煉成功！${
    //     buffLabelMap[equip.buffs[index].type]
    //   } 增加了 ${increase}%`
    // );
  } else {
    // showAlert("❌ 精煉失敗，裝備等級未提升");
  }

  // 儲存與更新
  const owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  const idx = owned.findIndex((e) => e.id === equip.id);
  if (idx !== -1) owned[idx] = equip;
  localStorage.setItem(ownedEquipment, JSON.stringify(owned));

  updateOwnedEquipListUI();
  updateCrystalUI?.();
  updateCharacterStats?.();

  // 更新裝備卡內容
  const card = document.getElementById("refineEquipCard");
  if (card) {
    card.innerHTML = generateEquipCardHTML(equip);

    // ✅ 插入內容後，再選到最外層卡片本體
    const actualCard = card.querySelector(".equipment-card");

    if (actualCard) {
      actualCard.classList.remove("forge-success", "forge-fail");
      void actualCard.offsetWidth; // 強制重播動畫
      actualCard.classList.add(success ? "forge-success" : "forge-fail");
    }
  }

  // 更新精煉資訊
  const levelInfo = document.getElementById("refineLevelInfo");
  if (levelInfo) {
    levelInfo.textContent = `目前等級：+${equip.refineLevel}`;
  }

  const costInfo = document.getElementById("refineCrystalCost");
  if (costInfo) {
    const nextCost = (equip.refineLevel + 2) * 2;
    costInfo.textContent = `消耗提煉結晶：${nextCost} 顆`;
  }
  const buffIncrements = [0, 4, 5, 6, 7, 8, 10, 10, 15];
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
    const successRates = [1.0, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
    const currentRate = successRates[equip.refineLevel] ?? 0;
    rateInfo.textContent = `成功率：${Math.round(currentRate * 100)}%`;
  }
  updateCrystalUI();
  const refineCrystalInfo = document.getElementById("refineCrystalOwned");
  if (refineCrystalInfo) {
    const current = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
    refineCrystalInfo.textContent = `目前擁有：${current} 顆`;
  }
}

function getBuffDisplay(buff) {
  const label = buffLabelMap[buff.type] || buff.type;
  return `${label} +${buff.value}%`;
}

function patchLegacyEquipments() {
  const owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  let changed = false;

  for (const equip of owned) {
    if (equip.refineLevel == null) {
      equip.refineLevel = 0;
      changed = true;
    }
  }

  if (changed) {
    localStorage.setItem(ownedEquipment, JSON.stringify(owned));
  }
}
function getEquipDisplayName(equip) {
  const level = equip.refineLevel ?? 0;
  return level > 0 ? `${equip.name} +${level}` : equip.name;
}

// 神化功能
function openDivineModal(equip) {
  selectedEquipForAction = equip;

  const reqs = {
    隕石碎片: { count: 1, icon: "images/icons/ore2.png" },
    黃銅礦: { count: 1, icon: "images/icons/ore3.png" },
    核廢料: { count: 1, icon: "images/icons/ore4.png" },
  };

  // ✅ 用即時資料顯示 UI
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

    const allEnough = Object.entries(reqs).every(
      ([name, { count }]) => (freshMaterials[name] || 0) >= count
    );
    if (!allEnough) return showAlert("材料不足，無法神化");

    // ✅ 扣材料
    for (const [name, { count }] of Object.entries(reqs)) {
      freshMaterials[name] -= count;
    }
    saveDivineMaterials(freshMaterials);

    // ✅ 對照表：原始名稱 → 神裝名稱
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

    // ✅ 從 item.json 讀神裝資料
    const res = await fetch("god.json");
    const itemList = await res.json();
    const divineTemplate = itemList.find((i) => i.name === newName);
    if (!divineTemplate) return showAlert(`找不到神化裝備資料：${newName}`);

    // ✅ 建立神化裝備
    const newEquip = {
      ...divineTemplate,
      id: crypto.randomUUID(),
      refineLevel: equip.refineLevel ?? 0,
      buffs: equip.buffs,
      isFavorite: equip.isFavorite ?? false,
    };

    // ✅ 替換裝備
    let owned = loadOwnedEquipments();
    owned = owned.filter((e) => e.id !== equip.id);
    owned.push(newEquip);
    saveOwnedEquipments(owned);

    updateOwnedEquipListUI();
    updateCharacterStats?.();
    updateDivineUI?.();

    showAlert(`✨ 神化成功！你獲得了【${newName}】`);
    modal.hide();
  };
}

// 下面是 document
document.getElementById("openTutorial").addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById("tutorialModal"));
  modal.show();
});
document.getElementById("refineBtn").onclick = () => {
  openRefineChoiceModal(selectedEquip);
};

document.getElementById("bgmToggleBtn").addEventListener("click", () => {
  const icon = document.getElementById("bgmIcon");
  userHasInteractedWithBgm = true;
  // 如果還沒建立音樂 → 表示是第一次播放
  if (!currentBgm && currentMapConfig?.music) {
    isMuted = false; // 撥第一首時預設不靜音
    playMapMusic(currentMapConfig.music);
    icon.src = "images/icons/voice.png";
    return;
  }

  // 有音樂時 → 切換靜音狀態
  isMuted = !isMuted;
  if (currentBgm) {
    currentBgm.muted = isMuted;
  }

  icon.src = isMuted ? "images/icons/voice2.png" : "images/icons/voice.png";
});

// 加入劍與魔法村入場券
document.getElementById("buyMap4Ticket").addEventListener("click", () => {
  const price = ticket1Price;
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < price) return showAlert("金錢不足！");
  localStorage.setItem("fishing-money", currentMoney - price);
  updateMoneyUI();
  addTicketToInventory("ticket-map4");
});

// 加入機械城河入場券
document.getElementById("buyMap2Ticket").addEventListener("click", () => {
  const price = ticket2Price;
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < price) return showAlert("金錢不足！");
  // if (hasTicketInInventory("ticket-map2"))
  //   return showAlert("你已擁有機械城河入場券");

  localStorage.setItem("fishing-money", currentMoney - price);
  updateMoneyUI();
  addTicketToInventory("ticket-map2");
});

// 加入黃金遺址入場券
document.getElementById("buyMap3Ticket").addEventListener("click", () => {
  const price = ticket3Price;
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < price) return showAlert("金錢不足！");
  // if (hasTicketInInventory("ticket-map3"))
  //   return showAlert("你已擁有黃金遺址入場券");

  localStorage.setItem("fishing-money", currentMoney - price);
  updateMoneyUI();
  addTicketToInventory("ticket-map3");
});

document
  .getElementById("dismantleAllBtn")
  .addEventListener("click", async () => {
    const confirmed = await customConfirm("你確定要拆解所有未收藏的裝備嗎?");
    if (!confirmed) return;

    let list = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");

    const nonFavorite = list.filter((e) => !e.isFavorite);
    const gainedCrystals = nonFavorite.reduce((sum, item) => {
      const count = (item.buffs || []).filter((b) => b.type !== "note").length;
      return sum + count;
    }, 0);

    const beforeCount = list.length;
    list = list.filter((e) => e.isFavorite);

    localStorage.setItem(ownedEquipment, JSON.stringify(list));

    // 更新結晶
    const oldCrystals = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
    localStorage.setItem(CRYSTAL_KEY, oldCrystals + gainedCrystals);

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
  if (functionMenu) {
    functionMenu.hide();
  }
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
  if (functionMenu) {
    functionMenu.hide();
  }
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

  // ⛏️ 計算這件裝備可獲得的提煉結晶
  const gained = (selectedEquipForAction.buffs || []).filter(
    (b) => b.type !== "note"
  ).length;

  // ⛏️ 更新結晶數量
  const current = parseInt(localStorage.getItem(CRYSTAL_KEY) || "0", 10);
  localStorage.setItem(CRYSTAL_KEY, current + gained);

  // 移除裝備
  let owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  owned = owned.filter((e) => e.id !== selectedEquipForAction.id);
  localStorage.setItem(ownedEquipment, JSON.stringify(owned));

  // 更新畫面
  updateOwnedEquipListUI();
  updateCrystalUI?.();

  // 關閉 Modal
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
  updateMoneyUI();
  updateCrystalUI();
  patchLegacyEquipments();
  // ✅ 顯示版本資訊 Modal（若沒看過）
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

  // ✅ 載入所有魚種（供圖鑑使用）
  await loadAllFishTypes();

  // ✅ 初始化地圖
  switchMap("map1");

  // ✅ 顯示登入帳號資訊
  const auth = getAuth();
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

// ✅ PWA 支援
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("✅ Service Worker registered"))
    .catch((err) => console.error("SW registration failed:", err));
}

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "../js/firebase.js";

const auth = getAuth();
const db = getFirestore(app);
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
// 📁 自動釣魚遊戲主邏輯

const GAME_VERSION = "2.6.0"; // 每次更新請手動更改版本號
let fishTypes = [];
const STORAGE_KEY = "fishing-v3-backpack";
const ownedEquipment = "owned-equipment-v2";
const EQUIPPED_KEY = "equipped-items-v2";
const FISH_DEX_KEY = "fish-dex-v2";
const LEVEL_KEY = "fishing-player-level-v1";
const EXP_KEY = "fishing-player-exp-v1";
let backpack = loadBackpack();
let autoFishingInterval = null;
let manualFishingTimeout = null;
let isAutoMode = true;
let money = loadMoney();
let currentSort = "asc";
let longPressTimer = null;
let isMultiSelectMode = false;
const selectedFishIds = new Set();
let selectedEquippedSlot = null;
let selectedEquipForAction = null;
let currentMapKey = "map1"; // 預設地圖
const caughtFishNames = [...new Set(backpack.map((f) => f.name))];
const MAP_CONFIG = {
  map1: {
    json: "fish.json",
    baseValue: 120,
    priceFormula: (prob, base) => Math.floor(base * (1 / prob)),
    rarePenalty: 1.0,
    catchRateModifier: 1.0, // 正常上鉤率
    name: "清澈川流",
    background: "images/index/index3.jpg",
  },
  map2: {
    json: "fish2.json",
    baseValue: 600,
    priceFormula: (prob, base) => Math.floor(base * Math.pow(1 / prob, 1.04)),
    rarePenalty: 2.0,
    catchRateModifier: 0.8, // 稍微難釣
    name: "機械城河",
    background: "images/maps/map2.jpg",
  },
  map3: {
    json: "fish3.json",
    baseValue: 3000,
    priceFormula: (prob, base) => Math.floor(base * Math.pow(1 / prob, 1.1)),
    rarePenalty: 3.0,
    catchRateModifier: 0.6, // 較難上鉤
    name: "黃金之地",
    background: "images/maps/map3.jpg",
  },
};
let currentMapConfig = MAP_CONFIG[currentMapKey];

// 🎣 讀取 fish.json 並開始自動釣魚
function switchMap(mapKey) {
  const config = MAP_CONFIG[mapKey];
  if (!config) return alert("無此地圖");

  currentMapKey = mapKey;
  currentMapConfig = config;

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
    });
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
  if (probability > 5) return "rarity-common"; // 普通：白色
  if (probability > 0.5) return "rarity-uncommon"; // 高級：藍色
  if (probability > 0.2) return "rarity-rare"; // 稀有：黃色
  if (probability > 0.1) return "rarity-epic"; // 史詩：紫色
  if (probability > 0.05) return "rarity-legend"; // 神話：紅色
  return "rarity-mythic"; // 傳奇：彩色邊框
}
// 🎯 精度條控制
let precisionInterval = null;
let pos = 0;
let direction = 1;
const speed = 6;
const intervalTime = 16;
function startPrecisionBar() {
  if (precisionInterval) return;
  pos = 0;
  direction = 1;
  document.getElementById("precisionBarContainer").style.display = "flex";
  const track = document.getElementById("precisionTrack");
  const indicator = document.getElementById("precisionIndicator");
  const trackWidth = track.clientWidth;
  const indicatorWidth = indicator.clientWidth;
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
    card.className = "fish-card";

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
    bottomInfo.textContent = "魚跑掉了...";
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

// ⏳ 自動釣魚主迴圈
function startAutoFishing() {
  if (autoFishingInterval) return;

  const loop = () => {
    const delay = Math.random() * (18000 - 10000) + 10000;
    autoFishingInterval = setTimeout(() => {
      const success = Math.random() < 0.5;
      if (success) {
        const fishType = getRandomFish();
        addFishToBackpack(fishType);
      } else {
        logCatch("魚跑掉了...");
      }
      loop();
    }, delay);
  };

  loop();
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

function stopAutoFishing() {
  clearTimeout(autoFishingInterval);
  autoFishingInterval = null;
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
  const bigFishBonus = 1 + buffs.increaseBigFishChance / 300;
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
    const fishType = fishTypes.find((f) => f.name === fish.name);
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
];

const RARITY_TABLE = [
  { key: "common", label: "普通", buffCount: 1 },
  { key: "uncommon", label: "高級", buffCount: 2 },
  { key: "rare", label: "稀有", buffCount: 3 },
];

const RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 94 },
  { rarity: "高級", chance: 5.5 },
  { rarity: "稀有", chance: 0.5 },
];
const CHEST_COST = 3000;

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
      <div class="equipment-name">${equip.name}</div>
    </div>
    <ul class="equipment-buffs">
      ${equip.buffs
        .map((buff) => `<li>${buff.label} +${buff.value}%</li>`)
        .join("")}
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

  container.innerHTML = ""; // 清空現有內容

  for (const equip of owned) {
    const card = document.createElement("div");
    card.className = "equipment-card";

    // 裝備卡片結構
    card.innerHTML = `
      <div class="equipment-top">
        <img src="${equip.image}" alt="裝備圖示" class="equipment-icon" />
        <div class="equipment-name">${equip.name}</div>
      </div>
      <ul class="equipment-buffs">
        ${equip.buffs
          .map((buff) => `<li>${buff.label} +${buff.value}%</li>`)
          .join("")}
      </ul>
    `;

    container.appendChild(card);
    card.addEventListener("click", () => {
      selectedEquipForAction = equip;
      openEquipActionModal(equip);
    });
  }
}

// 選取的裝備
function openEquipActionModal(selectedEquip) {
  const modal = new bootstrap.Modal(
    document.getElementById("equipActionModal")
  );

  const selectedCardHTML = generateEquipCardHTML(selectedEquip);
  document.getElementById("equipActionCard").innerHTML = selectedCardHTML;

  const equippedItem = getEquippedItemByType(selectedEquip.type);
  const equippedCardHTML = equippedItem
    ? generateEquipCardHTML(equippedItem)
    : `<div class="text-light">尚未裝備</div>`;
  document.getElementById("currentlyEquippedCard").innerHTML = equippedCardHTML;

  document.getElementById("equipBtn").onclick = () => {
    equipItem(selectedEquip); // 實作你自己的裝備邏輯
    updateCharacterStats();
    modal.hide();
  };

  modal.show();
}
function generateEquipCardHTML(equip) {
  return `
    <div class="equipment-card">
      <div class="equipment-top d-flex align-items-center gap-2">
        <img src="${equip.image}" class="equipment-icon" />
        <div class="equipment-name">${equip.name}</div>
      </div>
      <ul class="equipment-buffs mt-2">
        ${equip.buffs.map((b) => `<li>${b.label} +${b.value}%</li>`).join("")}
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

  // 初始化各屬性
  let stats = {
    increaseCatchRate: 0,
    increaseRareRate: 0,
    increaseBigFishChance: 0,
    increaseSellValue: 0,
  };

  // 累加各裝備的 buff
  for (const slot in equipped) {
    const item = equipped[slot];
    if (!item || !item.buffs) continue;

    for (const buff of item.buffs) {
      if (stats.hasOwnProperty(buff.type)) {
        stats[buff.type] += buff.value;
      }
    }
  }

  // 更新畫面
  document.querySelector(
    ".increase-catch-rate"
  ).textContent = `增加上鉤率：${stats.increaseCatchRate}%`;
  document.querySelector(
    ".increase-rare-rate"
  ).textContent = `增加稀有率：${stats.increaseRareRate}%`;
  document.querySelector(
    ".increase-big-fish-chance"
  ).textContent = `大體型機率：${stats.increaseBigFishChance}%`;
  document.querySelector(
    ".increase-sellValue"
  ).textContent = `增加販售金額：${stats.increaseSellValue}%`;
}

// 脫下裝備
document.querySelector(".cencel-equip-btn").addEventListener("click", () => {
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

      const modalBody = document.getElementById("equipInfoBody");
      modalBody.innerHTML = `
        <div class="equipment-card">
          <div class="equipment-top">
            <img src="${item.image}" class="equipment-icon" alt="${
        item.name
      }" />
            <div class="equipment-name">${item.name}</div>
          </div>
          <ul class="equipment-buffs">
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

  return Object.values(equipped).reduce(
    (buffs, item) => {
      if (!item.buffs) return buffs;
      for (const buff of item.buffs) {
        if (buffs.hasOwnProperty(buff.type)) {
          buffs[buff.type] += buff.value;
        }
      }
      return buffs;
    },
    {
      increaseCatchRate: 0,
      increaseRareRate: 0,
      increaseBigFishChance: 0,
      increaseSellValue: 0,
    }
  );
}

function forceCloseModal(modalId) {
  const modalEl = document.getElementById(modalId);
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) {
    modal.hide();
  }

  // 清理 backdrop 防卡死
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
  document.body.classList.remove("modal-open");
  document.body.style = "";
}

window.addEventListener("DOMContentLoaded", () => {
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
});

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
  const dex = loadFishDex();
  const discoveredNames = dex.map((d) => d.name);
  const total = fishTypes.length;

  document.getElementById(
    "fishBookProgress"
  ).textContent = `(${discoveredNames.length}/${total})`;

  for (const fishType of fishTypes) {
    const data = dex.find((d) => d.name === fishType.name);
    if (!data) continue;

    // ✨ 篩選稀有度
    if (selectedRarity !== "all" && data.rarity !== `rarity-${selectedRarity}`)
      continue;

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
  { rarity: "普通", chance: 94 },
  { rarity: "高級", chance: 5.5 },
  { rarity: "稀有", chance: 0.5 },
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
    default:
      return 1;
  }
}

document.querySelector(".chest2").addEventListener("click", () => {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  const chestCost = 30000; // 高級寶箱價格，可自由調整

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
  return Math.floor(500 * Math.pow(1.1, level - 1));
}
// 加經驗並檢查升等
addExp(rawTotal);
function addExp(gained) {
  let exp = loadExp() + gained;
  let level = loadLevel();
  let required = getExpForLevel(level);

  while (exp >= required) {
    exp -= required;
    level++;
    required = getExpForLevel(level);
    // 可選：彈窗提示升級
    showLevelUpModal(level);
  }

  saveLevel(level);
  saveExp(exp);
  updateLevelUI();
}
function updateLevelUI() {
  const level = loadLevel();
  const exp = loadExp();
  const required = getExpForLevel(level);
  const percent = ((exp / required) * 100).toFixed(1);

  document.querySelector(".level").textContent = `等級: ${level}`;
  document.querySelector(".exp").textContent = `經驗值: ${percent}%`;
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

// 下面是 document
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
  // 取得目前裝備列表
  let owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  // 根據 ID 過濾掉這件裝備
  owned = owned.filter((e) => e.id !== selectedEquipForAction.id);
  // 儲存回 localStorage
  localStorage.setItem(ownedEquipment, JSON.stringify(owned));
  // 更新畫面
  updateOwnedEquipListUI();
  // 關閉 modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("equipActionModal")
  );
  if (modal) modal.hide();
  // 清除選擇的裝備
  selectedEquipForAction = null;
});
document
  .getElementById("confirmMultiSellResult")
  .addEventListener("click", () => {
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("multiSellResultModal")
    );
    if (modal) modal.hide();
  });

window.addEventListener("DOMContentLoaded", () => {
  switchMap("map1"); // ✅ 一進來就切換到 map1
});

// ✅ PWA 支援
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then(() => console.log("✅ Service Worker registered"))
    .catch((err) => console.error("SW registration failed:", err));
}

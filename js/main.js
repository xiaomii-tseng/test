// 📁 自動釣魚遊戲主邏輯

const GAME_VERSION = "3.0.0"; // 每次更新請手動更改版本號
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
let selectedEquippedSlot = null;
let selectedEquipForAction = null;
let manualFishingTimeout = null;
let isAutoMode = true;
let isMultiSelectMode = false;
let currentSort = "desc";
let currentMapKey = "map1"; // 預設地圖
const chestCost = 30000; // 高級寶箱
const CHEST_COST = 2000; // 普通寶箱
const ticket1Price = 50000;
const ticket2Price = 125000;
const ticket3Price = 320000;
const selectedFishIds = new Set();
let fishTypes = [];
let allFishTypes = [];
let currentBgm = null;
let isMuted = true;
let userHasInteractedWithBgm = false;
let isSoundEnabled = false;
let isAutoFishing = false;
let autoFishingTimeoutId = null;
// 全域掉落表：每張地圖的附加掉落物
const GLOBAL_DROP_TABLE = {
  map1: [
    {
      name: "隕石碎片",
      icon: "images-webp/icons/ore2.webp",
      chance: 0.0005,
    },
  ],
  map4: [
    {
      name: "黃銅礦",
      icon: "images-webp/icons/ore3.webp",
      chance: 0.0005,
    },
  ],
  map2: [
    {
      name: "核廢料",
      icon: "images-webp/icons/ore4.webp",
      chance: 0.0005,
    },
  ],
};
const RARITY_HP_MULTIPLIERS = {
  "rarity-legendary": 1,
  "rarity-mythic": 2,
};
const buffLabelMap = {
  increaseCatchRate: "增加上鉤率",
  increaseRareRate: "增加稀有率",
  increaseBigFishChance: "大體型機率",
  increaseSellValue: "增加販售金額",
  increaseExpGain: "經驗值加成",
  multiCatchChance: "多魚成功率",
  multiCatchMultiplier: "多魚倍數提升",
};

// 音效
const sfxOpen = new Audio("sound/test-open.mp3");
sfxOpen.volume = 0.7;
const sfxClose = new Audio("sound/test-close.mp3");
sfxClose.volume = 0.4;
const sfxDoor = new Audio("sound/opendoor.mp3");
sfxDoor.volume = 0.6;
const sfxEquip = new Audio("sound/test-equip.mp3");
sfxEquip.volume = 0.6;
const sfxDelete = new Audio("sound/test-delete.mp3");
sfxDelete.volume = 0.6;
const sfxOpenFishBook = new Audio("sound/test-openfishbook.mp3");
sfxOpenFishBook.volume = 0.6;
const sfxFail = new Audio("sound/fail.mp3");
sfxFail.volume = 0.6;
const sfxSuccess = new Audio("sound/success.mp3");
sfxSuccess.volume = 0.8;
const sfxRefine = new Audio("sound/test-refine.mp3");
sfxRefine.volume = 0.5;
const sfxTicket = new Audio("sound/test-ticket.mp3");
sfxTicket.volume = 0.7;
const sfxOpenChest = new Audio("sound/openChest.mp3");
sfxOpenChest.volume = 0.7;
const sfxGod = new Audio("sound/god.mp3");
sfxGod.volume = 0.8;
const sfxToggle = new Audio("sound/test-toggle.mp3");
sfxToggle.volume = 0.7;
const sfxFishingClick = new Audio("sound/getFish.mp3");
sfxFishingClick.volume = 0.3;
const sfxClickPlus = new Audio("sound/plus.mp3");
sfxClickPlus.volume = 0.6;
const FishingLoopSound = {
  audio: new Audio("sound/loading.mp3"),
  play() {
    // ✅ 直接播放，不判斷 audioManager
    this.audio.loop = true;
    this.audio.volume = 0.2;
    this.audio.currentTime = 0;
    this.audio.play().catch(() => {});
  },
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  },
};
function preloadAllSfx() {
  const sfxList = [
    sfxOpen,
    sfxClose,
    sfxDoor,
    sfxEquip,
    sfxDelete,
    sfxOpenFishBook,
    sfxFail,
    sfxSuccess,
    sfxRefine,
    sfxTicket,
    sfxOpenChest,
    sfxGod,
    sfxToggle,
    sfxFishingClick,
    sfxClickPlus,
  ];
  sfxList.forEach(decodeAudioToBuffer);
}
const webAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBufferMap = new WeakMap();

// 把 <audio> 轉成 Web Audio buffer（一次轉好）
function decodeAudioToBuffer(audioEl) {
  if (audioBufferMap.has(audioEl)) return;

  fetch(audioEl.src)
    .then((res) => res.arrayBuffer())
    .then((buf) => webAudioCtx.decodeAudioData(buf))
    .then((decoded) => {
      audioBufferMap.set(audioEl, decoded);
    })
    .catch((err) => {
      console.warn("解碼音效失敗", audioEl.src, err);
    });
}
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  collection,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { app } from "./firebase.js";
import {
  loadAchievements,
  checkAchievements,
  claimAchievement,
  ACHIEVEMENT_DEFS,
  getAchievementStatusMap,
} from "./achievements.js";

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

// async function showLeaderboard() {
//   const topPlayers = await getTopPlayersByLevel();
//   const container = document.getElementById("leaderboardContent");
//   container.innerHTML = topPlayers
//     .map(
//       (p, i) => `
//     <div>${i + 1}. ${p.name} | Lv.${p.level}</div>
//   `
//     )
//     .join("");
//   new bootstrap.Modal(document.getElementById("leaderboardModal")).show();
// }

document
  .getElementById("openLeaderboard")
  .addEventListener("click", async () => {
    playSfx(sfxOpen);

    const functionMenu = bootstrap.Modal.getInstance(
      document.getElementById("functionMenuModal")
    );
    if (functionMenu) functionMenu.hide();

    const topPlayers = await getTopPlayersByLevel();
    const content = document.getElementById("leaderboardContent");

    content.innerHTML = topPlayers
      .map(
        (p, i) => `
        <div class="leaderboard-row">
          <div class="rank">#${i + 1}</div>
          <div class="name">${p.name}</div>
          <div class="level">Lv.${p.level}</div>
        </div>
      `
      )
      .join("");

    new bootstrap.Modal(document.getElementById("leaderboardModal")).show();
  });

document.getElementById("logoutBtn").addEventListener("click", () => {
  playSfx(sfxOpen);
  signOut(auth)
    .then(() => {
      showAlert("已登出！");
      localStorage.clear();
      window.location.href = "index.html"; // 登出後回登入頁面
    })
    .catch((error) => {
      console.error("登出失敗", error);
    });
});
document
  .getElementById("saveToCloudBtn")
  .addEventListener("click", async () => {
    playSfx(sfxOpen);
    saveToCloud();
  });
const alertQueue = [];
let alertShowing = false;

export function showAlert(message, isHtml = false) {
  alertQueue.push({ message, isHtml }); // 包成物件
  if (!alertShowing) processNextAlert();
}

export function processNextAlert() {
  if (alertQueue.length === 0) {
    alertShowing = false;
    return;
  }

  alertShowing = true;
  const { message, isHtml } = alertQueue.shift(); // 解構物件

  const modalEl = document.getElementById("customAlertModal");
  const modalContent = document.getElementById("customAlertContent");

  if (isHtml) {
    modalContent.innerHTML = message;
  } else {
    modalContent.textContent = message;
  }

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  modalEl.addEventListener(
    "hidden.bs.modal",
    () => {
      setTimeout(processNextAlert, 200);
    },
    { once: true }
  );
}

// 存檔區
function collectSaveData() {
  return {
    backpack: JSON.parse(localStorage.getItem("fishing-v3-backpack") || "[]"),
    ownedEquipment: JSON.parse(
      localStorage.getItem("owned-equipment-v2") || "[]"
    ),
    equippedItems: JSON.parse(
      localStorage.getItem("equipped-items-v2") || "{}"
    ),
    fishDex: JSON.parse(localStorage.getItem("fish-dex-v2") || "[]"),
    level: parseInt(localStorage.getItem("fishing-player-level-v1") || "1", 10),
    exp: parseInt(localStorage.getItem("fishing-player-exp-v1") || "0", 10),
    money: parseInt(localStorage.getItem("fishing-money") || "0", 10),
    refineCrystal: parseInt(localStorage.getItem("refine-crystal") || "0", 10),
    divineMaterials: JSON.parse(
      localStorage.getItem("divine-materials") || "{}"
    ),
    customBonus: JSON.parse(
      localStorage.getItem("player-custom-bonus") || "{}"
    ),
    statPoints: parseInt(localStorage.getItem("player-stat-points") || "0", 10),
    playerFishCount: parseInt(localStorage.getItem("player-fish-count") || "0"),
    mythicFishCount: parseInt(localStorage.getItem("mythic-fish-count") || "0"),
    playerChestCount: parseInt(
      localStorage.getItem("player-chest-count") || "0"
    ),
    playerAchievementPoints: parseInt(
      localStorage.getItem("player-achievement-points") || "0"
    ),
    playerCustomBonus: JSON.parse(
      localStorage.getItem("player-custom-bonus") || "{}"
    ),
    achievements: JSON.parse(
      localStorage.getItem("fishing-achievements-v1") || "{}"
    ),
  };
}
function saveToCloud() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showAlert("請先登入");
      return;
    }
    const userId = user.uid;
    const saveData = collectSaveData();
    try {
      await setDoc(doc(db, "saves", userId), saveData, { merge: true });
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
    const saveData = collectSaveData();
    try {
      await setDoc(doc(db, "saves", userId), saveData, { merge: true });
    } catch (err) {}
  });
}
window.addEventListener("DOMContentLoaded", async () => {
  // ✅ PWA 支援
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(() => console.log("✅ Service Worker registered"))
      .catch((err) => console.error("SW registration failed:", err));
  }

  preloadAllSfx();
  switchMap("map1");
  updateMoneyUI();
  updateCrystalUI();
  patchLegacyEquipments();
  loadSoundSetting();
  updateSoundToggleIcon();
  syncStatPointsWithLevel();
  await loadAchievements();
  // ✅ 直接顯示版本資訊 Modal（每次都顯示）
  const versionModal = new bootstrap.Modal(
    document.getElementById("versionModal")
  );
  versionModal.show();

  document.getElementById("versionConfirmBtn").addEventListener("click", () => {
    versionModal.hide();

    // ✅ 使用者互動後，播放音樂（解除瀏覽器限制）
    userHasInteractedWithBgm = true;
    isMuted = false;
    if (currentMapConfig?.music) {
      playMapMusic(currentMapConfig.music, true); // 加上 forcePlay 參數以保證播放
    }
  });

  // ✅ 載入所有魚種（供圖鑑使用）
  await loadAllFishTypes();

  // ✅ 顯示登入帳號資訊
  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "saves", user.uid);
      const userSnap = await getDoc(userRef);
      const playerName = userSnap.exists() ? userSnap.data().name : null;

      const el = document.getElementById("accountDisplay");
      if (el) {
        el.textContent = `玩家名稱：${playerName || "未知玩家"}`;
      }
    }
  });
});
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
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.0,
    catchRateModifier: 1.0, // 正常上鉤率
    multiCatcModifier: 1.0,
    bossHpModifier: 1.0,
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
    multiCatcModifier: 0.8,
    bossHpModifier: 1.25,
    name: "劍與魔法村",
    background: "images-webp/maps/map4.webp",
    requiredLevel: 50,
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
    multiCatcModifier: 0.55,
    bossHpModifier: 1.5,
    name: "機械城河",
    background: "images-webp/maps/map2.webp",
    requiredLevel: 100,
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
    music: "sound/map3.mp3",
    autoFishingAllowed: true,
  },
  map3: {
    json: "fish3.json",
    baseValue: 800,
    priceFormula: (prob, base) => Math.floor(base * Math.sqrt(1 / prob) * 2),
    rarePenalty: 1.3,
    catchRateModifier: 0.7, // 較難上鉤
    multiCatcModifier: 0.3,
    bossHpModifier: 1.75,
    name: "黃金遺址",
    background: "images-webp/maps/map3.webp",
    requiredLevel: 150,
    requiredEquipNames: ["黃金釣竿", "黃金", "黃金帽", "黃金外套", "黃金拖鞋"],
    requiredTicketName: "黃金通行證",
    disableEquip: true,
    ticketDurationMs: 30 * 60 * 1000,
    music: "sound/map4.mp3",
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
    const matchCount = equippedNames.filter((name) =>
      config.requiredEquipNames.includes(name)
    ).length;

    if (matchCount < 3) {
      return showAlert("需要穿戴任意三件對應裝備才能進入此地圖");
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
    rawProbability: fish.probability,
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
function getRarityClass(rawProbability) {
  if (rawProbability > 2) return "rarity-common"; // 普通：白色
  if (rawProbability > 0.3) return "rarity-uncommon"; // 高級：藍色
  if (rawProbability > 0.08) return "rarity-rare"; // 稀有：黃色
  if (rawProbability > 0.04) return "rarity-epic"; // 史詩：紫色
  if (rawProbability > 0.01) return "rarity-legend"; // 傳奇：紅色
  return "rarity-mythic"; // 神話：彩色邊框
}
// 🎯 精度條控制
let precisionInterval = null;
let pos = 0;
let direction = 1;
const speed = 5;
const intervalTime = 16;

function startPrecisionBar() {
  if (precisionInterval) return;
  FishingLoopSound.play();
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
function logCatchCard(fishObj, fishType, count = 1) {
  const bottomInfo = document.getElementById("bottomInfo");
  if (!bottomInfo) return;

  bottomInfo.innerHTML = ""; // 清空
  bottomInfo.className = "bottom-info show"; // 重設 class

  if (fishType && fishObj) {
    const card = document.createElement("div");
    card.className = "fish-card big-card";

    // 🪄 加上稀有度 class
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
    const wrapper = document.createElement("div");
    wrapper.className = "fish-card-wrapper";
    if (count > 1) {
      const countLabel = document.createElement("div");
      countLabel.className = "fish-dup-count";
      countLabel.textContent = `×${count}`;
      wrapper.appendChild(countLabel);
    }
    wrapper.appendChild(card);
    bottomInfo.appendChild(wrapper);
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
  if (selectedFishIds.size === 0) return playSfx(sfxClickPlus); // ⛔ 若沒選取，直接不處理
  playSfx(sfxDelete);
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
  checkAchievements();

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
document.getElementById("precisionStopBtn").addEventListener("click", () => {
  playSfx(sfxFishingClick);
  stopPrecisionBar();
});

// 關閉指示器
function stopPrecisionBar() {
  FishingLoopSound.stop();
  if (!precisionInterval) return;
  clearInterval(precisionInterval);
  precisionInterval = null;

  const track = document.getElementById("precisionTrack");
  const indicator = document.getElementById("precisionIndicator");
  const trackWidth = track.clientWidth;
  const indicatorWidth = indicator.clientWidth;
  const precisionRatio = pos / (trackWidth - indicatorWidth);

  const buffs = getTotalBuffs();
  const successChance = Math.min(
    Math.min(45 + precisionRatio * 25) *
      ((buffs.increaseCatchRate * 0.5 + 100) / 100) *
      currentMapConfig.catchRateModifier,
    98
  );
  const isSuccess = Math.random() * 100 < successChance;

  if (isSuccess) {
    const fishType = getWeightedFishByPrecision(precisionRatio);
    tryMultiCatch(fishType);
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
    originalProbability: fish.probability,
  }));
}

// 👜 點擊背包按鈕打開 Modal
const openBackpackBtn = document.getElementById("openBackpack");
if (openBackpackBtn) {
  openBackpackBtn.addEventListener("click", () => {
    playSfx(sfxOpen);
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
    playSfx(sfxToggle);
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
    FishingLoopSound.stop();
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
  // return 5000 + Math.random() * 15000;
  return 4500;
}
// 自動釣魚上鉤率
function doFishing() {
  const buffs = getTotalBuffs();
  const catchRateBonus = (buffs.increaseCatchRate * 0.5 + 100) / 100;
  const rawSuccessRate =
    0.5 * catchRateBonus * currentMapConfig.catchRateModifier;
  const successRate = Math.min(rawSuccessRate, 0.95); // 最終 cap 成功率

  if (Math.random() < successRate) {
    const fishType = getRandomFish();
    if (fishType) {
      tryMultiCatch(fishType);
    } else {
      logCatch("網路連線異常");
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

// 自動釣魚稀有度機率
function getRandomFish() {
  const buffs = getTotalBuffs();
  const rareRateBonus = 1 + buffs.increaseRareRate / 100;

  // 加權處理每條魚的機率
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

  return weightedFish[0]; // fallback
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
function addFishToBackpack(fishType, count = 1, fromBossBattle = false) {
  let lastFishObj = null;

  const rarity = getRarityClass(fishType.rawProbability);
  const rarityMultiplier = RARITY_HP_MULTIPLIERS[rarity] || 1;
  const bossHpModifier = currentMapConfig?.bossHpModifier || 1;

  for (let i = 0; i < count; i++) {
    const fishObj = createFishInstance(fishType);
    fishObj.rarity = rarity;
    fishObj.image = fishType.image;
    fishObj.maps = fishType.maps;

    // ✅ 計算血量
    fishObj.hp = Math.floor(
      ((fishObj.finalPrice * 10 * (100 + fishObj.size)) / 100) *
        rarityMultiplier *
        bossHpModifier
    );

    // ✅ 判斷是否進待戰區
    if (
      !fromBossBattle &&
      (rarity === "rarity-legend" || rarity === "rarity-mythic")
    ) {
      saveToBossBackpack(fishObj);
      if (rarity === "rarity-mythic") {
        incrementCounter("mythic-fish-count");
      }
      showAlert(
        `<span class="fight-text">${fishObj.name}</span> 還在掙扎，趕快跟牠搏鬥！`,
        true
      );
    } else {
      backpack.push(fishObj);
    }

    updateFishDex(fishObj);
    addExp(fishObj.finalPrice);
    maybeDropDivineItem();
    lastFishObj = fishObj;
  }

  saveBackpack();
  updateBackpackUI();
  refreshAllUI();
  checkAchievements();
  incrementCounter("player-fish-count");

  if (lastFishObj) {
    logCatchCard(lastFishObj, fishType, count);
  }
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
  const drops = GLOBAL_DROP_TABLE[currentMapKey];
  if (!drops || drops.length === 0) return;

  const materials = loadDivineMaterials();
  let hasAnyDrop = false;

  for (const item of drops) {
    if (Math.random() < item.chance) {
      materials[item.name] = (materials[item.name] || 0) + 1;

      showAlert(
        `
      <div class="d-flex flex-column align-items-center gap-2 ore-img-alert">
        <img class="shiny" src="${item.icon}" width="40" height="40" />
        <div>發現了 <strong>${item.name}</strong>！</div>
      </div>
    `,
        true
      );

      hasAnyDrop = true;
    }
  }

  if (hasAnyDrop) {
    saveDivineMaterials(materials);
    updateDivineUI?.();
  }
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

// 抽寶箱
const BUFF_TYPES = [
  { type: "increaseCatchRate", label: "增加上鉤率" },
  { type: "increaseRareRate", label: "增加稀有率" },
  { type: "increaseBigFishChance", label: "大體型魚機率" },
  { type: "increaseSellValue", label: "增加販售金額" },
  { type: "increaseExpGain", label: "經驗獲得加成" },
  { type: "multiCatchChance", label: "多魚成功率" },
  { type: "multiCatchMultiplier", label: "多魚倍數值" },
];

const RARITY_TABLE = [
  { key: "common", label: "普通", buffCount: 1 },
  { key: "uncommon", label: "高級", buffCount: 2 },
];

const RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 80 },
  { rarity: "高級", chance: 20 },
];

document.querySelector(".shop-chest").addEventListener("click", () => {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < CHEST_COST) {
    return showAlert("金錢不足！");
  }
  incrementCounter("player-chest-count");
  checkAchievements();
  playSfx(sfxOpenChest);
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
      return randomInt(1, 15);
    case "increaseRareRate":
      return randomInt(1, 15);
    case "increaseBigFishChance":
      return randomInt(1, 10);
    case "increaseSellValue":
      return randomInt(1, 5);
    case "increaseExpGain":
      return randomInt(1, 5);
    case "multiCatchChance":
      return randomInt(1, 15); // 較低起跳值，適合普通掉落
    case "multiCatchMultiplier":
      return randomInt(1, 5); // 較保守值，避免普通裝就出 x5
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

  // 👉 讀取篩選值
  const selectedType =
    document.getElementById("equipTypeFilter")?.value || "all";

  // 👉 過濾符合類型的裝備
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

    // 🔧 決定 buff 顯示方式
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
        playSfx(sfxClickPlus);
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
    playSfx(sfxClickPlus);
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
    playSfx(sfxEquip);
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

// 把buff顯示到html
function updateCharacterStats() {
  const stats = getTotalBuffs(); // ✅ 改這行就好！

  document.querySelector(
    ".increase-catch-rate"
  ).textContent = `增加上鉤率：${Math.round(stats.increaseCatchRate)}%`;
  document.querySelector(
    ".increase-rare-rate"
  ).textContent = `增加稀有率：${Math.round(stats.increaseRareRate)}%`;
  document.querySelector(
    ".increase-big-fish-chance"
  ).textContent = `大體型機率：${Math.round(stats.increaseBigFishChance)}%`;
  document.querySelector(
    ".increase-sellValue"
  ).textContent = `增加販售額：${Math.round(stats.increaseSellValue)}%`;
  document.querySelector(
    ".increase-exp-gain"
  ).textContent = `經驗值加成：${Math.round(stats.increaseExpGain)}%`;
  document.querySelector(
    ".multi-catch-chance"
  ).textContent = `多魚成功率：${Math.round(stats.multiCatchChance)}%`;
  document.querySelector(
    ".multi-catch-multiplier"
  ).textContent = `多魚倍數值：${Math.round(stats.multiCatchMultiplier)}%`;
}

// 脫下裝備
document.getElementById("unequipBtn").addEventListener("click", () => {
  const isEquipLocked = localStorage.getItem("disable-equip") === "1";
  if (isEquipLocked) {
    showAlert("此地圖禁止更換裝備");
    return;
  }
  if (!selectedEquippedSlot) return;
  playSfx(sfxClickPlus);
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
    playSfx(sfxClickPlus);
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
  const custom = JSON.parse(
    localStorage.getItem("player-custom-bonus") || "{}"
  );

  const buffs = {
    increaseCatchRate: 0,
    increaseRareRate: 0,
    increaseBigFishChance: 0,
    increaseSellValue: 0,
    increaseExpGain: 0,
    multiCatchChance: 0,
    multiCatchMultiplier: 0,
  };

  let godCount = 0;

  // ➕ 裝備 buff
  for (const item of Object.values(equipped)) {
    if (!item) continue;

    // 🎯 判斷名稱含「天神」即為天神裝
    if (item.name?.includes("天神")) {
      godCount++;
    }

    if (!item.buffs) continue;
    for (const buff of item.buffs) {
      if (buffs.hasOwnProperty(buff.type)) {
        buffs[buff.type] += buff.value;
      }
    }
  }

  // ➕ 天神裝額外 buff（每件 +8%）
  const godBuff = godCount * 8;
  for (const key in buffs) {
    buffs[key] += godBuff;
  }

  // ➕ 自選點數 buff
  for (const key in custom) {
    if (buffs.hasOwnProperty(key)) {
      buffs[key] += custom[key];
    }
  }

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

  const mapName = selectedMap === "all" ? null : MAP_CONFIG[selectedMap].name;

  // 🔍 篩出該地圖出現的所有魚種
  const filteredFishTypes = allFishTypes.filter(
    (fish) => !mapName || (fish.maps || []).includes(mapName)
  );

  // 🧮 計算該地圖中有幾種魚被發現
  const filteredDiscoveredCount = filteredFishTypes.filter((fish) =>
    discoveredNames.includes(fish.name)
  ).length;

  // 🧾 顯示進度 (目前地圖已發現 / 地圖總魚種)
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
    existing.rarity = rarity; // 確保更新稀有度（若機率資料更新）
    existing.maps = maps; // ✅ 加入/更新 maps 欄位
  }

  localStorage.setItem(FISH_DEX_KEY, JSON.stringify(dex));
}

// 新增高級寶箱
const HIGH_TIER_RARITY_PROBABILITIES = [
  { rarity: "普通", chance: 75 },
  { rarity: "高級", chance: 20 },
  { rarity: "稀有", chance: 5 },
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
      return randomInt(1, 50);
    case "increaseRareRate":
      return randomInt(1, 50);
    case "increaseBigFishChance":
      return randomInt(1, 40);
    case "increaseSellValue":
      return randomInt(1, 15);
    case "increaseExpGain":
      return randomInt(1, 15);
    case "multiCatchChance":
      return randomInt(1, 40); // 多魚發動率，建議從 5% 起跳
    case "multiCatchMultiplier":
      return randomInt(1, 10); // 倍數影響建議範圍較低
    default:
      return 1;
  }
}

document.querySelector(".chest2").addEventListener("click", () => {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < chestCost) return showAlert("金錢不足！");

  playSfx(sfxOpenChest);
  incrementCounter("player-chest-count");
  checkAchievements();
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
  if (level >= 1 && level <= 49) {
    return level * 100;
  } else if (level >= 50 && level <= 99) {
    return level * 230;
  } else if (level >= 100 && level <= 149) {
    return level * 525;
  } else if (level >= 150) {
    return level * 1200;
  } else {
    return 0; // 處理 level < 1 的情況
  }
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
  checkAchievements();
  refreshAllUI();
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
      updateBackpackUI?.();
      playMapMusic(config.music);
    });
}

function showLevelUpModal(level) {
  const el = document.createElement("div");
  el.className = "level-up-toast";
  el.textContent = `Lv.${level} 升級了！`;
  document.body.appendChild(el);
  // ✅ 同步素質點數
  syncStatPointsWithLevel(level);
  // ✅ 如果素質分配畫面是開著的，就順便更新畫面
  const modalEl = document.getElementById("statPointModal");
  if (modalEl && modalEl.classList.contains("show")) {
    updateStatPointModal();
  }

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
      playSfx(sfxDelete);
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
export function addTicketToInventory(ticketType) {
  const owned = JSON.parse(localStorage.getItem("owned-equipment-v2") || "[]");

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
    image = "images-webp/shop/ticket3.webp"; // ⬅ 你自己準備好圖
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
// 精煉等級限制
function getRefineLimitByLevel() {
  const level = loadLevel();
  if (level >= 125) return 10;
  if (level >= 75) return 7;
  if (level >= 15) return 4;
  return 0;
}
// 選擇提煉方式
function openRefineChoiceModal(equip) {
  const level = loadLevel();
  if (level < 15) {
    showAlert("等級 15 解鎖提煉功能");
    return;
  }
  const modal = new bootstrap.Modal(
    document.getElementById("refineChoiceModal")
  );
  modal.show();

  // 綁定兩個選項按鈕的行為
  document.getElementById("refineForgeBtn").onclick = () => {
    playSfx(sfxRefine);
    modal.hide();
    openRefineModal(equip); // 你之前寫的鍛造 modal
  };

  document.getElementById("refineDivineBtn").onclick = () => {
    playSfx(sfxRefine);
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

  const buffIncrements = [0, 3, 3, 4, 6, 7, 10, 12, 15, 20, 25];
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
  const successRates = [0.8, 0.75, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1, 0.08, 0.05];
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
  const maxRefine = getRefineLimitByLevel();
  if (refineLevel === 10) {
    showAlert(`已達最高精煉!`);
    return;
  }
  if (refineLevel >= maxRefine) {
    showAlert(`已達目前精煉上限，等級提升即可繼續強化!`);
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
  const successRates = [0.8, 0.75, 0.7, 0.6, 0.5, 0.3, 0.2, 0.1, 0.08, 0.05];
  const chance = successRates[refineLevel];
  const success = Math.random() < chance;

  if (success) {
    playSfx(sfxSuccess);
    equip.refineLevel++;
    const index = Math.floor(Math.random() * equip.buffs.length);

    const buffIncrements = [0, 3, 3, 4, 6, 7, 10, 12, 15, 20, 25];
    const increase = buffIncrements[equip.refineLevel] ?? 5;

    equip.buffs[index].value += increase;
  } else {
    playSfx(sfxFail);
  }

  // 儲存與更新 ownedEquipment
  const owned = JSON.parse(localStorage.getItem(ownedEquipment) || "[]");
  const idx = owned.findIndex((e) => e.id === equip.id);
  if (idx !== -1) owned[idx] = equip;
  localStorage.setItem(ownedEquipment, JSON.stringify(owned));

  // ✅ 同步更新 equipped-items-v2（如果是穿戴中的裝備）
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  for (const slot in equipped) {
    if (equipped[slot]?.id === equip.id) {
      equipped[slot] = equip;
      break;
    }
  }
  localStorage.setItem(EQUIPPED_KEY, JSON.stringify(equipped));

  updateOwnedEquipListUI();
  updateCrystalUI?.();
  updateCharacterStats?.();

  // 更新裝備卡內容
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

  const buffIncrements = [0, 3, 3, 4, 6, 7, 10, 12, 15, 20, 25];
  const previewIncrease = buffIncrements[equip.refineLevel + 1] ?? 0;

  const buffPreview = document.getElementById("refineBuffPreview");
  if (buffPreview) {
    buffPreview.textContent = previewIncrease
      ? `效果：隨機 Buff 提升 ${previewIncrease}%`
      : `效果：-`;
  }

  const rateInfo = document.getElementById("refineSuccessRate");
  if (rateInfo) {
    const currentRate = successRates[equip.refineLevel] ?? 0;
    rateInfo.textContent = `成功率：${Math.round(currentRate * 100)}%`;
  }

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
    隕石碎片: { count: 1, icon: "images-webp/icons/ore2.webp" },
    黃銅礦: { count: 1, icon: "images-webp/icons/ore3.webp" },
    核廢料: { count: 1, icon: "images-webp/icons/ore4.webp" },
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
    if (!allEnough) return showAlert("材料不足，無法神化");

    // ✅ 扣材料
    for (const [name, { count }] of Object.entries(reqs)) {
      freshMaterials[name] -= count;
    }
    saveDivineMaterials(freshMaterials);

    playSfx(sfxGod);

    // ✅ 從 god.json 讀神裝資料
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

    // ✅ 替換背包裝備
    let owned = loadOwnedEquipments();
    const index = owned.findIndex((e) => e.id === equip.id);
    if (index !== -1) {
      // 有在背包中 → 替換
      owned[index] = newEquip;
      saveOwnedEquipments(owned);
    } else {
      // 沒在背包中 → 不 push，只更新穿戴裝備
      saveOwnedEquipments(owned); // 還是儲存一下（維持穩定）
    }

    // ✅ 如果原裝備在穿戴中，也要同步更新 equipped-items-v2
    const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
    for (const slot in equipped) {
      if (equipped[slot]?.id === equip.id) {
        equipped[slot] = newEquip;
        break;
      }
    }
    localStorage.setItem(EQUIPPED_KEY, JSON.stringify(equipped));

    updateOwnedEquipListUI();
    updateCharacterStats?.();
    updateDivineUI?.();
    updateEquippedUI();
    showAlert(`✨ 神化成功！你獲得了【${newName}】`);
    modal.hide();
  };
}

// 音效
function playSfx(audioEl) {
  if (!userHasInteractedWithBgm || !isSoundEnabled) return;

  // 如果還沒 decode 完就先跳過
  const buffer = audioBufferMap.get(audioEl);
  if (!buffer) {
    decodeAudioToBuffer(audioEl); // 預先 decode（非同步）
    return;
  }

  // 建立播放 source
  const source = webAudioCtx.createBufferSource();
  source.buffer = buffer;

  // 建立 gain node 來控制音量
  const gainNode = webAudioCtx.createGain();
  gainNode.gain.value = audioEl.volume;

  // 接上音訊串接
  source.connect(gainNode).connect(webAudioCtx.destination);
  source.start(0);
}
// 載入儲存的使用者偏好（可放在 main.js 前面）
function loadSoundSetting() {
  isSoundEnabled = localStorage.getItem("sound-enabled") !== "false";
}
// 儲存設定（供 UI 切換時用）
function saveSoundSetting() {
  localStorage.setItem("sound-enabled", isSoundEnabled);
}
// 切換音樂模式圖片
function updateSoundToggleIcon() {
  const icon = document.getElementById("setSoundIcon");
  icon.src = isSoundEnabled
    ? "images-webp/icons/voice.webp"
    : "images-webp/icons/voice2.webp";
}

// 等級點數
function syncStatPointsWithLevel(levelFromParam = null) {
  const level =
    levelFromParam ??
    parseInt(localStorage.getItem("fishing-player-level-v1") || "1", 10);

  const fromLevel = level;
  const fromAchievement = parseInt(
    localStorage.getItem("player-achievement-points") || "0",
    10
  );
  const expectedTotal = fromLevel + fromAchievement;

  const custom = JSON.parse(
    localStorage.getItem("player-custom-bonus") || "{}"
  );
  const usedPoints = Object.values(custom).reduce((a, b) => a + b, 0);
  const currentPoints = parseInt(
    localStorage.getItem("player-stat-points") || "0",
    10
  );

  const totalOwned = usedPoints + currentPoints;
  const diff = expectedTotal - totalOwned;

  if (diff > 0) {
    localStorage.setItem(
      "player-stat-points",
      (currentPoints + diff).toString()
    );
  }
}

function updateStatPointModal() {
  const pointsRaw = parseInt(localStorage.getItem("player-stat-points") || "0");
  const custom = JSON.parse(
    localStorage.getItem("player-custom-bonus") || "{}"
  );

  const usedPoints = Object.values(custom).reduce((a, b) => a + b, 0);
  const totalPoints = pointsRaw + usedPoints;
  const remainingPoints = totalPoints - usedPoints;

  document.getElementById("availablePoints").textContent = remainingPoints;

  // 遍歷每一列（已靜態存在）
  document.querySelectorAll("#statList > div[data-key]").forEach((row) => {
    const key = row.dataset.key;
    const value = custom[key] || 0;

    // 更新數值
    const valueDiv = row.querySelector(".value");
    if (valueDiv) valueDiv.textContent = `+${value}%`;

    // 更新 +1 按鈕
    const btn = row.querySelector(".add-btn");
    if (btn) {
      if (remainingPoints > 0) {
        btn.style.display = "block";
        btn.onclick = () => {
          playSfx(sfxClickPlus);
          allocatePoint(key);
          addClickBounce(btn);
        };
      } else {
        btn.style.display = "none";
      }
    }
  });
}

window.allocatePoint = function (type) {
  let points = parseInt(localStorage.getItem("player-stat-points") || "0");
  if (points <= 0) return;

  const custom = JSON.parse(
    localStorage.getItem("player-custom-bonus") || "{}"
  );
  custom[type] = (custom[type] || 0) + 1;
  localStorage.setItem("player-custom-bonus", JSON.stringify(custom));

  points--;
  setTimeout(() => {
    localStorage.setItem("player-stat-points", points.toString());
    updateStatPointModal(); // 畫面更新
  }, 0);

  // ✅ 重新更新畫面與資料
  updateStatPointModal(); // 重新 render UI
  updateCharacterStats(); // 更新主畫面加總加成顯示
};

// ✅ 自動統計玩家動作紀錄
function incrementCounter(key) {
  const value = parseInt(localStorage.getItem(key) || "0", 10);
  localStorage.setItem(key, (value + 1).toString());
}
// 購買提煉結晶的通用函式
function buyRefineCrystal(amount, price) {
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );
  if (currentMoney < price) {
    return showAlert("金錢不足！");
  }

  // 扣除金幣與增加結晶
  localStorage.setItem("fishing-money", (currentMoney - price).toString());
  const currentCrystal = parseInt(
    localStorage.getItem("refine-crystal") || "0",
    10
  );
  localStorage.setItem("refine-crystal", (currentCrystal + amount).toString());

  // 更新畫面與音效
  playSfx(sfxTicket);
  updateMoneyUI();
  updateCrystalUI();
  showAlert(`已購買 ${amount} 顆提煉結晶！`);
}

// 查看目前地圖效率
function showEfficiencyModal() {
  const buffs = getTotalBuffs();
  const mapMod = currentMapConfig.catchRateModifier;
  const mapMod2 = currentMapConfig.multiCatcModifier;

  // 🎯 手動釣魚命中率（precisionRatio = 1）
  const precisionRatio = 1;
  const manualCatchRateBonus = (buffs.increaseCatchRate * 0.5 + 100) / 100;
  const baseManual = 45 + precisionRatio * 25;
  const rawManualRate = baseManual * manualCatchRateBonus * mapMod;
  const manualRate = Math.min(rawManualRate, 98);
  document.getElementById("manualRate").textContent = manualRate.toFixed(2);

  // 🤖 自動釣魚命中率
  const autoCatchRateBonus = (buffs.increaseCatchRate * 0.5 + 100) / 100;
  const rawAutoRate = 0.5 * autoCatchRateBonus * mapMod;
  const autoRate = Math.min(rawAutoRate, 0.95);
  document.getElementById("autoRate").textContent = (autoRate * 100).toFixed(2);

  // 🐠 多魚成功率（觸發機率）+ 倍數（平均尾數影響）
  const rawMultiChance = (buffs.multiCatchChance || 0) / 3;
  const multiChance = Math.min(rawMultiChance * mapMod2, 60);
  document.getElementById("multiCatchChance").textContent =
    multiChance.toFixed(2);

  new bootstrap.Modal(document.getElementById("efficiencyModal")).show();
}

// 多魚判斷
function tryMultiCatch(fishType) {
  const buffs = getTotalBuffs();
  const mapMod = currentMapConfig.multiCatcModifier || 1;

  // 🎯 加上地圖倍率影響
  const rawChance = (buffs.multiCatchChance || 0) / 3;
  const chance = Math.min(rawChance * mapMod, 60);

  const bonus = buffs.multiCatchMultiplier || 0;
  let finalCount = 1;

  if (Math.random() * 100 < chance) {
    const table = [
      { count: 5, weight: 1 + bonus * 0.2 },
      { count: 4, weight: 3 + bonus * 0.6 },
      { count: 3, weight: 7 + bonus },
      { count: 2, weight: 500 + bonus * 3 },
    ];
    let r = Math.random() * table.reduce((s, m) => s + m.weight, 0);
    for (const m of table) {
      if (r < m.weight) {
        finalCount = m.count;
        break;
      }
      r -= m.weight;
    }
  }

  addFishToBackpack(fishType, finalCount);
}

// ---------------戰鬥變數---------------

let currentBossHp = 0;
let bossTimer = 999;
let timerInterval = null;
let isBossFightActive = false;
// BOSS的移動參數
let bossMoveAngle = 0;
let bossMoveSpeed = 3;
let bossMoveLoop = null;
let posX = 0;
let posY = 0;
let isBossMoving = false;
let bossDamageMultiplier = 0.5;
let bossSkillInterval = null;

let userDamage = 10000;
const BOSS_SKILL_POOL = {
  清澈川流: {
    "rarity-legend": ["fast"],
    "rarity-mythic": ["fast", "armor", "dive"],
  },
  劍與魔法村: {
    "rarity-legend": ["fast", "dive"],
    "rarity-mythic": ["fast", "armor", "dive", "teleport"],
  },
  機械城河: {
    "rarity-legend": ["fast", "dive", "teleport"],
    "rarity-mythic": ["fast", "armor", "dive", "invisible", "jam"],
  },
  黃金遺址: {
    "rarity-legend": ["fast", "dive", "teleport", "armor"],
    "rarity-mythic": ["teleport", "armor", "dive", "invisible", "shrink"],
  },
};
// 儲存進 BOSS 背包
function saveToBossBackpack(fish) {
  const storageKey = "boss-pending-fish";
  const list = JSON.parse(localStorage.getItem(storageKey) || "[]");
  list.push(fish);
  localStorage.setItem(storageKey, JSON.stringify(list));
}
function openBossBackpackModal() {
  updateBossBackpackUI();
  new bootstrap.Modal(document.getElementById("bossBackpackModal")).show();
}
function updateBossBackpackUI() {
  const list = JSON.parse(localStorage.getItem("boss-pending-fish") || "[]");
  const container = document.getElementById("bossBackpackContent");

  if (list.length === 0) {
    container.innerHTML = `<div class="text-center text-white">目前沒有待戰神話魚</div>`;
  } else {
    container.innerHTML = list
      .map((fish, index) => {
        const rarityClass =
          fish.rarity === "rarity-legend" ? "rarity-legend" : "rarity-mythic";
        return `
        <div class="d-flex align-items-center boss-card ${rarityClass}" data-index="${index}">
          <div class="boss-img-wrapper">
            <img class="shiny" src="${fish.image}" />
          </div>
          <div class="boss-info flex-grow-1">
            <div class="fw-bold">${fish.name}</div>
            <div>體型：${fish.size.toFixed(1)}%</div>
            <div>稀有度：${
              fish.rarity === "rarity-legend" ? "傳奇" : "神話"
            }</div>
            <div class="text-danger">HP：${(
              fish.hp ?? 0
            ).toLocaleString()}</div>
          </div>
        </div>
      `;
      })
      .join("");

    // 綁定點擊事件
    container.querySelectorAll(".boss-card").forEach((card) => {
      card.addEventListener("click", () => {
        const index = parseInt(card.getAttribute("data-index"));
        openBossBattle(index);
      });
    });
  }
}
function startBossCountdown() {
  bossTimer = bossTimer;
  document.getElementById("bossTimer").textContent = bossTimer;

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    bossTimer--;
    document.getElementById("bossTimer").textContent = bossTimer;
    if (bossTimer <= 0) {
      clearInterval(timerInterval);
      endBossFight(false); // 挑戰失敗
    }
  }, 1000);
}
async function openBossBattle(index) {
  const list = JSON.parse(localStorage.getItem("boss-pending-fish") || "[]");
  const fish = list[index];
  if (!fish) return;

  const confirmBattle = await customConfirm(`是否挑戰 ${fish.name}？`);
  if (!confirmBattle) return;

  // ✅ 儲存挑戰中 BOSS 到全域變數
  window.currentBossFish = fish;
  startBossFight(fish); // ← 真正開戰函式
}

function startBossFight(fish) {
  document.getElementById("bossBattleOverlay").style.display = "flex";

  // 更新名稱與圖片
  document.getElementById("bossName").textContent = fish.name;
  document.getElementById("bossSprite").src = fish.image;

  // 設定血量
  currentBossHp = fish.hp;
  document.getElementById("bossHpCurrent").textContent =
    currentBossHp.toLocaleString();
  document.getElementById("bossHpTotal").textContent = fish.hp.toLocaleString();
  document.getElementById("bossHpFill").style.width = "100%";

  // 顯示倒數
  const countdownOverlay = document.getElementById("bossCountdownOverlay");
  const countdownText = document.getElementById("bossCountdownText");
  countdownOverlay.classList.remove("hide");

  let countdown = 3;
  countdownText.textContent = countdown;

  const countdownInterval = setInterval(() => {
    countdown--;

    if (countdown > 0) {
      countdownText.textContent = countdown;
      countdownText.classList.remove("countdown-animate");
      void countdownText.offsetWidth;
      countdownText.classList.add("countdown-animate");
    } else if (countdown === 0) {
      countdownText.textContent = "開始搏鬥!";
      countdownText.classList.remove("countdown-animate");
      void countdownText.offsetWidth;
      countdownText.classList.add("countdown-animate");
    } else {
      clearInterval(countdownInterval);
      isBossFightActive = true;
      countdownOverlay.classList.add("hide");
      startBossCountdown();
    }
  }, 1000);
  startBossMovementLoop();
  bossSkillInterval = setInterval(() => {
    triggerRandomBossSkill(fish);
  }, 5000 + Math.random() * 5000);
}

function endBossFight(success) {
  stopBossMovement();
  isBossFightActive = false;
  clearInterval(timerInterval);

  const overlay = document.getElementById("bossBattleOverlay");
  const messageBox = document.getElementById("bossResultMessage");

  // ✅ 顯示結果
  messageBox.textContent = success ? "釣上來啦！" : "魚逃走了...";
  messageBox.classList.remove("hide");

  // ✅ 處理待戰清單移除
  const pendingList = JSON.parse(
    localStorage.getItem("boss-pending-fish") || "[]"
  );
  const target = window.currentBossFish;

  const updatedList = pendingList.filter((f) => {
    // 用時間與名稱來比對唯一性（避免同名魚誤刪）
    return !(f.id === target.id && f.caughtAt === target.caughtAt);
  });

  localStorage.setItem("boss-pending-fish", JSON.stringify(updatedList));

  // ✅ 如果成功，加進正式背包
  if (success) {
    // 直接加入已完成的魚物件
    const fish = window.currentBossFish;
    backpack.push(fish);
    saveBackpack();
    updateBackpackUI();
    refreshAllUI();
    checkAchievements();
    incrementCounter("player-fish-count");
    addExp(fish.finalPrice);
    updateFishDex(fish);
    maybeDropDivineItem();
    logCatchCard(fish, fish, 1);
  }
  updateBossBackpackUI();
  // ✅ 關閉畫面延遲
  setTimeout(() => {
    messageBox.classList.add("hide");
    overlay.style.display = "none";
  }, 3000);
}

function dealBossDamage(amount) {
  if (!isBossFightActive || currentBossHp <= 0) return;

  // ✅ 套用傷害倍率（armor 技能會將 bossDamageMultiplier 設為 0.5）
  const actualDamage = Math.floor(amount * bossDamageMultiplier);

  currentBossHp = Math.max(currentBossHp - actualDamage, 0);

  const total = parseInt(
    document.getElementById("bossHpTotal").textContent.replace(/,/g, "")
  );
  const percent = (currentBossHp / total) * 100;

  document.getElementById("bossHpCurrent").textContent =
    currentBossHp.toLocaleString();
  document.getElementById("bossHpFill").style.width = `${percent}%`;

  // ✅ 播放動畫（不影響 scaleX）
  const sprite = document.getElementById("bossSprite");
  sprite.classList.add("hit");
  setTimeout(() => sprite.classList.remove("hit"), 200);

  if (currentBossHp <= 0) {
    clearInterval(timerInterval);
    endBossFight(true);
  }
}

function startBossMovementLoop() {
  isBossMoving = true;
  const sprite = document.getElementById("bossSprite");
  const moveArea = document.getElementById("bossMoveArea");

  posX = moveArea.clientWidth / 2;
  posY = moveArea.clientHeight / 2;

  bossMoveAngle = Math.random() * 360;
  bossMoveSpeed = 1.5 + Math.random() * 2.5;

  function moveStep() {
    if (!isBossMoving) return;
    const spriteW = sprite.offsetWidth;
    const spriteH = sprite.offsetHeight;
    const areaW = moveArea.clientWidth;
    const areaH = moveArea.clientHeight;

    const rad = (bossMoveAngle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    posX += dx * bossMoveSpeed;
    posY += dy * bossMoveSpeed;

    const halfW = spriteW / 2;
    const halfH = spriteH / 2;

    const maxOffsetX = halfW / 10; // 控制可超出寬度
    const maxOffsetY = halfH / 10; // 控制可超出高度

    if (posX < -maxOffsetX || posX > areaW + maxOffsetX) {
      bossMoveAngle = 180 - bossMoveAngle + (Math.random() * 30 - 15);
    }
    if (posY < -maxOffsetY || posY > areaH + maxOffsetY) {
      bossMoveAngle = -bossMoveAngle + (Math.random() * 30 - 15);
    }

    bossMoveAngle = (bossMoveAngle + 360) % 360;

    // ✅ 水平翻轉
    const scaleX = dx >= 0 ? -1 : 1;
    sprite.style.setProperty("--scale-x", scaleX);

    sprite.style.left = `${posX}px`;
    sprite.style.top = `${posY}px`;

    bossMoveLoop = requestAnimationFrame(moveStep);
  }

  bossMoveLoop = requestAnimationFrame(moveStep);

  // 隨機改變方向與速度
  setInterval(() => {
    bossMoveAngle += Math.random() * 120 - 60;
    bossMoveSpeed = 1 + Math.random() * 4;
  }, 800 + Math.random() * 1000);
}

function stopBossMovement() {
  isBossMoving = false;
  if (bossMoveLoop) cancelAnimationFrame(bossMoveLoop);
}

let bossState = {
  shrinking: false,
  armor: false,
  invisible: false,
  // 其他狀態也可以集中管理
};
function triggerBossSkill(skillName) {
  const sprite = document.getElementById("bossSprite");

  switch (skillName) {
    case "invisible":
      // ✅ 隱形隨機 1~3 秒
      const duration = 1500 + Math.random() * 2500; // 1000 ~ 3000 毫秒

      sprite.style.opacity = "0.2";
      sprite.style.pointerEvents = "none"; // 禁止點擊

      setTimeout(() => {
        sprite.style.opacity = "1";
        sprite.style.pointerEvents = "auto";
      }, duration);

      break;

    case "teleport":
      {
        // ✅ 暫停移動 loop
        cancelAnimationFrame(bossMoveLoop);

        const area = document.getElementById("bossMoveArea");
        const spriteW = sprite.offsetWidth;
        const spriteH = sprite.offsetHeight;
        const areaW = area.clientWidth;
        const areaH = area.clientHeight;

        const newX = Math.random() * (areaW - spriteW) + spriteW / 2;
        const newY = Math.random() * (areaH - spriteH) + spriteH / 2;

        posX = newX;
        posY = newY;

        sprite.style.transition = "top 0.2s, left 0.2s";
        sprite.style.left = `${newX}px`;
        sprite.style.top = `${newY}px`;

        // ✅ 0.2 秒後恢復移動
        setTimeout(() => {
          startBossMovementLoop(); // 重新啟動移動
        }, 200);
      }
      break;

    case "fast":
      // ✅ 高速移動 → 移動速度變快 5 秒
      bossMoveSpeed *= 4;
      setTimeout(() => {
        bossMoveSpeed /= 4;
      }, 5000);
      break;

    case "dive":
      // ✅ 沉入水中 → 3 秒滑到底部消失再出現
      sprite.style.transition = "top 1s, opacity 1s";
      sprite.style.opacity = "0";
      sprite.style.top = "100%";
      setTimeout(() => {
        sprite.style.top = "10%";
        sprite.style.opacity = "1";
      }, 3000);
      break;

    case "shrink":
      // 縮小術'
      if (bossState.shrinking) break;
      bossState.shrinking = true;

      sprite.classList.add("shrinked");

      setTimeout(() => {
        sprite.classList.remove("shrinked");
        bossState.shrinking = false;
      }, 3000);
      break;

    case "armor":
      // ✅ 鋼鐵鎧甲 → 減傷標記 5 秒
      sprite.classList.add("armor"); // 可搭配 CSS 邊框效果
      bossDamageMultiplier = 0.5; // 傷害減半
      setTimeout(() => {
        sprite.classList.remove("armor");
        bossDamageMultiplier = 1;
      }, 3000);
      break;

    // case "shadowClone":
    //   // ✅ 影分身 → 加入 2 個假分身干擾
    //   spawnShadowClones(2); // 你需實作這個 helper
    //   break;

    case "jam":
      // ✅ 電磁干擾 → 全畫面閃爍 3 秒，無法點擊
      const overlay = document.getElementById("bossBattleOverlay");
      overlay.classList.add("jammed"); // 可加白色閃爍動畫
      // sprite.style.pointerEvents = "none";
      setTimeout(() => {
        overlay.classList.remove("jammed");
        // sprite.style.pointerEvents = "auto";
      }, 3000);
      break;

    default:
      console.warn("未知技能:", skillName);
  }
  console.log("技能發動:", skillName);
  console.log("BOSS 當前位置:", sprite.style.left, sprite.style.top);
  // showBossSkillName(skillName); // ✅ 可選：顯示技能名稱提示（你可客製）
}

function spawnShadowClones(count = 2) {
  const moveArea = document.getElementById("bossMoveArea");
  const sprite = document.getElementById("bossSprite");
  if (!moveArea || !sprite) {
    console.warn("❌ 無法找到 bossMoveArea 或 bossSprite");
    return;
  }

  requestAnimationFrame(() => {
    const spriteW = sprite.offsetWidth;
    const spriteH = sprite.offsetHeight;
    const areaW = moveArea.clientWidth;
    const areaH = moveArea.clientHeight;

    if (spriteW === 0 || spriteH === 0) {
      console.warn("❌ Boss sprite 尚未渲染完成（寬高為 0）");
      return;
    }

    const bossRect = sprite.getBoundingClientRect();
    const areaRect = moveArea.getBoundingClientRect();
    const baseX = bossRect.left - areaRect.left + spriteW / 2;
    const baseY = bossRect.top - areaRect.top + spriteH / 2;

    for (let i = 0; i < count; i++) {
      const clone = sprite.cloneNode(false);
      clone.classList.remove("hit", "armor");
      clone.classList.add("shadow-clone");
      clone.removeAttribute("id");

      let posX = baseX;
      let posY = baseY;

      let angle = i === 0 ? 30 + Math.random() * 30 : 150 + Math.random() * 30;
      let speed = 2 + Math.random() * 1.5;

      clone.style.left = `${posX}px`;
      clone.style.top = `${posY}px`;
      clone.style.setProperty(
        "--scale-x",
        Math.cos((angle * Math.PI) / 180) >= 0 ? -1 : 1
      );
      clone.style.opacity = "1";
      clone.style.pointerEvents = "none";

      moveArea.appendChild(clone);

      const moveClone = () => {
        const rad = (angle * Math.PI) / 180;
        posX += Math.cos(rad) * speed * 1.5;
        posY += Math.sin(rad) * speed * 1.5;

        const padding = 20;
        if (posX < padding || posX > areaW - spriteW + padding) {
          angle = 180 - angle + (Math.random() * 30 - 15);
        }
        if (posY < padding || posY > areaH - spriteH + padding) {
          angle = -angle + (Math.random() * 30 - 15);
        }

        angle = (angle + 360) % 360;
        clone.style.setProperty("--scale-x", Math.cos(rad) >= 0 ? -1 : 1);
        clone.style.left = `${posX}px`;
        clone.style.top = `${posY}px`;

        clone._moveLoop = requestAnimationFrame(moveClone);
      };

      moveClone();

      setTimeout(() => {
        cancelAnimationFrame(clone._moveLoop);
        clone.remove();
      }, 4000);
    }

    console.log(`✅ Shadow clones created (${count})`);
  });
}

function triggerRandomBossSkill(fish) {
  const map = fish.maps || currentMapKey; // ✅ 根據魚的來源地圖決定技能
  const rarity = fish.rarity;
  const skillPool = BOSS_SKILL_POOL[map]?.[rarity] || [];

  if (skillPool.length === 0) return;

  const skill = skillPool[Math.floor(Math.random() * skillPool.length)];
  triggerBossSkill(skill);
}

// 下面是 document
// 綁定按鈕事件
document.getElementById("bossSprite").onclick = () => {
  dealBossDamage(userDamage);
};
document
  .getElementById("openBossBackpackBtn")
  .addEventListener("click", openBossBackpackModal);
document.getElementById("refineEquippedBtn").addEventListener("click", () => {
  playSfx(sfxClickPlus);
  const modalEl = document.getElementById("equipInfoModal");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  const equipped = JSON.parse(localStorage.getItem(EQUIPPED_KEY) || "{}");
  if (!selectedEquippedSlot) return;
  const equip = equipped[selectedEquippedSlot];
  if (!equip) return;

  openRefineChoiceModal(equip);
});
document.getElementById("currentMapDisplay").addEventListener("click", () => {
  playSfx(sfxOpen);
  showEfficiencyModal();
});
document.getElementById("buyOre1").addEventListener("click", () => {
  buyRefineCrystal(10, 15000);
});
document.getElementById("buyOre10").addEventListener("click", () => {
  buyRefineCrystal(100, 150000);
});
document.getElementById("buyOre100").addEventListener("click", () => {
  buyRefineCrystal(1000, 1500000);
});
document.getElementById("openAchievementBtn").addEventListener("click", () => {
  playSfx(sfxOpen);
  renderAchievementList();
  const modal = new bootstrap.Modal(
    document.getElementById("achievementModal")
  );
  modal.show();
});
document.querySelector(".all-status-btn").addEventListener("click", () => {
  playSfx(sfxClickPlus);
  updateStatPointModal(); // ← 更新內容
  new bootstrap.Modal(document.getElementById("statPointModal")).show();
});
document.getElementById("soundCheckBtn").addEventListener("click", () => {
  playSfx(sfxOpen);
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("soundSettingModal")
  );
  modal?.hide(); // ✅ 關閉 modal
});
document.getElementById("SoundBtn").addEventListener("click", () => {
  playSfx(sfxOpen);
  // updateSoundModalButtons(); // 確保每次開都顯示正確狀態
  const modal = new bootstrap.Modal(
    document.getElementById("soundSettingModal")
  );
  modal.show();
});
document.getElementById("setSoundBtn").addEventListener("click", () => {
  // playSfx(sfxOpen);
  isSoundEnabled = !isSoundEnabled;
  saveSoundSetting();
  updateSoundToggleIcon();
});
document.querySelectorAll(".btn-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    playSfx(sfxClose);
  });
});
document
  .getElementById("equipTypeFilter")
  ?.addEventListener("change", updateOwnedEquipListUI);
document.getElementById("openTutorial").addEventListener("click", () => {
  playSfx(sfxOpen);
  const modal = new bootstrap.Modal(document.getElementById("tutorialModal"));
  modal.show();
});
document.getElementById("refineBtn").onclick = () => {
  openRefineChoiceModal(selectedEquip);
};

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

    // ✅ 如果剛解除靜音，主動呼叫 play()
    if (!isMuted && currentBgm.paused) {
      currentBgm.play().catch((e) => console.warn("播放失敗", e));
    }

    const icon = document.getElementById("bgmIcon");
    icon.src = isMuted
      ? "images-webp/icons/voice2.webp"
      : "images-webp/icons/voice.webp";
  }
});

// 加入劍與魔法村入場券
document.getElementById("buyMap4Ticket").addEventListener("click", () => {
  const price = ticket1Price;
  const currentMoney = parseInt(
    localStorage.getItem("fishing-money") || "0",
    10
  );

  if (currentMoney < price) return showAlert("金錢不足！");
  playSfx(sfxTicket);
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
  playSfx(sfxTicket);
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
  playSfx(sfxTicket);
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
  playSfx(sfxOpen);
  const functionMenu = bootstrap.Modal.getInstance(
    document.getElementById("functionMenuModal")
  );
  if (functionMenu) {
    functionMenu.hide();
  }
  new bootstrap.Modal(document.getElementById("mapSelectModal")).show();
});
document.getElementById("openFunctionMenu").addEventListener("click", () => {
  playSfx(sfxOpen);
  const modal = new bootstrap.Modal(
    document.getElementById("functionMenuModal")
  );
  modal.show();
});
document.getElementById("openFishBook").addEventListener("click", () => {
  playSfx(sfxOpenFishBook);
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
  playSfx(sfxDoor);
  const modal = new bootstrap.Modal(document.getElementById("shopModal"));
  modal.show();
});
document.getElementById("selectAllBtn").addEventListener("click", () => {
  for (const fish of backpack) {
    selectedFishIds.add(fish.id);
  }
  playSfx(sfxClickPlus);
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
    playSfx(sfxClickPlus);
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
  playSfx(sfxOpen);
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
  playSfx(sfxDelete);
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
    playSfx(sfxClose);
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("multiSellResultModal")
    );
    if (modal) modal.hide();
  });
export function refreshAllUI() {
  renderAchievementList();
  updateMoneyUI();
  updateCrystalUI();
}

// 建立 UI 清單內容
export function renderAchievementList() {
  const container = document.getElementById("achievementList");
  if (!container) return;

  const statusMap = getAchievementStatusMap();
  container.innerHTML = "";

  // ✅ 排序：unlocked → locked → claimed
  const sortedEntries = Object.entries(ACHIEVEMENT_DEFS).sort(
    ([keyA], [keyB]) => {
      const getRank = (status) => {
        if (status === "unlocked") return 0;
        if (status === "locked" || !status) return 1;
        return 2; // claimed
      };
      const rankA = getRank(statusMap[keyA]);
      const rankB = getRank(statusMap[keyB]);
      return rankA - rankB;
    }
  );

  for (const [key, def] of sortedEntries) {
    const state = statusMap[key] || "locked";

    let btnText = "未完成";
    let btnClass = "btn-secondary";
    let disabled = true;

    if (state === "unlocked") {
      btnText = "領取獎勵";
      btnClass = "btn-warning";
      disabled = false;
    } else if (state === "claimed") {
      btnText = "已領取";
      btnClass = "btn-success";
    }

    const rewardStr = formatRewardText(def.reward);

    const card = document.createElement("div");
    card.className = `achievement-card ${state}`;
    card.innerHTML = `
      <h6>${def.title}</h6>
      <div class="small">${def.desc}</div>
      <div class="text-info mt-1 mb-2">🎁 ${rewardStr}</div>
      <button class="btn ${btnClass}" ${
      disabled ? "disabled" : ""
    } data-key="${key}">${btnText}</button>
    `;

    const btn = card.querySelector("button");
    if (!disabled) {
      btn.addEventListener("click", () => {
        claimAchievement(key);
        renderAchievementList(); // ✅ 點擊後重新排序 & 渲染
      });
    }

    container.appendChild(card);
  }
}

const TICKET_NAMES = {
  "ticket-map4": "魔法通行證",
  "ticket-map2": "機械通行證",
  "ticket-map3": "黃金通行證",
};

function formatRewardText(reward) {
  const parts = [];
  if (reward.money) parts.push(`金幣 +${reward.money}`);
  if (reward.refineCrystal) parts.push(`提煉結晶 +${reward.refineCrystal}`);
  if (reward.statPoint) parts.push(`能力點數 +${reward.statPoint}`);
  if (reward.mapPass)
    parts.push(`通行證：${TICKET_NAMES[reward.mapPass] || reward.mapPass}`);
  if (reward.divineMaterial) {
    for (const [k, v] of Object.entries(reward.divineMaterial)) {
      parts.push(`神化材料 ${k} +${v}`);
    }
  }
  return parts.join("，");
}

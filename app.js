const SAVE_KEY = "moonlace-arena-save-v2";

const player = document.getElementById("player");
const npcGuard = document.querySelector(".npc-guard");
const gameMap = document.getElementById("gameMap");
const mapTitle = document.getElementById("mapTitle");
const goldValue = document.getElementById("goldValue");
const hpValue = document.getElementById("hpValue");
const lootValue = document.getElementById("lootValue");
const shardValue = document.getElementById("shardValue");
const potionValue = document.getElementById("potionValue");
const xpValue = document.getElementById("xpValue");
const questValue = document.getElementById("questValue");
const locationValue = document.getElementById("locationValue");
const weaponValue = document.getElementById("weaponValue");
const charmValue = document.getElementById("charmValue");
const levelValue = document.getElementById("levelValue");
const statusValue = document.getElementById("statusValue");
const combatStatsValue = document.getElementById("combatStatsValue");
const zoneTitle = document.getElementById("zoneTitle");
const zoneText = document.getElementById("zoneText");
const inventoryList = document.getElementById("inventoryList");
const eventLog = document.getElementById("eventLog");
const interactButton = document.getElementById("interactButton");
const arenaButton = document.getElementById("arenaButton");
const talkButton = document.getElementById("talkButton");
const usePotionButton = document.getElementById("usePotionButton");
const saveButton = document.getElementById("saveButton");
const saveStatus = document.getElementById("saveStatus");
const battleScene = document.getElementById("battleScene");
const closeBattleButton = document.getElementById("closeBattleButton");
const battleMessage = document.getElementById("battleMessage");
const battlePlayerHp = document.getElementById("battlePlayerHp");
const battleEnemyHp = document.getElementById("battleEnemyHp");
const dialogScene = document.getElementById("dialogScene");
const dialogTitle = document.getElementById("dialogTitle");
const dialogText = document.getElementById("dialogText");
const closeDialogButton = document.getElementById("closeDialogButton");
const shopActions = document.getElementById("shopActions");
const enemyNameNode = document.querySelector(".fighter.enemy strong");
const enemyRoleNode = document.querySelector(".fighter.enemy .fighter-role");
const battleActionButtons = Array.from(document.querySelectorAll("[data-battle-action]"));
const shopButtons = Array.from(document.querySelectorAll("[data-shop-action]"));
const allyFighter = document.querySelector(".fighter.ally");
const enemyFighter = document.querySelector(".fighter.enemy");
const zones = Array.from(document.querySelectorAll(".zone"));
const collectibles = Array.from(document.querySelectorAll(".collectible"));
const encounterZones = Array.from(document.querySelectorAll(".encounter-zone"));

const state = {
  x: 88,
  y: 360,
  speed: 12,
  currentMap: "garden",
  moveCounter: 0,
  level: 1,
  xp: 0,
  xpToNext: 100,
  attack: 12,
  defense: 6,
  maxHp: 100,
  hp: 100,
  gold: 120,
  loot: "Silk Ribbon",
  activeQuest: "Keine aktiv",
  questStage: "none",
  lastZone: "Startwiese",
  nearbyInteractable: null,
  inventory: ["Silk Ribbon", "Petal Blade", "3x Sweet Potion"],
  weapon: "Petal Blade",
  charm: "Silk Ribbon",
  potions: 3,
  openedChest: false,
  shardsFound: [],
  sanctumCleared: false,
  arenaWins: 0,
  saveLabel: "Noch kein Speicherstand.",
  dialogContext: "npc",
  battle: {
    active: false,
    playerHp: 100,
    enemyHp: 92,
    enemyMaxHp: 92,
    enemyName: "Ruby Rival",
    enemyAttack: 14,
    enemyDefense: 4,
    guarding: false,
    busy: false
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addInventoryItem(item) {
  if (!state.inventory.includes(item)) {
    state.inventory.push(item);
  }
}

function rewritePotionInventory() {
  state.inventory = state.inventory.filter((item) => !item.endsWith("Sweet Potion"));
  state.inventory.push(`${state.potions}x Sweet Potion`);
}

function addPotion(amount) {
  state.potions += amount;
  rewritePotionInventory();
}

function renderInventory() {
  inventoryList.innerHTML = "";
  state.inventory.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    inventoryList.appendChild(entry);
  });
}

function logEvent(text) {
  const entry = document.createElement("li");
  entry.textContent = text;
  eventLog.prepend(entry);

  while (eventLog.children.length > 8) {
    eventLog.removeChild(eventLog.lastElementChild);
  }
}

function updateEvent(title, text) {
  zoneTitle.textContent = title;
  zoneText.textContent = text;
}

function updateEnemyLabels() {
  enemyNameNode.textContent = state.battle.enemyName;
  enemyRoleNode.textContent = state.currentMap === "ruins" ? "Ruins Encounter" : "Arena AI";
}

function syncUi() {
  mapTitle.textContent = state.currentMap === "garden" ? "Luna Garden" : "Moon Ruins";
  goldValue.textContent = String(state.gold);
  hpValue.textContent = `${state.hp} / ${state.maxHp}`;
  lootValue.textContent = state.loot;
  shardValue.textContent = `${state.shardsFound.length} / 3`;
  potionValue.textContent = String(state.potions);
  xpValue.textContent = `${state.xp} / ${state.xpToNext}`;
  questValue.textContent = state.activeQuest;
  locationValue.textContent = state.lastZone;
  weaponValue.textContent = state.weapon;
  charmValue.textContent = state.charm;
  levelValue.textContent = String(state.level);
  combatStatsValue.textContent = `${state.attack} / ${state.defense}`;
  statusValue.textContent = state.currentMap === "ruins" ? "Erkundet Ruinen" : "Bereit";
  saveStatus.textContent = state.saveLabel;
  usePotionButton.disabled = state.potions <= 0 || state.hp >= state.maxHp;
  renderInventory();
}

function grantXp(amount, source) {
  state.xp += amount;
  logEvent(`${amount} XP erhalten${source ? ` durch ${source}` : ""}.`);

  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext += 35;
    state.attack += 2;
    state.defense += 1;
    state.maxHp += 14;
    state.hp = state.maxHp;
    updateEvent("Level Up", `Aya erreicht Level ${state.level} und fuehlt sich deutlich staerker.`);
    logEvent(`Level Up! Aya ist jetzt Level ${state.level}.`);
  }

  syncUi();
}

function getElementCenter(element) {
  return {
    x: element.offsetLeft + element.offsetWidth / 2,
    y: element.offsetTop + element.offsetHeight / 2
  };
}

function getPlayerCenter() {
  return {
    x: state.x + player.offsetWidth / 2,
    y: state.y + player.offsetHeight / 2
  };
}

function clearNearHighlights() {
  zones.forEach((zone) => zone.classList.remove("is-near"));
  collectibles.forEach((item) => item.classList.remove("is-near"));
}

function applyMapState() {
  gameMap.classList.toggle("map-ruins", state.currentMap === "ruins");
  npcGuard.style.display = state.currentMap === "garden" ? "block" : "none";

  zones.forEach((zone) => {
    const zoneKey = zone.dataset.zone;
    const visibleInGarden = ["quest", "chest", "arena", "casino", "shop", "healer", "gate"].includes(zoneKey);
    const visibleInRuins = ["gate", "arena", "sanctum"].includes(zoneKey);
    zone.style.display = state.currentMap === "garden"
      ? (visibleInGarden ? "flex" : "none")
      : (visibleInRuins ? "flex" : "none");
  });

  collectibles.forEach((item) => {
    item.style.display = state.currentMap === "garden" ? "block" : "none";
  });
}

function describeInteractable(interactable) {
  if (!interactable) {
    updateEvent(
      state.currentMap === "garden" ? "Luna Garden" : "Moon Ruins",
      state.currentMap === "garden"
        ? "Laufe zu einer Zone oder einem Mondsplitter und druecke E."
        : "Die Ruinen wirken gefaehrlich. Laufe weiter oder suche das Tor zurueck."
    );
    return;
  }

  if (interactable.dataset.zone) {
    const currentZone = zoneData[interactable.dataset.zone];
    updateEvent(currentZone.title, `${currentZone.intro} Druecke E fuer Interaktion.`);
    return;
  }

  updateEvent("Mondsplitter", "Ein schimmernder Splitter. Mit Quest aktiv kannst du ihn einsammeln.");
}

function updateNearbyInteractable() {
  const playerCenter = getPlayerCenter();
  const candidates = [];

  zones.forEach((zone) => {
    if (zone.style.display === "none") {
      return;
    }

    const center = getElementCenter(zone);
    const distance = Math.hypot(playerCenter.x - center.x, playerCenter.y - center.y);
    candidates.push({ element: zone, distance, threshold: 105 });
  });

  collectibles.forEach((item) => {
    if (item.classList.contains("is-found") || item.style.display === "none") {
      return;
    }

    const center = getElementCenter(item);
    const distance = Math.hypot(playerCenter.x - center.x, playerCenter.y - center.y);
    candidates.push({ element: item, distance, threshold: 72 });
  });

  clearNearHighlights();

  let nearest = null;
  candidates.forEach((candidate) => {
    if (candidate.distance <= candidate.threshold) {
      if (!nearest || candidate.distance < nearest.distance) {
        nearest = candidate;
      }
    }
  });

  state.nearbyInteractable = nearest ? nearest.element : null;

  if (state.nearbyInteractable) {
    state.nearbyInteractable.classList.add("is-near");
  }

  describeInteractable(state.nearbyInteractable);
}

function renderPlayer() {
  player.style.left = `${state.x}px`;
  player.style.top = `${state.y}px`;
  updateNearbyInteractable();
}

function maybeTriggerEncounter() {
  if (state.currentMap !== "ruins" || state.battle.active || !dialogScene.classList.contains("hidden")) {
    return;
  }

  const playerCenter = getPlayerCenter();
  const insideDangerZone = encounterZones.some((zone) => {
    const left = zone.offsetLeft;
    const top = zone.offsetTop;
    const right = left + zone.offsetWidth;
    const bottom = top + zone.offsetHeight;
    return playerCenter.x >= left && playerCenter.x <= right && playerCenter.y >= top && playerCenter.y <= bottom;
  });

  if (!insideDangerZone) {
    return;
  }

  if (state.moveCounter % 8 === 0 && Math.random() > 0.55) {
    state.lastZone = "Moon Ruins";
    logEvent("Ein Ruin Wisp greift aus dem Nebel an.");
    openBattle();
    syncUi();
  }
}

function movePlayer(dx, dy) {
  if (state.battle.active || !dialogScene.classList.contains("hidden")) {
    return;
  }

  const maxX = gameMap.clientWidth - player.offsetWidth;
  const maxY = gameMap.clientHeight - player.offsetHeight;

  state.x = clamp(state.x + dx, 0, maxX);
  state.y = clamp(state.y + dy, 0, maxY);
  state.moveCounter += 1;

  player.classList.add("is-moving");
  clearTimeout(movePlayer.cooldown);
  movePlayer.cooldown = setTimeout(() => {
    player.classList.remove("is-moving");
  }, 120);

  renderPlayer();
  maybeTriggerEncounter();
}

function collectShard(element) {
  if (state.questStage !== "active") {
    updateEvent("Mondsplitter", "Der Splitter reagiert, aber Aya braucht erst die Quest.");
    logEvent("Aya findet einen Mondsplitter, nimmt aber noch keine Energie auf.");
    return;
  }

  const id = element.dataset.collectible;
  if (state.shardsFound.includes(id)) {
    return;
  }

  state.shardsFound.push(id);
  element.classList.add("is-found");
  state.loot = "Moon Shard";
  updateEvent("Mondsplitter gesichert", `Aya sammelt einen Splitter. Fortschritt: ${state.shardsFound.length} von 3.`);
  logEvent(`Mondsplitter gesammelt: ${state.shardsFound.length}/3.`);

  if (state.shardsFound.length === 3) {
    state.activeQuest = "Kehre zum Quest-Pavillon zurueck";
    updateEvent("Quest fast fertig", "Alle Mondsplitter sind gesammelt. Kehre jetzt zur Priesterin zurueck.");
    logEvent("Alle Mondsplitter gefunden.");
  }

  syncUi();
  updateNearbyInteractable();
}

function openDialog(title, text, context = "npc") {
  state.dialogContext = context;
  dialogTitle.textContent = title;
  dialogText.textContent = text;
  shopActions.classList.toggle("hidden", context !== "shop");
  dialogScene.classList.remove("hidden");
  dialogScene.setAttribute("aria-hidden", "false");
}

function closeDialog() {
  dialogScene.classList.add("hidden");
  dialogScene.setAttribute("aria-hidden", "true");
  shopActions.classList.add("hidden");
}

function talkToNpc() {
  if (state.currentMap !== "garden") {
    updateEvent("Moon Ruins", "Hier ist kein freundlicher NPC, nur Nebel und Gefahren.");
    return;
  }

  const playerCenter = getPlayerCenter();
  const npcCenter = getElementCenter(npcGuard);
  const distance = Math.hypot(playerCenter.x - npcCenter.x, playerCenter.y - npcCenter.y);

  if (distance > 96) {
    updateEvent("Wachposten", "Laufe naeher an den Wachposten links vom Dorfpfad.");
    logEvent("Aya ruft zum Wachposten, ist aber zu weit entfernt.");
    return;
  }

  let text = "Der Wachposten gruessst Aya. Die Arena ist heute besonders belebt.";

  if (state.questStage === "none") {
    text = "Der Wachposten deutet zum Quest-Pavillon. Dort beginnt dein kleines Abenteuer.";
  } else if (state.questStage === "active" && state.shardsFound.length < 3) {
    text = `Noch ${3 - state.shardsFound.length} Mondsplitter, dann wird die Priesterin zufrieden sein.`;
  } else if (state.questStage === "turned-in") {
    text = "Mit dem Moon Charm wirst du in den Ruinen bestehen. Tief dort liegt das Moon Sanctum.";
  } else if (state.questStage === "sanctum") {
    text = "Wenn das Sanctum wirklich gereinigt ist, solltest du sofort zur Priesterin zurueckkehren.";
  } else if (state.questStage === "complete") {
    text = "Ganz Moonlace spricht schon ueber Aya und das gereinigte Sanctum.";
  }

  openDialog("Wachposten Riku", text, "npc");
  logEvent("Aya spricht mit Wachposten Riku.");
}

function saveGame() {
  const payload = {
    x: state.x,
    y: state.y,
    currentMap: state.currentMap,
    level: state.level,
    xp: state.xp,
    xpToNext: state.xpToNext,
    maxHp: state.maxHp,
    hp: state.hp,
    gold: state.gold,
    loot: state.loot,
    activeQuest: state.activeQuest,
    questStage: state.questStage,
    sanctumCleared: state.sanctumCleared,
    lastZone: state.lastZone,
    inventory: state.inventory,
    weapon: state.weapon,
    charm: state.charm,
    potions: state.potions,
    openedChest: state.openedChest,
    shardsFound: state.shardsFound,
    arenaWins: state.arenaWins,
    collectedIds: collectibles
      .filter((item) => item.classList.contains("is-found"))
      .map((item) => item.dataset.collectible)
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  state.saveLabel = `Gespeichert: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  logEvent("Spielstand gespeichert.");
  syncUi();
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return;
  }

  try {
    const saved = JSON.parse(raw);
    Object.assign(state, {
      x: saved.x ?? state.x,
      y: saved.y ?? state.y,
      currentMap: saved.currentMap ?? state.currentMap,
      level: saved.level ?? state.level,
      xp: saved.xp ?? state.xp,
      xpToNext: saved.xpToNext ?? state.xpToNext,
      maxHp: saved.maxHp ?? state.maxHp,
      hp: saved.hp ?? state.hp,
      gold: saved.gold ?? state.gold,
      loot: saved.loot ?? state.loot,
      activeQuest: saved.activeQuest ?? state.activeQuest,
      questStage: saved.questStage ?? state.questStage,
      sanctumCleared: saved.sanctumCleared ?? state.sanctumCleared,
      lastZone: saved.lastZone ?? state.lastZone,
      inventory: saved.inventory ?? state.inventory,
      weapon: saved.weapon ?? state.weapon,
      charm: saved.charm ?? state.charm,
      potions: saved.potions ?? state.potions,
      openedChest: saved.openedChest ?? state.openedChest,
      shardsFound: saved.shardsFound ?? state.shardsFound,
      arenaWins: saved.arenaWins ?? state.arenaWins,
      saveLabel: "Speicherstand geladen."
    });

    collectibles.forEach((item) => {
      item.classList.toggle("is-found", (saved.collectedIds ?? []).includes(item.dataset.collectible));
    });

    applyMapState();
    logEvent("Spielstand geladen.");
  } catch {
    state.saveLabel = "Speicherstand konnte nicht geladen werden.";
  }
}

function usePotion() {
  if (state.potions <= 0 || state.hp >= state.maxHp) {
    updateEvent("Sweet Potion", "Gerade bringt eine Potion nichts.");
    return;
  }

  state.potions -= 1;
  state.hp = Math.min(state.maxHp, state.hp + 30);
  state.loot = "Sweet Potion";
  rewritePotionInventory();
  updateEvent("Heilung", "Aya trinkt eine Sweet Potion und regeneriert 30 HP.");
  logEvent("Potion genutzt: +30 HP.");
  syncUi();
}

function setBattleButtonsDisabled(disabled) {
  battleActionButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function syncBattleBars() {
  battlePlayerHp.style.width = `${Math.max(0, state.battle.playerHp / state.maxHp * 100)}%`;
  battleEnemyHp.style.width = `${Math.max(0, state.battle.enemyHp / state.battle.enemyMaxHp * 100)}%`;
}

function openBattle() {
  const isRuins = state.currentMap === "ruins";
  const isSanctum = isRuins && state.lastZone === "Moon Sanctum";
  const enemyMaxHp = (isSanctum ? 150 : isRuins ? 110 : 92) + state.arenaWins * 14;
  state.battle.active = true;
  state.battle.busy = false;
  state.battle.guarding = false;
  state.battle.playerHp = Math.max(40, state.hp);
  state.battle.enemyHp = enemyMaxHp;
  state.battle.enemyMaxHp = enemyMaxHp;
  if (isSanctum) {
    state.battle.enemyName = "Ruin Sentinel";
    state.battle.enemyAttack = 20 + state.level;
    state.battle.enemyDefense = 8;
  } else if (isRuins) {
    state.battle.enemyName = Math.random() > 0.5 ? "Ruin Wisp" : "Shade Wolf";
    state.battle.enemyAttack = 14 + state.level;
    state.battle.enemyDefense = 4;
  } else {
    state.battle.enemyName = "Ruby Rival";
    state.battle.enemyAttack = 13 + state.arenaWins;
    state.battle.enemyDefense = 5 + Math.floor(state.arenaWins / 2);
  }
  battleMessage.textContent = isSanctum
    ? "Der Ruin Sentinel erwacht im Sanctum."
    : isRuins
    ? `${state.battle.enemyName} springt aus dem Nebel.`
    : state.arenaWins > 0
      ? `Ruby Rival kehrt staerker zurueck. Runde ${state.arenaWins + 1}.`
      : "Ruby Rival fordert Aya heraus.";
  updateEnemyLabels();
  battleScene.classList.remove("hidden");
  battleScene.setAttribute("aria-hidden", "false");
  setBattleButtonsDisabled(false);
  syncBattleBars();
}

function closeBattle() {
  state.battle.active = false;
  state.battle.busy = false;
  battleScene.classList.add("hidden");
  battleScene.setAttribute("aria-hidden", "true");
}

function endBattle(victory) {
  setBattleButtonsDisabled(true);
  state.battle.busy = true;

  if (victory) {
    state.hp = state.battle.playerHp;

    if (state.currentMap === "ruins") {
      if (state.lastZone === "Moon Sanctum") {
        state.gold += 90;
        state.loot = "Sanctum Sigil";
        state.charm = "Sanctum Sigil";
        state.attack += 3;
        state.defense += 2;
        state.sanctumCleared = true;
        if (state.questStage === "turned-in" || state.questStage === "sanctum") {
          state.questStage = "sanctum";
          state.activeQuest = "Berichte der Priesterin vom gereinigten Sanctum";
        }
        addInventoryItem("Sanctum Sigil");
        battleMessage.textContent = "Sieg! Der Ruin Sentinel hinterlaesst ein Sanctum Sigil.";
        logEvent("Sanctum-Boss besiegt: Sanctum Sigil erhalten.");
        updateEvent("Sanctum geklaert", "Aya bezwingt den Ruin Sentinel und findet ein uraltes Sigil.");
        grantXp(65, "Ruin Sentinel");
      } else {
        state.gold += 26;
        state.loot = "Ruin Dust";
        addInventoryItem("Ruin Dust");
        battleMessage.textContent = `Sieg! ${state.battle.enemyName} hinterlaesst Ruin Dust.`;
        logEvent(`Zufallskampf gewonnen gegen ${state.battle.enemyName}.`);
        updateEvent("Ruinensieg", "Aya uebersteht den Hinterhalt in den Moon Ruins.");
        grantXp(26, state.battle.enemyName);
      }
    } else {
      state.arenaWins += 1;
      state.gold += 55 + state.arenaWins * 5;
      state.loot = "Arena Crest";
      state.weapon = state.arenaWins >= 2 ? "Moonflare Saber" : "Starlace Saber";
      addInventoryItem("Arena Crest");
      addInventoryItem(state.weapon);
      if (state.arenaWins % 2 === 0) {
        addPotion(1);
      }
      battleMessage.textContent = `Sieg! Arena-Wins: ${state.arenaWins}.`;
      logEvent(`Arena gewonnen. Gesamt-Siege: ${state.arenaWins}.`);
      updateEvent("Arena-Sieg", "Aya schlaegt Ruby Rival und verbessert ihren Arenaruf.");
      state.lastZone = "Crystal Arena";
      grantXp(40 + state.arenaWins * 5, "Arena");
    }
  } else {
    state.hp = Math.max(35, state.hp - 25);
    battleMessage.textContent = "Aya wird zurueckgedraengt, bleibt aber kampfbereit.";
    logEvent("Kampf verloren. Aya zieht sich kurz zurueck.");
    updateEvent("Niederlage", "Aya verliert die Runde, aber ein neuer Versuch ist jederzeit moeglich.");
  }

  syncUi();
  setTimeout(() => {
    state.battle.busy = false;
    closeBattle();
  }, 1400);
}

function enemyTurn() {
  if (!state.battle.active || state.battle.enemyHp <= 0) {
    return;
  }

  const baseDamage = randomInt(10 + state.arenaWins, 18 + state.arenaWins);
  const adjustedDamage = Math.max(4, baseDamage + state.battle.enemyAttack - state.defense);
  const damage = state.battle.guarding ? Math.ceil(adjustedDamage / 2) : adjustedDamage;
  state.battle.guarding = false;
  state.battle.playerHp = Math.max(0, state.battle.playerHp - damage);
  state.hp = state.battle.playerHp;
  enemyFighter.classList.add("is-casting");
  allyFighter.classList.add("is-hit");
  battleMessage.textContent = `${state.battle.enemyName} trifft Aya fuer ${damage} Schaden.`;
  syncBattleBars();
  syncUi();

  setTimeout(() => {
    enemyFighter.classList.remove("is-casting");
    allyFighter.classList.remove("is-hit");

    if (state.battle.playerHp <= 0) {
      endBattle(false);
      return;
    }

    state.battle.busy = false;
    setBattleButtonsDisabled(false);
  }, 350);
}

function performBattleAction(action) {
  if (!state.battle.active || state.battle.busy) {
    return;
  }

  state.battle.busy = true;
  setBattleButtonsDisabled(true);
  allyFighter.classList.add("is-casting");

  let damage = 0;

  if (action === "attack") {
    damage = Math.max(6, randomInt(8, 14) + state.attack - state.battle.enemyDefense);
    battleMessage.textContent = `Aya schneidet mit ${state.weapon} fuer ${damage} Schaden.`;
  }

  if (action === "skill") {
    damage = Math.max(10, randomInt(14, 22) + state.attack - Math.floor(state.battle.enemyDefense / 2));
    battleMessage.textContent = `Moon Slash trifft mit glitzernder Klinge fuer ${damage} Schaden.`;
  }

  if (action === "heal") {
    if (state.potions <= 0) {
      battleMessage.textContent = "Keine Potion mehr verfuegbar.";
      state.battle.busy = false;
      setBattleButtonsDisabled(false);
      allyFighter.classList.remove("is-casting");
      return;
    }

    state.potions -= 1;
    state.battle.playerHp = Math.min(state.maxHp, state.battle.playerHp + 28);
    state.hp = state.battle.playerHp;
    rewritePotionInventory();
    battleMessage.textContent = "Aya nutzt eine Potion in der Arena und heilt 28 HP.";
    syncUi();
  }

  if (action === "guard") {
    state.battle.guarding = true;
    battleMessage.textContent = "Aya nimmt Guard-Haltung ein. Der naechste Treffer wird gemildert.";
  } else if (action !== "heal") {
    state.battle.enemyHp = Math.max(0, state.battle.enemyHp - damage);
    enemyFighter.classList.add("is-hit");
  }

  syncBattleBars();

  setTimeout(() => {
    allyFighter.classList.remove("is-casting");
    enemyFighter.classList.remove("is-hit");

    if (state.battle.enemyHp <= 0) {
      endBattle(true);
      return;
    }

    battleMessage.textContent += " Gegenzug folgt.";
    setTimeout(enemyTurn, 360);
  }, 320);
}

function handleShopAction(action) {
  if (action === "potion") {
    if (state.gold < 20) {
      dialogText.textContent = "Nicht genug Gold fuer eine Potion.";
      return;
    }

    state.gold -= 20;
    addPotion(1);
    dialogText.textContent = "Eine Sweet Potion wandert in dein Inventar.";
    logEvent("Shop: Potion gekauft.");
    syncUi();
    return;
  }

  if (action === "blade") {
    if (state.gold < 60) {
      dialogText.textContent = "Nicht genug Gold fuer das Blade-Upgrade.";
      return;
    }

    if (state.weapon === "Rosefang Blade") {
      dialogText.textContent = "Deine Klinge ist hier schon maximal verbessert.";
      return;
    }

    state.gold -= 60;
    state.weapon = "Rosefang Blade";
    addInventoryItem("Rosefang Blade");
    dialogText.textContent = "Deine Klinge wurde zu Rosefang Blade veredelt.";
    logEvent("Shop: Rosefang Blade freigeschaltet.");
    syncUi();
  }
}

const zoneData = {
  quest: {
    title: "Quest-Pavillon",
    intro: "Die Priesterin sucht drei Mondsplitter im Garten.",
    action() {
      state.lastZone = "Quest-Pavillon";

      if (state.questStage === "none") {
        state.questStage = "active";
        state.activeQuest = "Sammle 3 Mondsplitter fuer die Priesterin";
        updateEvent("Quest angenommen", "Die Suche beginnt. Drei Mondsplitter funkeln ueber den Garten verteilt.");
        logEvent("Neue Quest: Sammle 3 Mondsplitter.");
        syncUi();
        return;
      }

      if (state.questStage === "active" && state.shardsFound.length < 3) {
        updateEvent("Quest offen", `Dir fehlen noch ${3 - state.shardsFound.length} Mondsplitter.`);
        logEvent("Aya prueft die Quest und sucht weiter.");
        return;
      }

      if (state.questStage === "active" && state.shardsFound.length === 3) {
        state.questStage = "turned-in";
        state.activeQuest = "Untersuche das Moon Sanctum";
        state.gold += 70;
        state.loot = "Moon Charm";
        state.charm = "Moon Charm";
        addInventoryItem("Moon Charm");
        addPotion(1);
        updateEvent("Neue Spur", "Die Priesterin belohnt Aya und bittet dich nun, das Moon Sanctum in den Ruinen zu reinigen.");
        logEvent("Quest erweitert: Moon Sanctum untersuchen.");
        syncUi();
        return;
      }

      if (state.questStage === "sanctum" && state.sanctumCleared) {
        state.questStage = "complete";
        state.activeQuest = "Heiligtum gereinigt";
        state.gold += 120;
        state.loot = "Priestess Emblem";
        state.charm = "Priestess Emblem";
        state.attack += 2;
        state.defense += 2;
        addInventoryItem("Priestess Emblem");
        updateEvent("Story Quest beendet", "Die Priesterin segnet Aya nach dem Sieg im Sanctum mit einem Priestess Emblem.");
        logEvent("Hauptquest abgeschlossen: Priestess Emblem erhalten.");
        grantXp(90, "Hauptquest");
        syncUi();
        return;
      }

      updateEvent("Quest-Pavillon", "Die Priesterin laechelt. Spaeter koennen wir hier taegliche Missionen einbauen.");
      logEvent("Aya ruht sich kurz am Quest-Pavillon aus.");
    }
  },
  chest: {
    title: "Glitzertruhe",
    intro: "Eine goldene Truhe wartet unter rosa Licht.",
    action() {
      state.lastZone = "Glitzertruhe";

      if (state.openedChest) {
        updateEvent("Truhe leer", "Die Truhe ist bereits gepluendert. Spaeter koennen Respawns oder Dungeons folgen.");
        logEvent("Aya findet nur noch funkelnden Staub in der leeren Truhe.");
        return;
      }

      state.openedChest = true;
      state.gold += 35;
      state.loot = "Velvet Boots";
      addInventoryItem("Velvet Boots");
      addPotion(1);
      updateEvent("Beute gefunden", "Aya oeffnet die Truhe und zieht Velvet Boots, 35 Gold und eine Potion heraus.");
      logEvent("Truhe geoeffnet: Velvet Boots, 35 Gold und Potion.");
      syncUi();
    }
  },
  arena: {
    title: "Crystal Arena",
    intro: "Hier startet ein kompakter PvE-Arenakampf.",
    action() {
      state.lastZone = state.currentMap === "garden" ? "Crystal Arena" : "Moon Ruins";
      updateEvent("Arena bereit", "Die Kristallarena oeffnet sich. Teste direkt den kleinen Kampfmodus.");
      logEvent("Aya betritt eine Kampfszene.");
      openBattle();
      syncUi();
    }
  },
  casino: {
    title: "Lucky Petal Casino",
    intro: "Ein kleiner Glamour-Ort fuer Risiko und Gold.",
    action() {
      state.lastZone = "Lucky Petal Casino";
      const win = Math.random() > 0.48;
      const amount = win ? 18 : -12;
      state.gold = Math.max(0, state.gold + amount);
      updateEvent(
        win ? "Jackpot-Licht" : "Fast gewonnen",
        win ? "Aya zieht 18 Gold aus dem Blumenautomaten." : "Aya verliert 12 Gold beim schnellen Versuch."
      );
      logEvent(win ? "Casino: +18 Gold." : "Casino: -12 Gold.");
      syncUi();
    }
  },
  shop: {
    title: "Petal Boutique",
    intro: "Die Boutique verkauft Potions und ein Blade-Upgrade.",
    action() {
      state.lastZone = "Petal Boutique";
      openDialog(
        "Petal Boutique",
        "Willkommen. Fuer dein kleines RPG-Abenteuer bekommst du hier Potions oder ein Blade-Upgrade.",
        "shop"
      );
      logEvent("Aya schaut in der Petal Boutique vorbei.");
      syncUi();
    }
  },
  healer: {
    title: "Moon Heilerin",
    intro: "Eine sanfte Heilerin stellt HP wieder her.",
    action() {
      state.lastZone = "Moon Heilerin";
      if (state.hp >= state.maxHp) {
        updateEvent("Heilerin", "Aya strahlt bereits vor voller Energie.");
        logEvent("Die Heilerin laechelt. Heilung ist gerade nicht noetig.");
        return;
      }

      state.hp = state.maxHp;
      state.loot = "Blessing Dew";
      updateEvent("Heiliger Segen", "Die Heilerin stellt Ayas HP voll wieder her.");
      logEvent("Aya wurde voll geheilt.");
      syncUi();
    }
  },
  sanctum: {
    title: "Moon Sanctum",
    intro: "Ein uraltes Heiligtum mit einem staerkeren Ruinenwaechter.",
    action() {
      state.lastZone = "Moon Sanctum";
      updateEvent("Moon Sanctum", "Ein uraltes Siegel flackert auf. Der Waechter erwacht.");
      logEvent("Aya betritt das Moon Sanctum.");
      openBattle();
      syncUi();
    }
  },
  gate: {
    title: "Moon Gate",
    intro: "Ein schimmerndes Tor fuehrt zwischen Garten und Ruinen.",
    action() {
      if (state.currentMap === "garden") {
        state.currentMap = "ruins";
        state.lastZone = "Moon Ruins";
        state.x = 86;
        state.y = 420;
        updateEvent("Moon Ruins", "Aya tritt durch das Tor in die Moon Ruins. Hier warten Zufallskaempfe.");
        logEvent("Gebietswechsel: Moon Ruins.");
      } else {
        state.currentMap = "garden";
        state.lastZone = "Luna Garden";
        state.x = 336;
        state.y = 420;
        updateEvent("Luna Garden", "Aya kehrt in den Garten zurueck.");
        logEvent("Gebietswechsel: Luna Garden.");
      }

      applyMapState();
      syncUi();
      renderPlayer();
    }
  }
};

function activateZone(zoneKey) {
  const zone = zoneData[zoneKey];
  if (zone) {
    zone.action();
  }
}

function activateNearby() {
  if (!state.nearbyInteractable) {
    updateEvent(
      state.currentMap === "garden" ? "Luna Garden" : "Moon Ruins",
      "Nichts in Reichweite. Laufe naeher an einen Ort oder einen Splitter."
    );
    return;
  }

  if (state.nearbyInteractable.dataset.zone) {
    activateZone(state.nearbyInteractable.dataset.zone);
    return;
  }

  collectShard(state.nearbyInteractable);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e"].includes(key)) {
    event.preventDefault();
  }

  if (state.battle.active) {
    if (key === "escape") {
      closeBattle();
    }
    return;
  }

  if (!dialogScene.classList.contains("hidden")) {
    if (key === "escape") {
      closeDialog();
    }
    return;
  }

  if (key === "arrowup" || key === "w") movePlayer(0, -state.speed);
  if (key === "arrowdown" || key === "s") movePlayer(0, state.speed);
  if (key === "arrowleft" || key === "a") movePlayer(-state.speed, 0);
  if (key === "arrowright" || key === "d") movePlayer(state.speed, 0);
  if (key === "e") activateNearby();
});

zones.forEach((zone) => {
  zone.addEventListener("click", () => {
    activateZone(zone.dataset.zone);
  });
});

collectibles.forEach((item) => {
  item.addEventListener("click", () => {
    collectShard(item);
  });
});

interactButton.addEventListener("click", activateNearby);
arenaButton.addEventListener("click", openBattle);
talkButton.addEventListener("click", talkToNpc);
usePotionButton.addEventListener("click", usePotion);
saveButton.addEventListener("click", saveGame);
closeBattleButton.addEventListener("click", closeBattle);
closeDialogButton.addEventListener("click", closeDialog);

battleActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    performBattleAction(button.dataset.battleAction);
  });
});

shopButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleShopAction(button.dataset.shopAction);
  });
});

window.addEventListener("resize", renderPlayer);

loadGame();
applyMapState();
syncUi();
updateEnemyLabels();
syncBattleBars();
renderPlayer();

const player = document.getElementById("player");
const gameMap = document.getElementById("gameMap");
const goldValue = document.getElementById("goldValue");
const zoneTitle = document.getElementById("zoneTitle");
const zoneText = document.getElementById("zoneText");
const questValue = document.getElementById("questValue");
const locationValue = document.getElementById("locationValue");
const zones = Array.from(document.querySelectorAll(".zone"));

const state = {
  x: 80,
  y: 360,
  speed: 12,
  gold: 120,
  activeQuest: "Keine aktiv",
  lastZone: "Startwiese",
  nearbyZone: null,
  openedChest: false
};

const zoneData = {
  quest: {
    title: "Quest-Pavillon",
    intro: "Hier kannst du eine kleine Mission annehmen.",
    action: () => {
      state.activeQuest = "Sammle Mondsplitter im Garten";
      state.lastZone = "Quest-Pavillon";
      questValue.textContent = state.activeQuest;
      updateEvent(
        "Quest angenommen",
        "Aya hat die Mission 'Sammle Mondsplitter im Garten' angenommen."
      );
    }
  },
  chest: {
    title: "Glitzertruhe",
    intro: "Eine goldene Truhe wartet auf mutige Spielerinnen.",
    action: () => {
      state.lastZone = "Glitzertruhe";
      if (state.openedChest) {
        updateEvent("Truhe leer", "Die Truhe ist schon geoeffnet. Spaeter koennen wir Respawns einbauen.");
        return;
      }

      state.openedChest = true;
      state.gold += 35;
      syncStats();
      updateEvent("Beute gefunden", "Aya oeffnet die Truhe und findet 35 Gold sowie funkelnden Staub.");
    }
  },
  arena: {
    title: "Crystal Arena",
    intro: "Hier startet spaeter der animierte Kampfmodus fuer PvE und PvP.",
    action: () => {
      state.lastZone = "Crystal Arena";
      updateEvent("Arena bereit", "Die Arena wurde markiert. Als naechstes bauen wir hier den ersten Kampfbildschirm.");
    }
  },
  casino: {
    title: "Lucky Petal Casino",
    intro: "Eine charmante Gluecksspiel-Ecke mit sanften Farben und Risiko.",
    action: () => {
      state.lastZone = "Lucky Petal Casino";
      const win = Math.random() > 0.5;
      const amount = win ? 12 : -10;
      state.gold = Math.max(0, state.gold + amount);
      syncStats();
      updateEvent(
        win ? "Jackpot-Licht" : "Fast gewonnen",
        win
          ? "Aya gewinnt 12 Gold im Blumenautomaten."
          : "Aya verliert 10 Gold beim schnellen Versuch."
      );
    }
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncStats() {
  goldValue.textContent = String(state.gold);
  questValue.textContent = state.activeQuest;
  locationValue.textContent = state.lastZone;
}

function updateEvent(title, text) {
  zoneTitle.textContent = title;
  zoneText.textContent = text;
  locationValue.textContent = state.lastZone;
}

function getPlayerCenter() {
  return {
    x: state.x + player.offsetWidth / 2,
    y: state.y + player.offsetHeight / 2
  };
}

function getZoneCenter(zone) {
  return {
    x: zone.offsetLeft + zone.offsetWidth / 2,
    y: zone.offsetTop + zone.offsetHeight / 2
  };
}

function updateNearbyZone() {
  const playerCenter = getPlayerCenter();
  let nearest = null;
  let nearestDistance = Infinity;

  zones.forEach((zone) => {
    const zoneCenter = getZoneCenter(zone);
    const distance = Math.hypot(playerCenter.x - zoneCenter.x, playerCenter.y - zoneCenter.y);

    zone.classList.remove("is-near");

    if (distance < nearestDistance) {
      nearest = zone;
      nearestDistance = distance;
    }
  });

  state.nearbyZone = nearestDistance <= 105 ? nearest : null;

  if (state.nearbyZone) {
    state.nearbyZone.classList.add("is-near");
    const currentZone = zoneData[state.nearbyZone.dataset.zone];
    updateEvent(currentZone.title, `${currentZone.intro} Druecke E fuer Interaktion.`);
  } else {
    updateEvent("Luna Garden", "Laufe zu einer Zone und druecke die Taste E oder klicke direkt auf den Ort.");
  }
}

function activateZone(zoneKey) {
  const currentZone = zoneData[zoneKey];
  if (!currentZone) return;
  currentZone.action();
  syncStats();
}

function renderPlayer() {
  player.style.left = `${state.x}px`;
  player.style.top = `${state.y}px`;
  updateNearbyZone();
}

function movePlayer(dx, dy) {
  const maxX = gameMap.clientWidth - player.offsetWidth;
  const maxY = gameMap.clientHeight - player.offsetHeight;

  state.x = clamp(state.x + dx, 0, maxX);
  state.y = clamp(state.y + dy, 0, maxY);

  player.classList.add("is-moving");
  window.clearTimeout(movePlayer.cooldown);
  movePlayer.cooldown = window.setTimeout(() => {
    player.classList.remove("is-moving");
  }, 120);

  renderPlayer();
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") movePlayer(0, -state.speed);
  if (key === "arrowdown" || key === "s") movePlayer(0, state.speed);
  if (key === "arrowleft" || key === "a") movePlayer(-state.speed, 0);
  if (key === "arrowright" || key === "d") movePlayer(state.speed, 0);
  if (key === "e" && state.nearbyZone) activateZone(state.nearbyZone.dataset.zone);
});

zones.forEach((zone) => {
  zone.addEventListener("click", () => {
    activateZone(zone.dataset.zone);
  });
});

window.addEventListener("resize", renderPlayer);

syncStats();
renderPlayer();

const bagPresets = [
  {
    id: "brown-flat-18x22",
    name: "18 x 22 cm Braun",
    width: 180,
    height: 220,
    paper: "70 g Papier",
    color: "#9e7c4c",
    accent: "#7a5d34",
    handle: "Flachgriff",
  },
  {
    id: "brown-flat-32x40",
    name: "32 x 40 cm Braun",
    width: 320,
    height: 400,
    paper: "80 g Papier",
    color: "#9d7a4e",
    accent: "#805f37",
    handle: "Flachgriff",
  },
  {
    id: "brown-cord-32x41",
    name: "32 x 41 cm Braun",
    width: 320,
    height: 410,
    paper: "90 g Papier",
    color: "#a78657",
    accent: "#89683c",
    handle: "Kordelgriff",
  },
  {
    id: "white-cord-32x44",
    name: "32 x 44 cm Weiss",
    width: 320,
    height: 440,
    paper: "100 g Papier",
    color: "#ece7df",
    accent: "#cac1b6",
    handle: "Kordelgriff",
  },
  {
    id: "green-cord-45x50",
    name: "45 x 50 cm Dunkelgrün",
    width: 450,
    height: 500,
    paper: "100 g Papier",
    color: "#486041",
    accent: "#33472d",
    handle: "Kordelgriff",
  },
  {
    id: "gray-cord-54x45",
    name: "54 x 45 cm Grau",
    width: 540,
    height: 450,
    paper: "120 g Papier",
    color: "#9a9a96",
    accent: "#7a7a74",
    handle: "Kordelgriff",
  },
];

const bagSelect = document.querySelector("#bag-select");
const bagMeta = document.querySelector("#bag-meta");
const bagName = document.querySelector("#bag-name");
const bagElement = document.querySelector("#bag");
const logoUpload = document.querySelector("#logo-upload");
const logoLayer = document.querySelector("#logo-layer");
const printArea = document.querySelector("#print-area");
const printPlaceholder = document.querySelector("#print-placeholder");
const resetLogoButton = document.querySelector("#reset-logo");
const logoScaleSlider = document.querySelector("#logo-scale");
const scaleValue = document.querySelector("#scale-value");
const statusText = document.querySelector("#status-text");
const printAreaMm = document.querySelector("#print-area-mm");
const logoSizeMm = document.querySelector("#logo-size-mm");
const gapLeftMm = document.querySelector("#gap-left-mm");
const gapRightMm = document.querySelector("#gap-right-mm");
const gapTopMm = document.querySelector("#gap-top-mm");
const gapBottomMm = document.querySelector("#gap-bottom-mm");
const measureTop = document.querySelector("#measure-top");
const measureRight = document.querySelector("#measure-right");
const measureBottom = document.querySelector("#measure-bottom");
const measureLeft = document.querySelector("#measure-left");

const LOGO_MAX_HEIGHT_RATIO = 0.92;

const logoState = {
  src: "",
  widthRatio: 0.54,
  x: 0,
  y: 0,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  naturalWidth: 1,
  naturalHeight: 1,
};

function renderPresetOptions() {
  bagPresets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    bagSelect.append(option);
  });
}

function getPresetDefinitions() {
  return [
    {
      id: "brown-flat-18x22",
      name: "18 x 22 cm Braun",
      width: 180,
      height: 220,
      paper: "70 g Papier",
      color: "#9e7c4c",
      accent: "#7a5d34",
      handle: "Flachgriff",
      printWidthMm: 110,
      printHeightMm: 95,
    },
    {
      id: "brown-flat-32x40",
      name: "32 x 40 cm Braun",
      width: 320,
      height: 400,
      paper: "80 g Papier",
      color: "#9d7a4e",
      accent: "#805f37",
      handle: "Flachgriff",
      printWidthMm: 205,
      printHeightMm: 155,
    },
    {
      id: "brown-cord-32x41",
      name: "32 x 41 cm Braun",
      width: 320,
      height: 410,
      paper: "90 g Papier",
      color: "#a78657",
      accent: "#89683c",
      handle: "Kordelgriff",
      printWidthMm: 200,
      printHeightMm: 170,
    },
    {
      id: "white-cord-32x44",
      name: "32 x 44 cm Weiss",
      width: 320,
      height: 440,
      paper: "100 g Papier",
      color: "#ece7df",
      accent: "#cac1b6",
      handle: "Kordelgriff",
      printWidthMm: 205,
      printHeightMm: 185,
    },
    {
      id: "green-cord-45x50",
      name: "45 x 50 cm Dunkelgrün",
      width: 450,
      height: 500,
      paper: "100 g Papier",
      color: "#486041",
      accent: "#33472d",
      handle: "Kordelgriff",
      printWidthMm: 300,
      printHeightMm: 220,
    },
    {
      id: "gray-cord-54x45",
      name: "54 x 45 cm Grau",
      width: 540,
      height: 450,
      paper: "120 g Papier",
      color: "#9a9a96",
      accent: "#7a7a74",
      handle: "Kordelgriff",
      printWidthMm: 360,
      printHeightMm: 205,
    },
  ];
}

bagPresets.splice(0, bagPresets.length, ...getPresetDefinitions());

function applyPreset(presetId) {
  const preset = bagPresets.find((entry) => entry.id === presetId) ?? bagPresets[0];

  bagName.textContent = preset.name;
  bagMeta.textContent = `${preset.width / 10} x ${preset.height / 10} cm · ${preset.paper} · ${preset.handle}`;

  bagElement.style.setProperty("--bag-width", `${preset.width}px`);
  bagElement.style.setProperty("--bag-height", `${preset.height}px`);
  bagElement.style.setProperty("--bag-color", preset.color);
  bagElement.style.setProperty("--bag-accent", preset.accent);

  clampLogoPosition();
  updateLogoLayout();
}

renderPresetOptions();
applyPreset(bagPresets[0].id);

bagSelect.addEventListener("change", (event) => {
  applyPreset(event.target.value);
});

function updateStatus(message) {
  statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampLogoPosition() {
  if (!logoState.src) {
    logoState.x = 0;
    logoState.y = 0;
    return;
  }

  const metrics = getLogoMetrics();
  const maxX = Math.max(0, (metrics.areaWidthPx - metrics.logoWidthPx) / 2);
  const maxY = Math.max(0, (metrics.areaHeightPx - metrics.logoHeightPx) / 2);

  logoState.x = clamp(logoState.x, -maxX, maxX);
  logoState.y = clamp(logoState.y, -maxY, maxY);
}

function updateLogoLayout() {
  if (!logoState.src) {
    const preset = getCurrentPreset();
    scaleValue.textContent = `${Math.round(logoState.widthRatio * 100)}%`;
    printAreaMm.textContent = `${formatMm(preset.printWidthMm)} x ${formatMm(preset.printHeightMm)}`;
    logoSizeMm.textContent = "-";
    gapLeftMm.textContent = "-";
    gapRightMm.textContent = "-";
    gapTopMm.textContent = "-";
    gapBottomMm.textContent = "-";
    [measureTop, measureRight, measureBottom, measureLeft].forEach((element) => {
      element.hidden = true;
      element.textContent = "";
    });
    return;
  }

  const metrics = getLogoMetrics();
  scaleValue.textContent = `${Math.round(logoState.widthRatio * 100)}%`;
  logoLayer.style.width = `${metrics.logoWidthPx}px`;
  logoLayer.style.height = `${metrics.logoHeightPx}px`;
  logoLayer.style.transform = `translate(calc(-50% + ${logoState.x}px), calc(-50% + ${logoState.y}px))`;
  applyMeasurementOutput(metrics);
}

function getCurrentPreset() {
  return bagPresets.find((entry) => entry.id === bagSelect.value) ?? bagPresets[0];
}

function getLogoMetrics() {
  const preset = getCurrentPreset();
  const areaWidthPx = printArea.clientWidth;
  const areaHeightPx = printArea.clientHeight;
  const areaWidthMm = preset.printWidthMm;
  const areaHeightMm = preset.printHeightMm;
  const aspectRatio = logoState.naturalWidth / logoState.naturalHeight;

  let logoWidthPx = areaWidthPx * logoState.widthRatio;
  let logoHeightPx = logoWidthPx / aspectRatio;

  const maxHeightPx = areaHeightPx * LOGO_MAX_HEIGHT_RATIO;
  if (logoHeightPx > maxHeightPx) {
    logoHeightPx = maxHeightPx;
    logoWidthPx = logoHeightPx * aspectRatio;
  }

  const mmPerPxX = areaWidthMm / areaWidthPx;
  const mmPerPxY = areaHeightMm / areaHeightPx;

  const leftGapPx = (areaWidthPx - logoWidthPx) / 2 + logoState.x;
  const rightGapPx = areaWidthPx - leftGapPx - logoWidthPx;
  const topGapPx = (areaHeightPx - logoHeightPx) / 2 + logoState.y;
  const bottomGapPx = areaHeightPx - topGapPx - logoHeightPx;

  return {
    logoWidthPx,
    logoHeightPx,
    logoWidthMm: logoWidthPx * mmPerPxX,
    logoHeightMm: logoHeightPx * mmPerPxY,
    leftGapMm: leftGapPx * mmPerPxX,
    rightGapMm: rightGapPx * mmPerPxX,
    topGapMm: topGapPx * mmPerPxY,
    bottomGapMm: bottomGapPx * mmPerPxY,
    areaWidthPx,
    areaHeightPx,
  };
}

function formatMm(value) {
  return `${Math.max(0, value).toFixed(1)} mm`;
}

function applyMeasurementOutput(metrics) {
  const preset = getCurrentPreset();
  printAreaMm.textContent = `${formatMm(preset.printWidthMm)} x ${formatMm(preset.printHeightMm)}`;
  logoSizeMm.textContent = `${formatMm(metrics.logoWidthMm)} x ${formatMm(metrics.logoHeightMm)}`;
  gapLeftMm.textContent = formatMm(metrics.leftGapMm);
  gapRightMm.textContent = formatMm(metrics.rightGapMm);
  gapTopMm.textContent = formatMm(metrics.topGapMm);
  gapBottomMm.textContent = formatMm(metrics.bottomGapMm);

  measureTop.hidden = false;
  measureRight.hidden = false;
  measureBottom.hidden = false;
  measureLeft.hidden = false;

  measureTop.textContent = formatMm(metrics.topGapMm);
  measureRight.textContent = formatMm(metrics.rightGapMm);
  measureBottom.textContent = formatMm(metrics.bottomGapMm);
  measureLeft.textContent = formatMm(metrics.leftGapMm);
}

function setLogo(src, fileName) {
  logoState.src = src;
  logoState.x = 0;
  logoState.y = 0;
  logoLayer.src = src;
  logoLayer.onload = () => {
    logoState.naturalWidth = logoLayer.naturalWidth || 1;
    logoState.naturalHeight = logoLayer.naturalHeight || 1;
    logoLayer.hidden = false;
    printPlaceholder.hidden = true;
    clampLogoPosition();
    updateLogoLayout();
    updateStatus(`Logo geladen: ${fileName}. Größe und Abstände werden jetzt live in Millimetern angezeigt.`);
  };
}

function resetLogo() {
  logoState.src = "";
  logoState.x = 0;
  logoState.y = 0;
  logoState.naturalWidth = 1;
  logoState.naturalHeight = 1;
  logoLayer.removeAttribute("src");
  logoLayer.hidden = true;
  printPlaceholder.hidden = false;
  logoUpload.value = "";
  updateStatus("Logo zurückgesetzt. Du kannst direkt ein neues Logo hochladen.");
  updateLogoLayout();
}

logoUpload.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  const fileReader = new FileReader();
  fileReader.addEventListener("load", () => {
    setLogo(fileReader.result, file.name);
  });
  fileReader.readAsDataURL(file);
});

resetLogoButton.addEventListener("click", resetLogo);

logoScaleSlider.addEventListener("input", (event) => {
  logoState.widthRatio = Number(event.target.value) / 100;
  clampLogoPosition();
  updateLogoLayout();
});

printArea.addEventListener("pointerdown", (event) => {
  if (!logoState.src) {
    return;
  }

  logoState.dragging = true;
  logoState.pointerId = event.pointerId;
  logoState.startX = event.clientX;
  logoState.startY = event.clientY;
  logoState.originX = logoState.x;
  logoState.originY = logoState.y;
  printArea.classList.add("is-dragging");
  printArea.setPointerCapture(event.pointerId);
});

printArea.addEventListener("pointermove", (event) => {
  if (!logoState.dragging || event.pointerId !== logoState.pointerId) {
    return;
  }

  logoState.x = logoState.originX + (event.clientX - logoState.startX);
  logoState.y = logoState.originY + (event.clientY - logoState.startY);
  clampLogoPosition();
  updateLogoLayout();
});

function stopDragging(event) {
  if (!logoState.dragging || event.pointerId !== logoState.pointerId) {
    return;
  }

  logoState.dragging = false;
  printArea.classList.remove("is-dragging");
  printArea.releasePointerCapture(event.pointerId);
}

printArea.addEventListener("pointerup", stopDragging);
printArea.addEventListener("pointercancel", stopDragging);

window.addEventListener("resize", () => {
  clampLogoPosition();
  updateLogoLayout();
});

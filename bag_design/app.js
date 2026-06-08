const formats = [
  { id: "18x22", label: "18 x 22 cm", widthMm: 180, heightMm: 220, printWidthMm: 110, printHeightMm: 95 },
  { id: "32x40", label: "32 x 40 cm", widthMm: 320, heightMm: 400, printWidthMm: 205, printHeightMm: 155 },
  { id: "32x44", label: "32 x 44 cm", widthMm: 320, heightMm: 440, printWidthMm: 205, printHeightMm: 185 },
  { id: "45x50", label: "45 x 50 cm", widthMm: 450, heightMm: 500, printWidthMm: 300, printHeightMm: 220 },
];

const colors = [
  { id: "brown", label: "Braun", bagColor: "#9d7a4e", accentColor: "#805f37", handleColor: "rgba(90, 58, 29, 0.75)" },
  { id: "white", label: "Weiss", bagColor: "#ece7df", accentColor: "#cac1b6", handleColor: "rgba(120, 112, 100, 0.75)" },
  { id: "green", label: "Dunkelgruen", bagColor: "#486041", accentColor: "#33472d", handleColor: "rgba(42, 56, 38, 0.82)" },
  { id: "gray", label: "Grau", bagColor: "#9a9a96", accentColor: "#7a7a74", handleColor: "rgba(88, 88, 84, 0.8)" },
];

const handles = [
  { id: "flat", label: "Flachgriff" },
  { id: "cord", label: "Kordelgriff" },
];

const formatSelect = document.querySelector("#format-select");
const colorSelect = document.querySelector("#color-select");
const handleSelect = document.querySelector("#handle-select");
const bagMeta = document.querySelector("#bag-meta");
const bagName = document.querySelector("#bag-name");
const bagElement = document.querySelector("#bag");
const leftHandle = document.querySelector("#handle-left");
const rightHandle = document.querySelector("#handle-right");
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

const state = {
  formatId: formats[1].id,
  colorId: colors[0].id,
  handleId: handles[0].id,
};

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

function fillSelect(select, items) {
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.append(option);
  });
}

function getCurrentFormat() {
  return formats.find((item) => item.id === state.formatId) ?? formats[0];
}

function getCurrentColor() {
  return colors.find((item) => item.id === state.colorId) ?? colors[0];
}

function getCurrentHandle() {
  return handles.find((item) => item.id === state.handleId) ?? handles[0];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatMm(value) {
  return `${Math.max(0, value).toFixed(1)} mm`;
}

function setHandleStyle(handleId) {
  const isFlat = handleId === "flat";
  leftHandle.className = `handle handle-left ${isFlat ? "is-flat" : "is-cord"}`;
  rightHandle.className = `handle handle-right ${isFlat ? "is-flat" : "is-cord"}`;
}

function renderConfiguration() {
  const format = getCurrentFormat();
  const color = getCurrentColor();
  const handle = getCurrentHandle();

  bagName.textContent = `${format.label} ${color.label}`;
  bagMeta.textContent = `${format.label} · ${color.label} · ${handle.label}`;

  bagElement.style.setProperty("--bag-width", `${format.widthMm}px`);
  bagElement.style.setProperty("--bag-height", `${format.heightMm}px`);
  bagElement.style.setProperty("--bag-color", color.bagColor);
  bagElement.style.setProperty("--bag-accent", color.accentColor);
  bagElement.style.setProperty("--handle-color", color.handleColor);

  setHandleStyle(handle.id);
  clampLogoPosition();
  updateLogoLayout();
}

function getLogoMetrics() {
  const format = getCurrentFormat();
  const areaWidthPx = printArea.clientWidth;
  const areaHeightPx = printArea.clientHeight;
  const areaWidthMm = format.printWidthMm;
  const areaHeightMm = format.printHeightMm;
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
    areaWidthPx,
    areaHeightPx,
    areaWidthMm,
    areaHeightMm,
    logoWidthPx,
    logoHeightPx,
    logoWidthMm: logoWidthPx * mmPerPxX,
    logoHeightMm: logoHeightPx * mmPerPxY,
    leftGapMm: leftGapPx * mmPerPxX,
    rightGapMm: rightGapPx * mmPerPxX,
    topGapMm: topGapPx * mmPerPxY,
    bottomGapMm: bottomGapPx * mmPerPxY,
  };
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

function resetMeasurementBadges() {
  [measureTop, measureRight, measureBottom, measureLeft].forEach((element) => {
    element.hidden = true;
    element.textContent = "";
  });
}

function updateMeasurementPanel(metrics) {
  const format = getCurrentFormat();
  printAreaMm.textContent = `${formatMm(format.printWidthMm)} x ${formatMm(format.printHeightMm)}`;

  if (!metrics) {
    logoSizeMm.textContent = "-";
    gapLeftMm.textContent = "-";
    gapRightMm.textContent = "-";
    gapTopMm.textContent = "-";
    gapBottomMm.textContent = "-";
    resetMeasurementBadges();
    return;
  }

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

function updateLogoLayout() {
  scaleValue.textContent = `${Math.round(logoState.widthRatio * 100)}%`;

  if (!logoState.src) {
    updateMeasurementPanel(null);
    return;
  }

  const metrics = getLogoMetrics();
  logoLayer.style.width = `${metrics.logoWidthPx}px`;
  logoLayer.style.height = `${metrics.logoHeightPx}px`;
  logoLayer.style.transform = `translate(calc(-50% + ${logoState.x}px), calc(-50% + ${logoState.y}px))`;
  updateMeasurementPanel(metrics);
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
    statusText.textContent = `Logo geladen: ${fileName}. Du kannst es jetzt verschieben und skalieren.`;
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
  statusText.textContent = "Noch kein Logo geladen. Format, Farbe und Griff können schon gewählt werden.";
  updateLogoLayout();
}

fillSelect(formatSelect, formats);
fillSelect(colorSelect, colors);
fillSelect(handleSelect, handles);

formatSelect.value = state.formatId;
colorSelect.value = state.colorId;
handleSelect.value = state.handleId;
renderConfiguration();

formatSelect.addEventListener("change", (event) => {
  state.formatId = event.target.value;
  renderConfiguration();
});

colorSelect.addEventListener("change", (event) => {
  state.colorId = event.target.value;
  renderConfiguration();
});

handleSelect.addEventListener("change", (event) => {
  state.handleId = event.target.value;
  renderConfiguration();
});

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

updateLogoLayout();

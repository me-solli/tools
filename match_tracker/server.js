const express = require("express")
const fs = require("fs")
const path = require("path")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json({ limit: "15mb" }))

const DATA_DIR = process.env.DATA_DIR || (process.platform === "win32"
  ? path.join(__dirname, "data")
  : "/data")
const FILE = path.join(DATA_DIR, "data.json")
const LIVE_PHOTO_FILE = path.join(DATA_DIR, "live_photos.json")
const LIVE_PHOTO_DIR = path.join(DATA_DIR, "live_photos")
const STATIC_DIR = __dirname
const LIVE_PHOTO_TTL_MS = 30 * 60 * 1000

function createInitialData() {
  return {
    teams: [],
    players: [],
    matches: [],
    activeTeam: null,
    teamPasswords: {}
  }
}

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (!fs.existsSync(LIVE_PHOTO_DIR)) {
    fs.mkdirSync(LIVE_PHOTO_DIR, { recursive: true })
  }

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(createInitialData(), null, 2))
    console.log("data.json wurde erstellt:", FILE)
  }

  if (!fs.existsSync(LIVE_PHOTO_FILE)) {
    fs.writeFileSync(LIVE_PHOTO_FILE, JSON.stringify([], null, 2))
  }
}

function readData() {
  ensureStorage()

  try {
    const raw = fs.readFileSync(FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return normalizeIncomingData(parsed)
  } catch (error) {
    console.error("READ ERROR:", error)
    const fallback = createInitialData()
    fs.writeFileSync(FILE, JSON.stringify(fallback, null, 2))
    return fallback
  }
}

function writeData(nextData) {
  ensureStorage()
  fs.writeFileSync(FILE, JSON.stringify(nextData, null, 2))
}

function readLivePhotos() {
  ensureStorage()

  try {
    const raw = fs.readFileSync(LIVE_PHOTO_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("LIVE PHOTO READ ERROR:", error)
    fs.writeFileSync(LIVE_PHOTO_FILE, JSON.stringify([], null, 2))
    return []
  }
}

function writeLivePhotos(items) {
  ensureStorage()
  fs.writeFileSync(LIVE_PHOTO_FILE, JSON.stringify(items, null, 2))
}

function deletePhotoFile(filename) {
  if (!filename) return

  const filePath = path.join(LIVE_PHOTO_DIR, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

function cleanupExpiredLivePhotos() {
  const now = Date.now()
  const photos = readLivePhotos()
  const keep = []

  for (const photo of photos) {
    if (photo.expiresAt && photo.expiresAt <= now) {
      deletePhotoFile(photo.filename)
      continue
    }

    keep.push(photo)
  }

  if (keep.length !== photos.length) {
    writeLivePhotos(keep)
  }

  return keep
}

function getMatchLivePhotos(matchId) {
  return cleanupExpiredLivePhotos().filter(photo => String(photo.matchId) === String(matchId))
}

function clearMatchLivePhotos(matchId) {
  const photos = readLivePhotos()
  const keep = []

  for (const photo of photos) {
    if (String(photo.matchId) === String(matchId)) {
      deletePhotoFile(photo.filename)
      continue
    }

    keep.push(photo)
  }

  writeLivePhotos(keep)
}

function parseDataUrl(input) {
  if (typeof input !== "string") return null

  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  }
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/png") return ".png"
  if (mimeType === "image/webp") return ".webp"
  return ".jpg"
}

function normalizeIncomingData(input) {
  const next = input && typeof input === "object" ? input : {}

  return {
    teams: Array.isArray(next.teams) ? next.teams : [],
    players: Array.isArray(next.players) ? next.players : [],
    matches: Array.isArray(next.matches) ? next.matches : [],
    activeTeam: typeof next.activeTeam === "string" || next.activeTeam === null
      ? next.activeTeam
      : null,
    teamPasswords: next.teamPasswords && typeof next.teamPasswords === "object"
      ? next.teamPasswords
      : {}
  }
}

ensureStorage()

/* =========================
🔐 TEAM PASSWÖRTER (LIGHT SECURITY)
========================= */

const TEAM_PASSWORDS = {
  "SV Riedmoos U10-II": "u10-2",
  "SV Riedmoos U10-III": "u10-3",
  "SV Testhausen": "test"
}

/* =========================
DATA ENDPOINTS
========================= */

app.get("/live-photos/:matchId", (req, res) => {
  try {
    const items = getMatchLivePhotos(req.params.matchId).map(photo => ({
      id: photo.id,
      matchId: photo.matchId,
      createdAt: photo.createdAt,
      expiresAt: photo.expiresAt,
      url: `/live-photo/${photo.id}`
    }))

    res.json({ items })
  } catch (error) {
    console.error("LIVE PHOTO LIST ERROR:", error)
    res.status(500).json({ error: "Fehler beim Laden der Bilder" })
  }
})

app.get("/live-photo/:id", (req, res) => {
  try {
    const photos = cleanupExpiredLivePhotos()
    const photo = photos.find(item => item.id === req.params.id)

    if (!photo) {
      return res.status(404).json({ error: "Bild nicht gefunden" })
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private")
    res.type(photo.mimeType || "image/jpeg")
    res.sendFile(path.join(LIVE_PHOTO_DIR, photo.filename))
  } catch (error) {
    console.error("LIVE PHOTO GET ERROR:", error)
    res.status(500).json({ error: "Fehler beim Laden des Bildes" })
  }
})

app.post("/live-photos/upload", (req, res) => {
  try {
    const { matchId, imageData } = req.body || {}

    if (!matchId || !imageData) {
      return res.status(400).json({ error: "Bild oder Match fehlt" })
    }

    const parsed = parseDataUrl(imageData)
    if (!parsed) {
      return res.status(400).json({ error: "Ungültiges Bildformat" })
    }

    if (parsed.buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: "Bild ist zu groß" })
    }

    const data = readData()
    const matchExists = data.matches.some(match => String(match.id) === String(matchId))
    if (!matchExists) {
      return res.status(404).json({ error: "Match nicht gefunden" })
    }

    cleanupExpiredLivePhotos()

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const ext = extensionForMimeType(parsed.mimeType)
    const filename = `${id}${ext}`
    const filePath = path.join(LIVE_PHOTO_DIR, filename)

    fs.writeFileSync(filePath, parsed.buffer)

    const items = readLivePhotos()
    const item = {
      id,
      matchId,
      filename,
      mimeType: parsed.mimeType,
      createdAt: Date.now(),
      expiresAt: Date.now() + LIVE_PHOTO_TTL_MS
    }

    items.push(item)
    writeLivePhotos(items)

    res.json({
      ok: true,
      item: {
        id: item.id,
        matchId: item.matchId,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        url: `/live-photo/${item.id}`
      }
    })
  } catch (error) {
    console.error("LIVE PHOTO UPLOAD ERROR:", error)
    res.status(500).json({ error: "Fehler beim Hochladen" })
  }
})

app.post("/live-photos/clear-match", (req, res) => {
  try {
    const { matchId } = req.body || {}
    if (!matchId) {
      return res.status(400).json({ error: "Match fehlt" })
    }

    clearMatchLivePhotos(matchId)
    res.json({ ok: true })
  } catch (error) {
    console.error("LIVE PHOTO CLEAR ERROR:", error)
    res.status(500).json({ error: "Fehler beim Löschen" })
  }
})

// 👉 Daten abrufen
app.get("/data", (req, res) => {
  try {
    cleanupExpiredLivePhotos()
    res.json(readData())
  } catch (err) {
    console.error("GET ERROR:", err)
    res.status(500).json({ error: "Fehler beim Laden" })
  }
})

// 👉 Daten speichern
// 🔥 IP TRACKING
const ipLog = {}

function getIP(req){
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress
}

app.post("/save", (req, res) => {
  try {
    cleanupExpiredLivePhotos()
    const incoming = normalizeIncomingData(req.body)

    if(!incoming || typeof incoming !== "object"){
  return res.status(400).json({ error: "Ungültige Daten" })
}

    // 🔥 aktuelle Daten laden
    const current = readData()

const oldTeams = current.teams?.length || 0
const newTeams = incoming.teams?.length || 0

const diff = newTeams - oldTeams

// 🔥 nur prüfen wenn neue Teams dazu kommen
if(diff > 0){

      const ip = getIP(req)
      const now = Date.now()

      if(!ipLog[ip]){
        ipLog[ip] = {
          timestamps: [],
          last: 0
        }
      }

      let entry = ipLog[ip]

      // ⏱ Cooldown (5 Sekunden)
      if(now - entry.last < 5000){
        return res.json({ error: "⏳ Bitte kurz warten" })
      }

      entry.last = now

      // 🧹 alte Einträge entfernen (1h)
      entry.timestamps = entry.timestamps.filter(t => now - t < 3600000)

      // 🚫 Limit
if(entry.timestamps.length + diff > 1){
  return res.json({ error: "🚫 Limit erreicht (max 1 Team / Stunde)" })
}
  
for(let i = 0; i < diff; i++){
  entry.timestamps.push(now)
}
    }

    const nextData = {
      ...incoming,
      teamPasswords: {
        ...current.teamPasswords,
        ...incoming.teamPasswords
      }
    }

    writeData(nextData)

    console.log("Daten gespeichert")
    res.json({ status: "ok" })

  } catch (err) {
    console.error("SAVE ERROR:", err)
    res.status(500).json({ error: "Fehler beim Speichern" })
  }
})

/* =========================
🔐 TEAM ACCESS CHECK
========================= */

app.post("/check-team-access", (req, res) => {

  const { team, password } = req.body

  if (!team) {
    return res.json({ ok: false })
  }

  const current = readData()
  const saved = TEAM_PASSWORDS[team] ?? current.teamPasswords[team]

  // 🔒 Team existiert → Passwort prüfen
  if (saved !== undefined) {
    if (password === saved) {
      return res.json({ ok: true })
    } else {
      return res.json({ ok: false })
    }
  }

  // ❌ unbekanntes Team → KEIN Zugriff
  return res.json({ ok: false })
})

/* =========================
SYSTEM
========================= */

app.get("/health", (req, res) => {
  res.json({ ok: true })
})

app.use(express.static(STATIC_DIR))

app.get("/", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"))
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT)
})

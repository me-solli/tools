const express = require("express")
const fs = require("fs")
const path = require("path")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json({ limit: "1mb" }))

const DATA_DIR = process.env.DATA_DIR || (process.platform === "win32"
  ? path.join(__dirname, "data")
  : "/data")
const FILE = path.join(DATA_DIR, "data.json")
const STATIC_DIR = __dirname

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

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(createInitialData(), null, 2))
    console.log("data.json wurde erstellt:", FILE)
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

// 👉 Daten abrufen
app.get("/data", (req, res) => {
  try {
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

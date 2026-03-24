const express = require("express")
const fs = require("fs")
const path = require("path")
const cors = require("cors")

const app = express()

// 🔥 wichtig für Frontend Zugriff
app.use(cors())

// JSON parsing
app.use(express.json())

/* =========================
📁 DATEI (VOLUME STORAGE)
========================= */

const FILE = "/data/data.json"

// 🔥 sicherstellen, dass /data existiert
if (!fs.existsSync("/data")) {
  fs.mkdirSync("/data", { recursive: true })
}

// 🔥 Datei automatisch erstellen
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({
    teams: [],
    players: [],
    matches: [],
    activeTeam: null
  }, null, 2))
  console.log("📁 data.json wurde im Volume erstellt")
}

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
    res.sendFile(FILE)
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

    const incoming = req.body

    // 🔥 aktuelle Daten laden
    const current = JSON.parse(fs.readFileSync(FILE, "utf-8"))

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
      if(entry.timestamps.length >= 1){
        return res.json({ error: "🚫 Limit erreicht (max 1 Team / Stunde)" })
      }

      entry.timestamps.push(now)
    }

    // 💾 speichern
    fs.writeFileSync(FILE, JSON.stringify(incoming, null, 2))

    console.log("💾 Daten gespeichert")
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

  if (TEAM_PASSWORDS[team]) {
    if (TEAM_PASSWORDS[team] === password) {
      return res.json({ ok: true })
    } else {
      return res.json({ ok: false })
    }
  }

return res.json({ ok: false })
})

/* =========================
SYSTEM
========================= */

// 👉 Health Check
app.get("/", (req, res) => {
  res.send("API läuft 🚀")
})

// 👉 Server starten
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT)
})

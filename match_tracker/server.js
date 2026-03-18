const express = require("express")
const fs = require("fs")
const path = require("path")
const cors = require("cors")

const app = express()

// 🔥 wichtig für Frontend Zugriff
app.use(cors())

// JSON parsing
app.use(express.json())

const FILE = "/data/data.json"

// 👉 Daten abrufen
app.get("/data", (req, res) => {
  try {
    if (!fs.existsSync(FILE)) {
      return res.json({
        teams: [],
        players: [],
        matches: [],
        activeTeam: null
      })
    }

    res.sendFile(FILE)
  } catch (err) {
    console.error("GET ERROR:", err)
    res.status(500).json({ error: "Fehler beim Laden" })
  }
})

// 👉 Daten speichern
app.post("/save", (req, res) => {
  try {
    fs.writeFileSync(FILE, JSON.stringify(req.body, null, 2))
    console.log("💾 Daten gespeichert")
    res.json({ status: "ok" })
  } catch (err) {
    console.error("SAVE ERROR:", err)
    res.status(500).json({ error: "Fehler beim Speichern" })
  }
})

// 👉 Health Check (nice to have)
app.get("/", (req, res) => {
  res.send("API läuft 🚀")
})

// 👉 Server starten (Railway Port!)
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT)
})

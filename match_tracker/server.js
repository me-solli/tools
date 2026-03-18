const express = require("express")
const fs = require("fs")
const path = require("path")

const app = express()
app.use(express.json())

const FILE = path.join(__dirname, "data.json")

// 👉 Daten abrufen
app.get("/data", (req, res) => {
  if (!fs.existsSync(FILE)) {
    return res.json({
      teams: [],
      players: [],
      matches: [],
      activeTeam: null
    })
  }

  res.sendFile(FILE)
})

// 👉 Daten speichern
app.post("/save", (req, res) => {
  try {
    fs.writeFileSync(FILE, JSON.stringify(req.body, null, 2))
    res.json({ status: "ok" })
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Speichern" })
  }
})

// 👉 Server starten
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT)
})

const express = require("express")
const fs = require("fs")
const path = require("path")
const cors = require("cors")
const crypto = require("crypto")

const app = express()

app.use(cors())
app.use(express.json({ limit: "15mb" }))

const DATA_DIR = process.env.DATA_DIR || (process.platform === "win32"
  ? path.join(__dirname, "data")
  : "/data")

const FILE = path.join(DATA_DIR, "data.json")
const LIVE_PHOTO_FILE = path.join(DATA_DIR, "live_photos.json")
const REACTIONS_FILE = path.join(DATA_DIR, "reactions.json")
const GUEST_TOKENS_FILE = path.join(DATA_DIR, "guest_ticker_tokens.json")
const TEAM_SESSIONS_FILE = path.join(DATA_DIR, "team_sessions.json")
const LIVE_PHOTO_DIR = path.join(DATA_DIR, "live_photos")
const STATIC_DIR = __dirname

const LIVE_PHOTO_TTL_MS = 30 * 24 * 60 * 60 * 1000


// ============================================================
// LIVE PHOTO QUEUE
// ============================================================

// Wichtig:
// Mehrere Bilder können vom Tablet gleichzeitig hochgeladen werden.
// Ohne Queue können mehrere Requests gleichzeitig dieselbe alte
// live_photos.json lesen und sich anschließend gegenseitig überschreiben.
//
// Deshalb werden alle Änderungen an live_photos.json nacheinander
// abgearbeitet.

let livePhotoQueue = Promise.resolve()
let reactionsQueue = Promise.resolve()

function withLivePhotoLock(task) {
  const run = livePhotoQueue.then(task, task)

  livePhotoQueue = run.catch(() => {})

  return run
}

function withReactionsLock(task) {
  const run = reactionsQueue.then(task, task)
  reactionsQueue = run.catch(() => {})
  return run
}


// ============================================================
// INITIAL DATA
// ============================================================

function createInitialData() {
  return {
    teams: [],
    players: [],
    matches: [],
    activeTeam: null,
    teamPasswords: {}
  }
}


// ============================================================
// STORAGE
// ============================================================

function ensureStorage() {

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (!fs.existsSync(LIVE_PHOTO_DIR)) {
    fs.mkdirSync(LIVE_PHOTO_DIR, { recursive: true })
  }

  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
      FILE,
      JSON.stringify(createInitialData(), null, 2)
    )

    console.log("data.json wurde erstellt:", FILE)
  }

  if (!fs.existsSync(LIVE_PHOTO_FILE)) {
    fs.writeFileSync(
      LIVE_PHOTO_FILE,
      JSON.stringify([], null, 2)
    )
  }

  if (!fs.existsSync(REACTIONS_FILE)) {
    fs.writeFileSync(REACTIONS_FILE, JSON.stringify({ visitors: {}, matches: {} }, null, 2))
  }
  if (!fs.existsSync(GUEST_TOKENS_FILE)) fs.writeFileSync(GUEST_TOKENS_FILE, JSON.stringify({}, null, 2))
  if (!fs.existsSync(TEAM_SESSIONS_FILE)) fs.writeFileSync(TEAM_SESSIONS_FILE, JSON.stringify({}, null, 2))
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

    fs.writeFileSync(
      FILE,
      JSON.stringify(fallback, null, 2)
    )

    return fallback
  }
}


function writeData(nextData) {

  ensureStorage()

  fs.writeFileSync(
    FILE,
    JSON.stringify(nextData, null, 2)
  )
}


// ============================================================
// LIVE PHOTO STORAGE
// ============================================================

function readLivePhotos() {

  ensureStorage()

  try {

    const raw = fs.readFileSync(
      LIVE_PHOTO_FILE,
      "utf-8"
    )

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed
      : []

  } catch (error) {

    console.error(
      "LIVE PHOTO READ ERROR:",
      error
    )

    fs.writeFileSync(
      LIVE_PHOTO_FILE,
      JSON.stringify([], null, 2)
    )

    return []
  }
}


function writeLivePhotos(items) {

  ensureStorage()

  fs.writeFileSync(
    LIVE_PHOTO_FILE,
    JSON.stringify(items, null, 2)
  )
}


function deletePhotoFile(filename) {

  if (!filename) return

  const filePath = path.join(
    LIVE_PHOTO_DIR,
    filename
  )

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}


// ============================================================
// LIVE PHOTO CLEANUP
// ============================================================

function cleanupExpiredLivePhotos() {

  const now = Date.now()

  const photos = readLivePhotos()

  const keep = []

  for (const photo of photos) {

    if (
      photo.expiresAt &&
      photo.expiresAt <= now
    ) {

      deletePhotoFile(
        photo.filename
      )

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

  return cleanupExpiredLivePhotos()
    .filter(
      photo =>
        String(photo.matchId) ===
        String(matchId)
    )
}


function clearMatchLivePhotos(matchId) {

  const photos = readLivePhotos()

  const keep = []

  for (const photo of photos) {

    if (
      String(photo.matchId) ===
      String(matchId)
    ) {

      deletePhotoFile(
        photo.filename
      )

      continue
    }

    keep.push(photo)
  }

  writeLivePhotos(keep)
}


// ============================================================
// IMAGE HELPERS
// ============================================================

function parseDataUrl(input) {

  if (typeof input !== "string") {
    return null
  }

  const match = input.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  )

  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(
      match[2],
      "base64"
    )
  }
}


function extensionForMimeType(mimeType) {

  if (mimeType === "image/png") {
    return ".png"
  }

  if (mimeType === "image/webp") {
    return ".webp"
  }

  return ".jpg"
}


// ============================================================
// DATA NORMALIZATION
// ============================================================

function normalizeIncomingData(input) {

  const next =
    input &&
    typeof input === "object"
      ? input
      : {}

  return {

    teams:
      Array.isArray(next.teams)
        ? next.teams
        : [],

    players:
      Array.isArray(next.players)
        ? next.players
        : [],

    matches:
      Array.isArray(next.matches)
        ? next.matches
        : [],

    activeTeam:
      typeof next.activeTeam === "string" ||
      next.activeTeam === null
        ? next.activeTeam
        : null,

    teamPasswords:
      next.teamPasswords &&
      typeof next.teamPasswords === "object"
        ? next.teamPasswords
        : {}
  }
}


ensureStorage()


// ============================================================
// TEAM PASSWORDS
// ============================================================

const TEAM_PASSWORDS = {

  "SV Riedmoos U11": "u11",

  "SV Riedmoos U11-2": "u11-2",

  "SV Testhausen": "test"

}


// ============================================================
// LIVE PHOTO LIST
// ============================================================

app.get(
  "/live-photos/:matchId",
  async (req, res) => {

    try {

      const items =
        await withLivePhotoLock(() => {

          return getMatchLivePhotos(
            req.params.matchId
          ).map(photo => ({

            id: photo.id,

            matchId: photo.matchId,

            createdAt: photo.createdAt,

            expiresAt: photo.expiresAt,

            url:
              `/live-photo/${photo.id}`

          }))

        })


      res.json({
        items
      })


    } catch (error) {

      console.error(
        "LIVE PHOTO LIST ERROR:",
        error
      )

      res.status(500).json({
        error:
          "Fehler beim Laden der Bilder"
      })
    }
  }
)


// ============================================================
// SINGLE LIVE PHOTO
// ============================================================

app.get(
  "/live-photo/:id",
  async (req, res) => {

    try {

      const photo =
        await withLivePhotoLock(() => {

          const photos =
            cleanupExpiredLivePhotos()

          return (
            photos.find(
              item =>
                item.id ===
                req.params.id
            ) || null
          )
        })


      if (!photo) {

        return res.status(404).json({
          error:
            "Bild nicht gefunden"
        })
      }


      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private"
      )

      res.type(
        photo.mimeType ||
        "image/jpeg"
      )

      res.sendFile(
        path.join(
          LIVE_PHOTO_DIR,
          photo.filename
        )
      )


    } catch (error) {

      console.error(
        "LIVE PHOTO GET ERROR:",
        error
      )

      res.status(500).json({
        error:
          "Fehler beim Laden des Bildes"
      })
    }
  }
)


// ============================================================
// LIVE PHOTO UPLOAD
// ============================================================

app.post(
  "/live-photos/upload",
  async (req, res) => {

    try {

      const {
        matchId,
        imageData
      } = req.body || {}


      if (!matchId || !imageData) {

        return res.status(400).json({
          error:
            "Bild oder Match fehlt"
        })
      }


      const parsed =
        parseDataUrl(imageData)


      if (!parsed) {

        return res.status(400).json({
          error:
            "Ungültiges Bildformat"
        })
      }


      if (
        parsed.buffer.length >
        8 * 1024 * 1024
      ) {

        return res.status(400).json({
          error:
            "Bild ist zu groß"
        })
      }


      // ========================================================
      // AB HIER WIRD DER UPLOAD SERIALISIERT
      // ========================================================

      const result =
        await withLivePhotoLock(() => {

          const data =
            readData()


          const matchExists =
            data.matches.some(
              match =>
                String(match.id) ===
                String(matchId)
            )


          if (!matchExists) {

            const error =
              new Error(
                "MATCH_NOT_FOUND"
              )

            error.code =
              "MATCH_NOT_FOUND"

            throw error
          }


          cleanupExpiredLivePhotos()


          // Eindeutige ID

          const id =
            Date.now().toString(36) +
            Math.random()
              .toString(36)
              .slice(2, 10)


          const ext =
            extensionForMimeType(
              parsed.mimeType
            )


          const filename =
            `${id}${ext}`


          const filePath =
            path.join(
              LIVE_PHOTO_DIR,
              filename
            )


          // Bilddatei schreiben

          fs.writeFileSync(
            filePath,
            parsed.buffer
          )


          // GANZ WICHTIG:
          // Erst jetzt den aktuellsten Stand laden.

          const items =
            readLivePhotos()


          const now =
            Date.now()


          const item = {

            id,

            matchId,

            filename,

            mimeType:
              parsed.mimeType,

            createdAt:
              now,

            expiresAt:
              now +
              LIVE_PHOTO_TTL_MS
          }


          items.push(item)


          writeLivePhotos(
            items
          )


          return item
        })


      res.json({

        ok: true,

        item: {

          id:
            result.id,

          matchId:
            result.matchId,

          createdAt:
            result.createdAt,

          expiresAt:
            result.expiresAt,

          url:
            `/live-photo/${result.id}`
        }
      })


    } catch (error) {

      if (
        error?.code ===
        "MATCH_NOT_FOUND"
      ) {

        return res.status(404).json({
          error:
            "Match nicht gefunden"
        })
      }


      console.error(
        "LIVE PHOTO UPLOAD ERROR:",
        error
      )


      const diskFull = error && (error.code === "ENOSPC" || error.code === "EDQUOT")
      res.status(diskFull ? 507 : 500).json({
        error: diskFull
          ? "Server-Speicher voll – Foto wurde nicht gespeichert"
          : "Fehler beim Hochladen"
      })
    }
  }
)


// ============================================================
// CLEAR MATCH PHOTOS
// ============================================================

app.post(
  "/live-photos/clear-match",
  async (req, res) => {

    try {

      const {
        matchId
      } = req.body || {}


      if (!matchId) {

        return res.status(400).json({
          error:
            "Match fehlt"
        })
      }


      await withLivePhotoLock(
        () =>
          clearMatchLivePhotos(
            matchId
          )
      )


      res.json({
        ok: true
      })


    } catch (error) {

      console.error(
        "LIVE PHOTO CLEAR ERROR:",
        error
      )


      res.status(500).json({
        error:
          "Fehler beim Löschen"
      })
    }
  }
)


// ============================================================
// SHARED, PERSISTENT MATCH REACTIONS
// ============================================================

const REACTION_CHOICES = new Set(["❤️", "🔥", "👏", "💪", "😮"])
const MAX_REACTIONS_PER_VISITOR = 1

function readReactions() {
  ensureStorage()
  try {
    const parsed = JSON.parse(fs.readFileSync(REACTIONS_FILE, "utf-8"))
    return {
      visitors: parsed && parsed.visitors && typeof parsed.visitors === "object" ? parsed.visitors : {},
      matches: parsed && parsed.matches && typeof parsed.matches === "object" ? parsed.matches : {}
    }
  } catch (error) {
    console.error("REACTIONS READ ERROR:", error)
    // Do not silently overwrite a corrupt file: surface the error to the route.
    throw error
  }
}

function writeReactions(data) {
  ensureStorage()
  const tempFile = REACTIONS_FILE + ".tmp"
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2))
  fs.renameSync(tempFile, REACTIONS_FILE)
}

function getReactionVisitor(req) {
  const candidate = String(req.query.visitorId || req.body?.visitorId || "").trim()
  // The ID is a lightweight browser identifier, not authenticated identity.
  return /^[a-zA-Z0-9._:-]{8,160}$/.test(candidate) ? candidate : null
}

function getMatchReactionState(data, matchId) {
  if (!data.matches[String(matchId)]) data.matches[String(matchId)] = { counts: {}, total: 0 }
  const state = data.matches[String(matchId)]
  if (!state.counts || typeof state.counts !== "object") state.counts = {}
  if (!Number.isFinite(state.total)) state.total = Object.values(state.counts).reduce((sum, n) => sum + (Number(n) || 0), 0)
  return state
}

app.get("/reactions/:matchId", async (req, res) => {
  try {
    const visitorId = getReactionVisitor(req)
    if (!visitorId) return res.status(400).json({ error: "Ungültige Besucherkennung" })
    const result = await withReactionsLock(() => {
      const stored = readReactions()
      const match = stored.matches[String(req.params.matchId)] || { counts: {}, total: 0 }
      const visitor = stored.visitors[visitorId] || { totalClicks: 0, lastEmojiByMatch: {} }
      const visitorLastEmoji = visitor.lastEmojiByMatch?.[String(req.params.matchId)] || ""
      return {
        counts: Object.fromEntries([...REACTION_CHOICES].map(emoji => [emoji, Math.max(0, Number(match.counts?.[emoji]) || 0)])),
        // Eine Reaktion pro Besucher und Spiel. Die vorhandene Reaktion darf jederzeit geändert werden.
        remaining: visitorLastEmoji ? 0 : MAX_REACTIONS_PER_VISITOR,
        visitorLastEmoji
      }
    })
    res.setHeader("Cache-Control", "no-store")
    res.json(result)
  } catch (error) {
    console.error("REACTIONS GET ERROR:", error)
    res.status(500).json({ error: "Reaktionen konnten nicht geladen werden" })
  }
})

app.post("/reactions/:matchId", async (req, res) => {
  try {
    const visitorId = getReactionVisitor(req)
    const emoji = req.body?.emoji
    const matchId = String(req.params.matchId || "").trim()
    if (!visitorId) return res.status(400).json({ error: "Ungültige Besucherkennung" })
    if (!matchId || matchId.length > 160) return res.status(400).json({ error: "Ungültiges Spiel" })
    if (!REACTION_CHOICES.has(emoji)) return res.status(400).json({ error: "Ungültige Reaktion" })

    const result = await withReactionsLock(() => {
      const stored = readReactions()
      const current = readData()
      if (!current.matches.some(match => String(match.id) === matchId)) {
        const error = new Error("MATCH_NOT_FOUND")
        error.code = "MATCH_NOT_FOUND"
        throw error
      }
      const visitor = stored.visitors[visitorId] || { totalClicks: 0, lastEmojiByMatch: {} }
      visitor.lastEmojiByMatch = visitor.lastEmojiByMatch && typeof visitor.lastEmojiByMatch === "object" ? visitor.lastEmojiByMatch : {}
      const previousEmoji = visitor.lastEmojiByMatch[matchId]
      const state = getMatchReactionState(stored, matchId)

      // Erster Klick zählt eine Reaktion. Weitere Klicks ersetzen die bestehende Reaktion,
      // ohne den Gesamtzähler des Spiels zu erhöhen.
      if (previousEmoji !== emoji) {
        if (REACTION_CHOICES.has(previousEmoji)) {
          state.counts[previousEmoji] = Math.max(0, (Number(state.counts[previousEmoji]) || 0) - 1)
        }
        state.counts[emoji] = (Number(state.counts[emoji]) || 0) + 1
        state.total = Object.values(state.counts).reduce((sum, count) => sum + (Number(count) || 0), 0)
        visitor.lastEmojiByMatch[matchId] = emoji
        stored.visitors[visitorId] = visitor
        writeReactions(stored)
      }
      return {
        limited: false,
        remaining: 0,
        visitorLastEmoji: visitor.lastEmojiByMatch[matchId] || emoji,
        counts: Object.fromEntries([...REACTION_CHOICES].map(e => [e, Number(state.counts[e]) || 0]))
      }
    })
    res.setHeader("Cache-Control", "no-store")
    res.json({ ok: true, remaining: result.remaining, counts: result.counts })
  } catch (error) {
    if (error?.code === "MATCH_NOT_FOUND") return res.status(404).json({ error: "Spiel nicht gefunden" })
    console.error("REACTIONS POST ERROR:", error)
    res.status(500).json({ error: "Reaktion konnte nicht gespeichert werden" })
  }
})

// ============================================================
// SECURE GUEST LIVE TICKER LINKS
// ============================================================
function readGuestTokens(){ try { return JSON.parse(fs.readFileSync(GUEST_TOKENS_FILE,"utf8")) || {} } catch { return {} } }
function writeGuestTokens(obj){ const tmp=GUEST_TOKENS_FILE+".tmp"; fs.writeFileSync(tmp,JSON.stringify(obj,null,2)); fs.renameSync(tmp,GUEST_TOKENS_FILE) }
function tokenHash(token){ return crypto.createHash("sha256").update(String(token)).digest("hex") }
function getGuestRecord(token){ if(!token || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null; const all=readGuestTokens(); const rec=all[tokenHash(token)]; if(!rec || rec.revoked || Date.now() >= rec.expiresAt) return null; return rec }
function guestMatchData(rec){ const data=readData(); const match=data.matches.find(m=>String(m.id)===String(rec.matchId) && m.team===rec.team); if(!match) return null; return { teams:(data.teams||[]).filter(t=>t.name===rec.team || t===rec.team), players:(data.players||[]).filter(p=>p.team===rec.team), matches:[match], activeTeam:rec.team, teamPasswords:{} } }
app.post("/guest-ticker/create", (req,res)=>{
  try {
    const {team,password,matchId,expiresAt}=req.body||{}; const data=readData();
    const saved=TEAM_PASSWORDS[team] ?? data.teamPasswords?.[team];
    if(!team || saved===undefined || password!==saved) return res.status(403).json({error:"Team-Passwort stimmt nicht"});
    const match=data.matches.find(m=>String(m.id)===String(matchId) && m.team===team);
    if(!match) return res.status(404).json({error:"Spiel nicht gefunden"});
    const expiry=Number(expiresAt); if(!Number.isFinite(expiry) || expiry<=Date.now() || expiry>Date.now()+8*24*60*60*1000) return res.status(400).json({error:"Ablauf muss innerhalb der nächsten 7 Tage liegen"});
    const token=crypto.randomBytes(32).toString("base64url"); const all=readGuestTokens();
    // Ein aktiver Gastlink pro Spiel; neu erstellen ersetzt den vorherigen.
    for(const [key,r] of Object.entries(all)) if(String(r.matchId)===String(matchId) && r.team===team) r.revoked=true;
    all[tokenHash(token)]={matchId:match.id,team,expiresAt:expiry,createdAt:Date.now(),revoked:false}; writeGuestTokens(all);
    res.json({ok:true,token,expiresAt:expiry});
  } catch(e){ console.error("GUEST LINK CREATE",e); res.status(500).json({error:"Gastlink konnte nicht erstellt werden"}) }
});
app.post("/guest-ticker/revoke", (req,res)=>{
  try { const {team,password,matchId}=req.body||{}; const data=readData(); const saved=TEAM_PASSWORDS[team] ?? data.teamPasswords?.[team]; if(saved===undefined || password!==saved) return res.status(403).json({error:"Team-Passwort stimmt nicht"}); const all=readGuestTokens(); let n=0; for(const r of Object.values(all)) if(String(r.matchId)===String(matchId)&&r.team===team&&!r.revoked){r.revoked=true;n++} writeGuestTokens(all); res.json({ok:true,revoked:n}) } catch(e){res.status(500).json({error:"Gastlink konnte nicht widerrufen werden"})}
});
app.get("/guest-ticker/:token", (req,res)=>{ const rec=getGuestRecord(req.params.token); if(!rec) return res.status(410).json({error:"Gastlink ungültig oder abgelaufen"}); const data=guestMatchData(rec); if(!data) return res.status(404).json({error:"Spiel nicht gefunden"}); res.setHeader("Cache-Control","no-store"); res.json({...data,guestExpiresAt:rec.expiresAt}) });
app.post("/guest-ticker/:token/update", (req,res)=>{
  try {
    const rec=getGuestRecord(req.params.token); if(!rec) return res.status(410).json({error:"Gastlink ungültig oder abgelaufen"});
    const incoming=req.body||{}; const allowedState=["startTime","pausedAt","pausedTotal","period","phase","periodStartAt","periodPausedAt","periodPausedTotal","completed"];
    if(!incoming.liveState || typeof incoming.liveState!=="object" || !Array.isArray(incoming.events)) return res.status(400).json({error:"Ungültige Live-Daten"});
    const data=readData(); const match=data.matches.find(m=>String(m.id)===String(rec.matchId)&&m.team===rec.team); if(!match) return res.status(404).json({error:"Spiel nicht gefunden"});
    const oldEvents=Array.isArray(match.events)?match.events:[]; const next=incoming.events;
    // Gastticker darf neue Ereignisse hinzufügen oder genau einen vorhandenen Eintrag
    // über das X löschen. Andere Änderungen an bestehenden Ereignissen bleiben gesperrt.
    if(next.length===oldEvents.length+1){
      if(oldEvents.some((ev,i)=>JSON.stringify(ev)!==JSON.stringify(next[i]))) return res.status(403).json({error:"Gastzugriff darf bestehende Ereignisse nicht ändern"});
      const ev=next[next.length-1];
      const types=new Set(["goal","goalAgainst","ownGoal","yellow","red","substitution","sub","penalty"]);
      if(!ev || !types.has(ev.type) || !Number.isFinite(Number(ev.minute)) || Object.keys(ev).length>24) return res.status(400).json({error:"Ungültiges Live-Ereignis"});
    } else if(next.length===oldEvents.length-1){
      let skipped=false, j=0;
      for(let i=0;i<oldEvents.length;i++){
        if(j<next.length && JSON.stringify(oldEvents[i])===JSON.stringify(next[j])){ j++; continue; }
        if(skipped) return res.status(403).json({error:"Gastzugriff darf nur einen Live-Eintrag auf einmal löschen"});
        skipped=true;
      }
      if(!skipped || j!==next.length) return res.status(403).json({error:"Gastzugriff darf bestehende Ereignisse nicht ändern"});
    } else if(next.length!==oldEvents.length || oldEvents.some((ev,i)=>JSON.stringify(ev)!==JSON.stringify(next[i]))) {
      return res.status(403).json({error:"Gastzugriff darf bestehende Ereignisse nicht ändern oder löschen"});
    }
    const state={...(match.liveState||{})}; for(const key of allowedState) if(Object.prototype.hasOwnProperty.call(incoming.liveState,key)) state[key]=incoming.liveState[key];
    if(state.startTime!==null && state.startTime!==undefined && !Number.isFinite(Number(state.startTime))) return res.status(400).json({error:"Ungültiger Timer"});
    if(state.pausedAt!==null && state.pausedAt!==undefined && !Number.isFinite(Number(state.pausedAt))) return res.status(400).json({error:"Ungültige Pause"});
    if(!Number.isInteger(Number(state.period)) || Number(state.period)<1 || Number(state.period)>4) return res.status(400).json({error:"Ungültiges Viertel"});
    match.liveState=state; match.events=next; const tmp=FILE+".tmp"; fs.writeFileSync(tmp,JSON.stringify(data,null,2)); fs.renameSync(tmp,FILE); res.json({ok:true});
  } catch(e){ console.error("GUEST TICKER UPDATE",e); res.status(500).json({error:"Live-Ticker konnte nicht gespeichert werden"}) }
});

// ============================================================
// DATA
// ============================================================

app.get(
  "/data",
  async (req, res) => {

    try {

      const data =
        await withLivePhotoLock(() => {

          cleanupExpiredLivePhotos()

          return readData()
        })


      res.json(data)


    } catch (err) {

      console.error(
        "GET ERROR:",
        err
      )


      res.status(500).json({
        error:
          "Fehler beim Laden"
      })
    }
  }
)


// ============================================================
// SAVE
// ============================================================

const ipLog = {}


function getIP(req) {

  return (
    req.headers[
      "x-forwarded-for"
    ]?.split(",")[0] ||
    req.socket.remoteAddress
  )
}


app.post(
  "/save",
  async (req, res) => {

    try {

      // Auch das Cleanup darf nicht
      // parallel zu einem Foto-Upload laufen.

      await withLivePhotoLock(
        () =>
          cleanupExpiredLivePhotos()
      )


      const incoming =
        normalizeIncomingData(
          req.body
        )


      if (
        !incoming ||
        typeof incoming !==
        "object"
      ) {

        return res.status(400).json({
          error:
            "Ungültige Daten"
        })
      }


      const current =
        readData()


      const oldTeams =
        current.teams?.length || 0


      const newTeams =
        incoming.teams?.length || 0


      const diff =
        newTeams -
        oldTeams


      // Nur prüfen,
      // wenn neue Teams dazukommen.

      if (diff > 0) {

        const ip =
          getIP(req)


        const now =
          Date.now()


        if (!ipLog[ip]) {

          ipLog[ip] = {

            timestamps: [],

            last: 0
          }
        }


        let entry =
          ipLog[ip]


        // 5 Sekunden Cooldown

        if (
          now -
          entry.last <
          5000
        ) {

          return res.json({
            error:
              "⏳ Bitte kurz warten"
          })
        }


        entry.last =
          now


        // Alte Einträge entfernen

        entry.timestamps =
          entry.timestamps.filter(
            t =>
              now - t <
              3600000
          )


        // Limit

        if (
          entry.timestamps.length +
          diff >
          1
        ) {

          return res.json({
            error:
              "🚫 Limit erreicht (max 1 Team / Stunde)"
          })
        }


        for (
          let i = 0;
          i < diff;
          i++
        ) {

          entry.timestamps.push(
            now
          )
        }
      }


      const nextData = {

        ...incoming,

        teamPasswords: {

          ...current.teamPasswords,

          ...incoming.teamPasswords
        }
      }


      writeData(
        nextData
      )


      console.log(
        "Daten gespeichert"
      )


      res.json({
        status:
          "ok"
      })


    } catch (err) {

      console.error(
        "SAVE ERROR:",
        err
      )


      res.status(500).json({
        error:
          "Fehler beim Speichern"
      })
    }
  }
)


// ============================================================
// TIME-LIMITED TEAM SESSIONS
// ============================================================

function readTeamSessions(){
  ensureStorage();
  try { const parsed=JSON.parse(fs.readFileSync(TEAM_SESSIONS_FILE,"utf8")); return parsed && typeof parsed==="object" ? parsed : {}; }
  catch { return {}; }
}
function writeTeamSessions(sessions){
  ensureStorage(); fs.writeFileSync(TEAM_SESSIONS_FILE, JSON.stringify(sessions,null,2));
}
function hashTeamSession(token){ return crypto.createHash("sha256").update(String(token)).digest("hex"); }
function validTeamPassword(team,password){
  const current=readData();
  const saved=TEAM_PASSWORDS[team] ?? current.teamPasswords?.[team];
  return saved !== undefined && password === saved;
}
function cleanExpiredTeamSessions(sessions, now=Date.now()){
  for(const [hash,session] of Object.entries(sessions)) if(!session || !Number.isFinite(session.expiresAt) || session.expiresAt<=now) delete sessions[hash];
  return sessions;
}

app.post("/team-session/login", (req,res)=>{
  try{
    const {team,password,durationHours}=req.body||{};
    const allowed=[1,6,24,168,720];
    const hours=Number(durationHours);
    if(typeof team!=="string" || !team.trim() || !allowed.includes(hours)) return res.status(400).json({ok:false,error:"Ungültige Anmeldedauer"});
    if(!validTeamPassword(team,password)) return res.status(403).json({ok:false,error:"Team-Passwort stimmt nicht"});
    const token=crypto.randomBytes(32).toString("base64url");
    const expiresAt=Date.now()+hours*60*60*1000;
    const sessions=cleanExpiredTeamSessions(readTeamSessions());
    sessions[hashTeamSession(token)]={team,expiresAt,createdAt:Date.now()};
    writeTeamSessions(sessions);
    res.json({ok:true,token,team,expiresAt,durationHours:hours});
  }catch(error){ console.error("TEAM SESSION LOGIN ERROR",error); res.status(500).json({ok:false,error:"Anmeldung fehlgeschlagen"}); }
});

app.post("/team-session/check", (req,res)=>{
  try{
    const token=String(req.body?.token||"");
    if(!token) return res.status(400).json({ok:false});
    const sessions=cleanExpiredTeamSessions(readTeamSessions());
    const hash=hashTeamSession(token);
    const session=sessions[hash];
    writeTeamSessions(sessions);
    if(!session) return res.status(401).json({ok:false});
    res.json({ok:true,team:session.team,expiresAt:session.expiresAt});
  }catch(error){ console.error("TEAM SESSION CHECK ERROR",error); res.status(500).json({ok:false}); }
});

app.post("/team-session/logout", (req,res)=>{
  try{
    const token=String(req.body?.token||"");
    if(token){ const sessions=readTeamSessions(); delete sessions[hashTeamSession(token)]; writeTeamSessions(sessions); }
    res.json({ok:true});
  }catch(error){ console.error("TEAM SESSION LOGOUT ERROR",error); res.status(500).json({ok:false}); }
});

// ============================================================
// TEAM ACCESS CHECK
// ============================================================

app.post(
  "/check-team-access",
  (req, res) => {

    const {
      team,
      password
    } = req.body


    if (!team) {

      return res.json({
        ok: false
      })
    }


    const current =
      readData()


    const saved =
      TEAM_PASSWORDS[team] ??
      current.teamPasswords[team]


    if (
      saved !== undefined
    ) {

      if (
        password ===
        saved
      ) {

        return res.json({
          ok: true
        })

      } else {

        return res.json({
          ok: false
        })
      }
    }


    return res.json({
      ok: false
    })
  }
)


// ============================================================
// HEALTH
// ============================================================

app.get(
  "/health",
  (req, res) => {

    res.json({
      ok: true
    })
  }
)


// ============================================================
// STATIC
// ============================================================

app.use(
  express.static(
    STATIC_DIR
  )
)


app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        STATIC_DIR,
        "index.html"
      )
    )
  }
)


// ============================================================
// SERVER
// ============================================================

const PORT =
  process.env.PORT ||
  3000


app.listen(
  PORT,
  () => {

    console.log(
      "Server läuft auf Port " +
      PORT
    )
  }
)


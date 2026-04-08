import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DIST = path.join(__dirname, "..", "dist");
const QUESTION_TIME = 15;
const SHOW_TIME = 3;
const RESULTS_TIME = 4;
const MAX_PLAYERS_PER_SESSION = 500;
const MAX_SESSIONS = 50;
const HEARTBEAT_INTERVAL = 30000; // 30s ping/pong
const SESSION_TTL = 3 * 60 * 60 * 1000; // 3 hours

const MIME = {
  ".html":"text/html",".js":"application/javascript",".css":"text/css",
  ".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".svg":"image/svg+xml",".ico":"image/x-icon",".woff":"font/woff",
  ".woff2":"font/woff2",".ttf":"font/ttf",
};

// ─── State ──────────────────────────────────────────────────────────
const sessions = {};
const clients = new Map();
const genId = () => Math.random().toString(36).substring(2, 10);

// ─── Persistent DB (async writes) ───────────────────────────────────
const DATA_FILE = path.join(__dirname, "data.json");
let DB = { users: [], quizzes: [] };
let dbDirty = false;

function loadDB() {
  try { if (fs.existsSync(DATA_FILE)) DB = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { console.error("Failed to load DB:", e); }
}

function saveDB() {
  dbDirty = true;
}

// Async write — flush dirty DB every 5 seconds instead of on every change
setInterval(() => {
  if (!dbDirty) return;
  dbDirty = false;
  const data = JSON.stringify(DB, null, 2);
  fs.writeFile(DATA_FILE, data, (err) => {
    if (err) console.error("DB write error:", err);
  });
}, 5000);

// Also save on shutdown
process.on("SIGTERM", () => { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); process.exit(0); });
process.on("SIGINT", () => { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); process.exit(0); });

loadDB();

// ─── Broadcast (optimized) ──────────────────────────────────────────
function broadcast(code, msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  let sent = 0;
  for (const [ws, info] of clients) {
    if (info.code === code && ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
      sent++;
    }
  }
  if (msg.type === "phase") console.log(`Broadcast ${msg.phase} to ${sent} clients in ${code}`);
}

function sendTo(ws, msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
}

function playerList(code) {
  const s = sessions[code];
  return s ? s.players.map(p => ({ id: p.id, name: p.name, score: p.score })) : [];
}

// ─── Game Loop ──────────────────────────────────────────────────────
function startGameLoop(code) {
  const s = sessions[code];
  if (!s || !s.quiz?.questions?.length) return;

  s.currentQuestion = 0;
  s.status = "playing";
  s.answeredThisRound = new Set();

  function runQuestion() {
    const s = sessions[code];
    if (!s || s.status !== "playing") return;

    const qi = s.currentQuestion;
    const q = s.quiz.questions[qi];
    if (!q) return endGame(code);

    s.answeredThisRound = new Set();
    s.questionDeadline = null;

    broadcast(code, {
      type: "phase", phase: "showing", questionIndex: qi,
      totalQuestions: s.quiz.questions.length, question: q.text, options: q.options,
    });

    s.phaseTimer = setTimeout(() => {
      const deadline = Date.now() + QUESTION_TIME * 1000;
      s.questionDeadline = deadline;

      broadcast(code, {
        type: "phase", phase: "answering", questionIndex: qi,
        totalQuestions: s.quiz.questions.length, question: q.text, options: q.options,
        deadline, serverTime: Date.now(),
      });

      s.phaseTimer = setTimeout(() => showResults(code, qi), QUESTION_TIME * 1000);
    }, SHOW_TIME * 1000);
  }

  function showResults(code, qi) {
    const s = sessions[code];
    if (!s) return;
    clearTimeout(s.phaseTimer);
    s.questionDeadline = null;

    const q = s.quiz.questions[qi];
    broadcast(code, {
      type: "phase", phase: "results", questionIndex: qi,
      totalQuestions: s.quiz.questions.length, question: q.text, options: q.options,
      correctIndex: q.correctIndex, players: playerList(code),
    });

    s.phaseTimer = setTimeout(() => {
      s.currentQuestion++;
      if (s.currentQuestion >= s.quiz.questions.length) endGame(code);
      else runQuestion();
    }, RESULTS_TIME * 1000);
  }

  function endGame(code) {
    const s = sessions[code];
    if (!s) return;
    clearTimeout(s.phaseTimer);
    s.status = "finished";
    broadcast(code, { type: "game_ended", players: playerList(code) });
    console.log(`Game ${code} ended. ${s.players.length} players.`);
  }

  s._showResults = showResults;
  runQuestion();
}

// ─── HTTP + REST API ────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", c => {
      chunks.push(c);
      // Limit body size to 1MB
      if (Buffer.concat(chunks).length > 1024 * 1024) { req.destroy(); resolve({}); }
    });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" });
    res.end(); return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ── API ──
  if (req.url === "/api/health" && req.method === "GET") {
    const mem = process.memoryUsage();
    return sendJson(res, 200, {
      status: "ok",
      sessions: Object.keys(sessions).length,
      users: DB.users.length,
      connections: wss.clients.size,
      memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
    });
  }

  if (req.url === "/api/register" && req.method === "POST") {
    const { email, password, name } = await parseBody(req);
    if (!email || !password || !name) return sendJson(res, 400, { error: "All fields required" });
    if (DB.users.find(u => u.email === email)) return sendJson(res, 400, { error: "Email already registered" });
    const user = { id: genId(), email, password, name, createdAt: Date.now() };
    DB.users.push(user);
    saveDB();
    console.log(`User registered: ${email}`);
    return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
  }

  if (req.url === "/api/login" && req.method === "POST") {
    const { email, password } = await parseBody(req);
    if (!email || !password) return sendJson(res, 400, { error: "Email and password required" });
    const user = DB.users.find(u => u.email === email && u.password === password);
    if (!user) return sendJson(res, 401, { error: "Invalid email or password" });
    console.log(`User logged in: ${email}`);
    return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
  }

  if (req.url?.startsWith("/api/quizzes") && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");
    if (!userId) return sendJson(res, 400, { error: "userId required" });
    const quizzes = DB.quizzes.filter(q => q.userId === userId);
    return sendJson(res, 200, { quizzes });
  }

  if (req.url === "/api/quizzes" && req.method === "POST") {
    const quiz = await parseBody(req);
    if (!quiz.title || !quiz.userId || !quiz.questions?.length) return sendJson(res, 400, { error: "Invalid quiz data" });
    const idx = DB.quizzes.findIndex(q => q.id === quiz.id);
    if (idx >= 0) DB.quizzes[idx] = quiz; else DB.quizzes.push(quiz);
    saveDB();
    console.log(`Quiz saved: ${quiz.title} (${quiz.questions.length} Qs)`);
    return sendJson(res, 200, { quiz });
  }

  if (req.url?.startsWith("/api/quizzes/") && req.method === "DELETE") {
    const id = req.url.split("/api/quizzes/")[1];
    DB.quizzes = DB.quizzes.filter(q => q.id !== id);
    saveDB();
    return sendJson(res, 200, { ok: true });
  }

  // ── Static files ──
  let fp = path.join(DIST, req.url === "/" ? "index.html" : req.url);
  if (!fs.existsSync(fp)) fp = path.join(DIST, "index.html");
  try {
    const c = fs.readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
    res.end(c);
  } catch { res.writeHead(404); res.end("Not found"); }
});

// ─── WebSocket ──────────────────────────────────────────────────────
const wss = new WebSocketServer({
  server,
  maxPayload: 512 * 1024, // 512KB max message size
  perMessageDeflate: false, // disable compression for speed with many clients
});

// Heartbeat — detect and kill dead connections
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log("Terminating dead connection");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  console.log(`Client connected. Total: ${wss.clients.size}`);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "host_create": {
        if (Object.keys(sessions).length >= MAX_SESSIONS) return sendTo(ws, { type: "error", message: "Server is at capacity. Try again later." });
        const code = msg.code || genId().substring(0, 6).toUpperCase();
        sessions[code] = {
          id: genId(), code, quiz: msg.quiz, hostId: msg.hostId,
          hostWs: ws, status: "waiting", players: [], createdAt: Date.now(),
          currentQuestion: 0, phaseTimer: null, questionDeadline: null,
          answeredThisRound: new Set(),
        };
        clients.set(ws, { type: "host", code });
        sendTo(ws, { type: "session_created", code });
        console.log(`Session ${code} created. Active sessions: ${Object.keys(sessions).length}`);
        break;
      }

      case "host_reconnect": {
        const s = sessions[msg.code];
        if (!s) return sendTo(ws, { type: "error", message: "Session expired. Create a new one." });
        s.hostWs = ws;
        clients.set(ws, { type: "host", code: msg.code });
        sendTo(ws, { type: "session_restored", code: msg.code, session: { id: s.id, code: s.code, status: s.status, players: playerList(msg.code) } });
        console.log(`Host reconnected to ${msg.code}`);
        break;
      }

      case "player_join": {
        const code = msg.code?.toUpperCase();
        const s = sessions[code];
        if (!s) return sendTo(ws, { type: "error", message: "Game not found. Check the code and try again." });
        if (s.status !== "waiting") return sendTo(ws, { type: "error", message: "This game has already started" });
        if (s.players.length >= MAX_PLAYERS_PER_SESSION) return sendTo(ws, { type: "error", message: `Game is full (${MAX_PLAYERS_PER_SESSION} max)` });
        const name = msg.playerName?.trim()?.substring(0, 30); // limit name length
        if (!name) return sendTo(ws, { type: "error", message: "Username required" });
        if (s.players.find(p => p.name === name)) return sendTo(ws, { type: "error", message: "Username already taken" });

        const player = { id: genId(), name, score: 0, ws };
        s.players.push(player);
        clients.set(ws, { type: "player", code, playerId: player.id, playerName: name });
        sendTo(ws, { type: "joined", code, playerId: player.id, playerName: name, players: playerList(code) });
        broadcast(code, { type: "player_joined", players: playerList(code) }, ws);
        console.log(`${name} joined ${code} (${s.players.length}/${MAX_PLAYERS_PER_SESSION})`);
        break;
      }

      case "host_start": {
        const s = sessions[msg.code];
        if (!s) return;
        if (s.players.length === 0) return sendTo(ws, { type: "error", message: "Need at least 1 participant!" });
        console.log(`Starting game ${msg.code} with ${s.players.length} players`);
        startGameLoop(msg.code);
        break;
      }

      case "player_answer": {
        const s = sessions[msg.code];
        if (!s || s.status !== "playing") return;
        const player = s.players.find(p => p.id === msg.playerId);
        if (!player) return;
        if (s.answeredThisRound.has(msg.playerId)) return; // no double answers
        s.answeredThisRound.add(msg.playerId);

        const q = s.quiz.questions[s.currentQuestion];
        if (!q) return;
        const isCorrect = msg.answerIndex === q.correctIndex;
        let timeLeft = 0;
        if (s.questionDeadline) timeLeft = Math.max(0, (s.questionDeadline - Date.now()) / 1000);
        const points = isCorrect ? Math.round(10 + 90 * (timeLeft / QUESTION_TIME)) : 0;
        player.score += points;

        sendTo(ws, { type: "answer_result", correct: isCorrect, points, totalScore: player.score });

        if (s.hostWs?.readyState === 1) {
          sendTo(s.hostWs, { type: "score_update", players: playerList(msg.code) });
        }

        // All answered → skip to results
        if (s.answeredThisRound.size >= s.players.length) {
          clearTimeout(s.phaseTimer);
          s._showResults(msg.code, s.currentQuestion);
        }
        break;
      }

      case "host_close": {
        clearTimeout(sessions[msg.code]?.phaseTimer);
        broadcast(msg.code, { type: "session_closed" });
        delete sessions[msg.code];
        console.log(`Session ${msg.code} closed`);
        break;
      }
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info?.type === "player" && sessions[info.code]) {
      const s = sessions[info.code];
      s.players = s.players.filter(p => p.id !== info.playerId);
      broadcast(info.code, { type: "player_left", playerId: info.playerId, players: playerList(info.code) });
      console.log(`${info.playerName} left ${info.code} (${s.players.length} remaining)`);
    }
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("WS client error:", err.message);
  });
});

// ─── Cleanup stale sessions ─────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [code, s] of Object.entries(sessions)) {
    if (now - s.createdAt > SESSION_TTL) {
      clearTimeout(s.phaseTimer);
      broadcast(code, { type: "session_closed" });
      delete sessions[code];
      console.log(`Stale session ${code} cleaned up`);
    }
  }
  // Log status
  const totalPlayers = Object.values(sessions).reduce((sum, s) => sum + s.players.length, 0);
  const mem = process.memoryUsage();
  console.log(`[Status] Sessions: ${Object.keys(sessions).length} | Players: ${totalPlayers} | Connections: ${wss.clients.size} | Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
}, 60000); // every minute

server.listen(PORT, "0.0.0.0", () => {
  console.log(`QuizArena running on port ${PORT}`);
  console.log(`Max ${MAX_PLAYERS_PER_SESSION} players/session, ${MAX_SESSIONS} sessions`);
});

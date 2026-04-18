import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DIST = path.join(__dirname, "..", "dist");
const QUESTION_TIME = 22;
const SHOW_TIME = 4;
const RESULTS_TIME = 5;
const MAX_PLAYERS = 500;
const MAX_SESSIONS = 50;
const HEARTBEAT = 30000;
const SESSION_TTL = 3 * 60 * 60 * 1000;

const MIME = {
  ".html":"text/html",".js":"application/javascript",".css":"text/css",
  ".json":"application/json",".png":"image/png",".jpg":"image/jpeg",
  ".svg":"image/svg+xml",".ico":"image/x-icon",".woff":"font/woff",
  ".woff2":"font/woff2",".ttf":"font/ttf",
};

const sessions = {};
const clients = new Map();
const genId = () => Math.random().toString(36).substring(2, 10);

// ─── DB ─────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "data.json");
let DB = { users: [], quizzes: [] };
let dbDirty = false;
function loadDB() { try { if (fs.existsSync(DATA_FILE)) DB = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {} }
function saveDB() { dbDirty = true; }
setInterval(() => { if (!dbDirty) return; dbDirty = false; fs.writeFile(DATA_FILE, JSON.stringify(DB, null, 2), () => {}); }, 5000);
process.on("SIGTERM", () => { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); process.exit(0); });
process.on("SIGINT", () => { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); process.exit(0); });
loadDB();

// ─── Broadcast ──────────────────────────────────────────────────────
function broadcast(code, msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  for (const [ws, info] of clients) {
    if (info.code === code && ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}
function sendTo(ws, msg) { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); }
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

    // Show "Get Ready" with question number
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

    // Send results with current scores
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
    // FREEZE the leaderboard — capture final scores at this moment
    const finalScores = s.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
    s.finalScores = finalScores;
    broadcast(code, { type: "game_ended", players: finalScores, frozen: true });
    console.log(`Game ${code} ended. ${s.players.length} players.`);
  }

  s._showResults = showResults;
  runQuestion();
}

// ─── HTTP + API ─────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", c => { chunks.push(c); if (Buffer.concat(chunks).length > 1024 * 1024) { req.destroy(); resolve({}); } });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
  });
}
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" }); res.end(); return; }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { status: "ok", sessions: Object.keys(sessions).length, users: DB.users.length, connections: wss.clients.size, memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) });
  }
  if (req.url === "/api/register" && req.method === "POST") {
    const { email, password, name } = await parseBody(req);
    if (!email || !password || !name) return sendJson(res, 400, { error: "All fields required" });
    if (DB.users.find(u => u.email === email)) return sendJson(res, 400, { error: "Email already registered" });
    const user = { id: genId(), email, password, name, createdAt: Date.now() };
    DB.users.push(user); saveDB();
    return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
  }
  if (req.url === "/api/login" && req.method === "POST") {
    const { email, password } = await parseBody(req);
    const user = DB.users.find(u => u.email === email && u.password === password);
    if (!user) return sendJson(res, 401, { error: "Invalid email or password" });
    return sendJson(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
  }
  if (req.url?.startsWith("/api/quizzes") && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId");
    if (!userId) return sendJson(res, 400, { error: "userId required" });
    return sendJson(res, 200, { quizzes: DB.quizzes.filter(q => q.userId === userId) });
  }
  if (req.url === "/api/quizzes" && req.method === "POST") {
    const quiz = await parseBody(req);
    if (!quiz.title || !quiz.userId || !quiz.questions?.length) return sendJson(res, 400, { error: "Invalid quiz" });
    const idx = DB.quizzes.findIndex(q => q.id === quiz.id);
    if (idx >= 0) DB.quizzes[idx] = quiz; else DB.quizzes.push(quiz);
    saveDB();
    return sendJson(res, 200, { quiz });
  }
  if (req.url?.startsWith("/api/quizzes/") && req.method === "DELETE") {
    DB.quizzes = DB.quizzes.filter(q => q.id !== req.url.split("/api/quizzes/")[1]);
    saveDB();
    return sendJson(res, 200, { ok: true });
  }

  let fp = path.join(DIST, req.url === "/" ? "index.html" : req.url);
  if (!fs.existsSync(fp)) fp = path.join(DIST, "index.html");
  try { const c = fs.readFileSync(fp); res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" }); res.end(c); }
  catch { res.writeHead(404); res.end("Not found"); }
});

// ─── WebSocket ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, maxPayload: 512 * 1024, perMessageDeflate: false });
setInterval(() => { wss.clients.forEach(ws => { if (ws.isAlive === false) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, HEARTBEAT);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case "host_create": {
        if (Object.keys(sessions).length >= MAX_SESSIONS) return sendTo(ws, { type: "error", message: "Server at capacity" });
        const code = msg.code || genId().substring(0, 6).toUpperCase();
        sessions[code] = { id: genId(), code, quiz: msg.quiz, hostId: msg.hostId, hostWs: ws, status: "waiting", players: [], createdAt: Date.now(), currentQuestion: 0, phaseTimer: null, questionDeadline: null, answeredThisRound: new Set(), finalScores: null };
        clients.set(ws, { type: "host", code });
        sendTo(ws, { type: "session_created", code });
        break;
      }
      case "host_reconnect": {
        const s = sessions[msg.code];
        if (!s) return sendTo(ws, { type: "error", message: "Session expired" });
        s.hostWs = ws;
        clients.set(ws, { type: "host", code: msg.code });
        sendTo(ws, { type: "session_restored", code: msg.code, session: { id: s.id, code: s.code, status: s.status, players: playerList(msg.code) } });
        break;
      }
      case "player_join": {
        const code = msg.code?.toUpperCase();
        const s = sessions[code];
        if (!s) return sendTo(ws, { type: "error", message: "Game not found. Check the code." });
        if (s.status !== "waiting") return sendTo(ws, { type: "error", message: "Game already started" });
        if (s.players.length >= MAX_PLAYERS) return sendTo(ws, { type: "error", message: "Game full" });
        const name = msg.playerName?.trim()?.substring(0, 30);
        if (!name) return sendTo(ws, { type: "error", message: "Username required" });
        if (s.players.find(p => p.name === name)) return sendTo(ws, { type: "error", message: "Username taken" });
        const player = { id: genId(), name, score: 0, ws };
        s.players.push(player);
        clients.set(ws, { type: "player", code, playerId: player.id, playerName: name });
        sendTo(ws, { type: "joined", code, playerId: player.id, playerName: name, players: playerList(code) });
        broadcast(code, { type: "player_joined", players: playerList(code) }, ws);
        break;
      }
      case "host_start": {
        const s = sessions[msg.code];
        if (!s) return;
        if (!s.players.length) return sendTo(ws, { type: "error", message: "Need at least 1 player" });
        startGameLoop(msg.code);
        break;
      }
      case "player_answer": {
        const s = sessions[msg.code];
        if (!s || s.status !== "playing") return;
        const player = s.players.find(p => p.id === msg.playerId);
        if (!player || s.answeredThisRound.has(msg.playerId)) return;
        s.answeredThisRound.add(msg.playerId);
        const q = s.quiz.questions[s.currentQuestion];
        if (!q) return;
        const isCorrect = msg.answerIndex === q.correctIndex;
        let timeLeft = s.questionDeadline ? Math.max(0, (s.questionDeadline - Date.now()) / 1000) : 0;
        const points = isCorrect ? Math.round(10 + 90 * (timeLeft / QUESTION_TIME)) : 0;
        player.score += points;
        sendTo(ws, { type: "answer_result", correct: isCorrect, points, totalScore: player.score });
        if (s.hostWs?.readyState === 1) sendTo(s.hostWs, { type: "score_update", players: playerList(msg.code) });
        if (s.answeredThisRound.size >= s.players.length) { clearTimeout(s.phaseTimer); s._showResults(msg.code, s.currentQuestion); }
        break;
      }
      case "host_close": {
        clearTimeout(sessions[msg.code]?.phaseTimer);
        broadcast(msg.code, { type: "session_closed" });
        delete sessions[msg.code];
        break;
      }
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info?.type === "player" && sessions[info.code]) {
      const s = sessions[info.code];
      // DON'T remove player from array if game is playing or finished — preserves leaderboard
      if (s.status === "waiting") {
        s.players = s.players.filter(p => p.id !== info.playerId);
        broadcast(info.code, { type: "player_left", playerId: info.playerId, players: playerList(info.code) });
      }
    }
    clients.delete(ws);
  });

  ws.on("error", () => {});
});

setInterval(() => {
  const now = Date.now();
  for (const [code, s] of Object.entries(sessions)) {
    if (now - s.createdAt > SESSION_TTL) { clearTimeout(s.phaseTimer); broadcast(code, { type: "session_closed" }); delete sessions[code]; }
  }
}, 60000);

server.listen(PORT, "0.0.0.0", () => console.log(`QuizArena on port ${PORT}`));

import { useState, useEffect, useRef, useCallback } from "react";

const genId = () => Math.random().toString(36).substring(2, 10);
const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const getDomain = () => window.location.origin;

const getWsUrl = () => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.port === "5173" || window.location.port === "5174") return `${proto}//${window.location.hostname}:3001`;
  return `${proto}//${window.location.host}`;
};

const LS = {
  get: (k, fb = null) => { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

function parseTxtQuiz(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean); const qs = []; let c = null;
  for (const l of lines) {
    const qM = l.match(/^(?:Q?\d+[\.\)\:])\s*(.+)/i), oM = l.match(/^([A-Da-d])[\.\)]\s*(.+)/), aM = l.match(/(?:✅\s*)?(?:Answer|Correct)\s*:\s*([A-Da-d])/i);
    if (qM && !oM) { if (c?.text) qs.push(c); c = { id: genId(), text: qM[1], options: ["","","",""], correctIndex: 0 }; }
    else if (oM && c) { const i = oM[1].toUpperCase().charCodeAt(0)-65; if (i>=0&&i<4) c.options[i]=oM[2].trim(); }
    else if (aM && c) c.correctIndex = aM[1].toUpperCase().charCodeAt(0)-65;
  }
  if (c?.text) qs.push(c); return qs;
}

// ─── Icons ──────────────────────────────────────────────────────────
const I = {
  Logo: () => (<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="url(#lg)"/><path d="M10 18L15 13L20 18L25 13L26 14L20 20L15 15L10 20V18Z" fill="#fff" opacity=".9"/><path d="M10 22L15 17L20 22L25 17L26 18L20 24L15 19L10 24V22Z" fill="#fff" opacity=".6"/><defs><linearGradient id="lg" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#7c3aed"/><stop offset="1" stopColor="#a855f7"/></linearGradient></defs></svg>),
  Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Play: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>,
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Check: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Star: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Upload: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};
const OC = [{bg:"#e74c3c",shape:"▲"},{bg:"#3498db",shape:"◆"},{bg:"#f39c12",shape:"●"},{bg:"#27ae60",shape:"■"}];

// ─── WS Hook ────────────────────────────────────────────────────────
function useWs() {
  const wsRef = useRef(null); const hRef = useRef({}); const [conn, setConn] = useState(false);
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(getWsUrl());
    ws.onopen = () => { setConn(true); console.log("WS connected to", getWsUrl()); };
    ws.onclose = () => { setConn(false); console.log("WS disconnected, reconnecting..."); setTimeout(connect, 2000); };
    ws.onerror = (e) => console.error("WS error:", e);
    ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        console.log("WS received:", m.type, m);
        const handler = hRef.current[m.type];
        if (handler) {
          handler(m);
        } else {
          console.warn("No handler for WS message type:", m.type);
        }
      } catch (err) {
        console.error("WS message handler error:", err);
      }
    };
    wsRef.current = ws;
  }, []);
  const send = useCallback(m => { console.log("WS send:", m.type, m); if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(m)); else console.warn("WS not connected, cannot send:", m.type); }, []);
  const on = useCallback((t, h) => { hRef.current[t] = h; }, []);
  const off = useCallback(t => { delete hRef.current[t]; }, []);
  useEffect(() => { connect(); return () => { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } }; }, [connect]);
  return { send, on, off, connected: conn };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const ws = useWs();
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [quizzes, setQuizzes] = useState([]);
  const [sessionCode, setSessionCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [toast, setToast] = useState(null);

  // Game state from server
  const [gamePhase, setGamePhase] = useState(null); // { phase, questionIndex, totalQuestions, question, options, deadline, correctIndex, players }
  const [answerResult, setAnswerResult] = useState(null); // { correct, points, totalScore }

  const notify = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // URL join
  useEffect(() => {
    const m = window.location.pathname.match(/\/join\/([A-Za-z0-9]+)/i);
    if (m) { setJoinCode(m[1].toUpperCase()); setPage("join"); window.history.replaceState({},"","/"); }
  }, []);

  // Restore user
  useEffect(() => { const u = LS.get("qa-user"); if (u) { setUser(u); setPage("dashboard"); } }, []);

  // Restore host session
  useEffect(() => {
    if (!ws.connected || !user) return;
    const s = LS.get("qa-host-session");
    if (s?.code && page === "dashboard") ws.send({ type: "host_reconnect", code: s.code });
  }, [ws.connected, user]);

  // WS handlers — register once, never re-register
  useEffect(() => {
    ws.on("error", m => notify(m.message, "error"));
    ws.on("session_created", m => { setSessionCode(m.code); setPlayers([]); LS.set("qa-host-session",{code:m.code}); setPage("lobby"); });
    ws.on("session_restored", m => { setSessionCode(m.code); setPlayers(m.session.players||[]); setPage("lobby"); });
    ws.on("player_joined", m => setPlayers(m.players));
    ws.on("player_left", m => setPlayers(m.players));
    ws.on("joined", m => { setPlayerId(m.playerId); setSessionCode(m.code); setPlayers(m.players); setPage("waiting"); notify("Joined! Waiting for host..."); });

    // Server-driven game phases — this is the critical one
    ws.on("phase", m => {
      console.log("PHASE received:", m.phase, "question:", m.questionIndex);
      setGamePhase(m);
      setAnswerResult(null);
      setPage("game");
    });

    ws.on("answer_result", m => setAnswerResult(m));
    ws.on("score_update", m => setPlayers(m.players));
    ws.on("game_ended", m => { setPlayers(m.players); setPage("leaderboard"); });
    ws.on("session_closed", () => { notify("Host ended the session","error"); setSessionCode(null); setPage("landing"); });
    // No cleanup — handlers stay registered for entire app lifetime
  }, []); // empty deps = run once

  // Auth — uses server API
  const doAuth = async (email, pw, name) => {
    try {
      const endpoint = authMode === "register" ? "/api/register" : "/api/login";
      const body = authMode === "register" ? { email, password: pw, name } : { email, password: pw };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return notify(data.error || "Something went wrong", "error");
      setUser(data.user);
      LS.set("qa-user", data.user);
      setPage("dashboard");
      notify(authMode === "register" ? "Account created!" : "Welcome back, " + data.user.name + "!");
    } catch (e) {
      console.error("Auth error:", e);
      notify("Connection error. Try again.", "error");
    }
  };
  const doLogout = () => { setUser(null); LS.del("qa-user"); LS.del("qa-host-session"); setPage("landing"); };

  // Quiz CRUD — uses server API
  const loadQuizzes = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/quizzes?userId=${user.id}`);
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (e) { console.error("Load quizzes error:", e); }
  };
  const doSaveQuiz = async (q) => {
    try {
      const res = await fetch("/api/quizzes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
      const data = await res.json();
      if (!res.ok) return notify(data.error || "Failed to save", "error");
      setPage("dashboard");
      notify("Quiz saved!");
    } catch (e) { console.error("Save quiz error:", e); notify("Connection error", "error"); }
  };
  const doDeleteQuiz = async (id) => {
    try {
      await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      loadQuizzes();
      notify("Quiz deleted");
    } catch (e) { console.error("Delete quiz error:", e); }
  };
  useEffect(() => { if (user && page === "dashboard") loadQuizzes(); }, [user, page]);

  const doHost = quiz => { const code=genCode(); ws.send({type:"host_create",code,quiz,hostId:user.id}); };
  const doStartGame = () => ws.send({type:"host_start",code:sessionCode});
  const doEndSession = () => { ws.send({type:"host_close",code:sessionCode}); setSessionCode(null); LS.del("qa-host-session"); setPage("dashboard"); };
  const doJoin = () => { if(!joinCode.trim()||!playerName.trim()) return notify("Enter both code and username","error"); ws.send({type:"player_join",code:joinCode.trim().toUpperCase(),playerName:playerName.trim()}); };
  const doAnswer = (answerIndex) => ws.send({type:"player_answer",code:sessionCode,playerId,answerIndex});

  const isHost = !!user && !!sessionCode;

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",padding:"12px 28px",borderRadius:12,color:"#fff",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",animation:"slideDown 0.3s ease",background:toast.type==="error"?"#ef4444":"#7c3aed"}}>{toast.msg}</div>}
      {!ws.connected&&page!=="landing"&&page!=="auth"&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",padding:"8px 20px",borderRadius:8,background:"#f59e0b",color:"#000",fontSize:13,fontWeight:600,zIndex:9999}}>Connecting to server...</div>}

      {page==="landing"&&<Landing onStart={()=>{setAuthMode("register");setPage("auth")}} onLogin={()=>{setAuthMode("login");setPage("auth")}} onJoin={()=>setPage("join")}/>}
      {page==="auth"&&<Auth mode={authMode} setMode={setAuthMode} onAuth={doAuth} onBack={()=>setPage("landing")}/>}
      {page==="dashboard"&&<Dashboard user={user} quizzes={quizzes} onCreate={()=>setPage("create")} onEdit={q=>{LS.set("qa-edit",q);setPage("create")}} onDelete={doDeleteQuiz} onHost={doHost} onLogout={doLogout}/>}
      {page==="create"&&<CreateQuiz quiz={LS.get("qa-edit")} userId={user?.id} onSave={q=>{LS.del("qa-edit");doSaveQuiz(q)}} onBack={()=>{LS.del("qa-edit");setPage("dashboard")}} notify={notify}/>}
      {page==="lobby"&&<LobbyPage code={sessionCode} participants={players} onStart={doStartGame} onBack={doEndSession}/>}
      {page==="waiting"&&<WaitingPage code={sessionCode} participants={players} playerName={playerName} onBack={()=>{setSessionCode(null);setPage("landing")}}/>}
      {page==="game"&&<GamePage phase={gamePhase} onAnswer={doAnswer} answerResult={answerResult} isHost={isHost} players={players}/>}
      {page==="leaderboard"&&<LeaderboardPage players={players} onBack={()=>{if(isHost)doEndSession();else{setSessionCode(null);setPage("landing")}}} isHost={isHost}/>}
      {page==="join"&&<JoinPage code={joinCode} setCode={setJoinCode} name={playerName} setName={setPlayerName} onJoin={doJoin} onBack={()=>setPage("landing")}/>}

      <Foot/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GAME PAGE — timer synced from server deadline
// ═══════════════════════════════════════════════════════════════════
function GamePage({ phase, onAnswer, answerResult, isHost, players }) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [sel, setSel] = useState(null);
  const [shuffled, setShuffled] = useState([]);
  const timerRef = useRef(null);
  const lastQRef = useRef(-1);

  // Shuffle options when question changes
  useEffect(() => {
    if (!phase?.options || phase.questionIndex === lastQRef.current) return;
    lastQRef.current = phase.questionIndex;
    setShuffled(shuffle(phase.options.map((t, i) => ({ text: t, oi: i })).filter(o => o.text.trim())));
    setSel(null);
  }, [phase?.questionIndex]);

  // Sync timer to server deadline
  useEffect(() => {
    clearInterval(timerRef.current);
    if (phase?.phase === "answering" && phase.deadline) {
      // Calculate server-client time offset
      const serverOffset = phase.serverTime ? (Date.now() - phase.serverTime) : 0;

      const tick = () => {
        const remaining = Math.max(0, Math.ceil((phase.deadline - Date.now() + serverOffset) / 1000));
        setTimeLeft(remaining);
      };
      tick(); // immediate
      timerRef.current = setInterval(tick, 200); // update frequently for smooth display
    } else if (phase?.phase === "showing") {
      setTimeLeft(15);
    }
    return () => clearInterval(timerRef.current);
  }, [phase?.phase, phase?.deadline, phase?.questionIndex]);

  const handleAnswer = (si) => {
    if (sel !== null || phase?.phase !== "answering" || isHost) return;
    setSel(si);
    onAnswer(shuffled[si].oi); // send original index to server
  };

  if (!phase) return null;
  const pct = ((phase.questionIndex + 1) / phase.totalQuestions) * 100;
  const showCorrect = phase.phase === "results";

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"linear-gradient(180deg,#0c0a1a,#1a0e2e)"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 24px",background:"rgba(0,0,0,0.3)"}}>
        <span style={{fontSize:14,fontWeight:700,color:"#a855f7",whiteSpace:"nowrap"}}>{phase.questionIndex+1}/{phase.totalQuestions}</span>
        <div style={{flex:1,height:8,background:"rgba(255,255,255,0.1)",borderRadius:100,overflow:"hidden"}}><div style={{height:"100%",background:"linear-gradient(90deg,#7c3aed,#a855f7)",borderRadius:100,transition:"width 0.5s",width:pct+"%"}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}><I.Clock/><span style={{fontSize:24,fontWeight:800,color:timeLeft<=5?"#ef4444":"#fff",fontFamily:"'Space Mono',monospace"}}>{timeLeft}</span></div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        {phase.phase==="showing"?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
            <div style={{width:100,height:100,borderRadius:"50%",background:"rgba(168,85,247,0.2)",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 1s ease infinite"}}><span style={{fontSize:48}}>🎯</span></div>
            <h2 style={{color:"#fff",fontSize:28}}>Get Ready!</h2>
            <p style={{color:"#94a3b8",fontSize:16}}>Question {phase.questionIndex+1} of {phase.totalQuestions}</p>
          </div>
        ):(
          <>
            <h2 style={{fontSize:"clamp(20px,4vw,32px)",fontWeight:700,color:"#fff",textAlign:"center",maxWidth:700,marginBottom:40,lineHeight:1.4}}>{phase.question}</h2>

            {/* Answer feedback */}
            {answerResult && phase.phase === "answering" && (
              <div style={{marginBottom:20,padding:"10px 24px",borderRadius:12,fontSize:15,fontWeight:700,background:answerResult.correct?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)",color:answerResult.correct?"#22c55e":"#ef4444",border:answerResult.correct?"1px solid rgba(34,197,94,0.3)":"1px solid rgba(239,68,68,0.3)"}}>
                {answerResult.correct ? `Correct! +${answerResult.points} pts` : "Wrong answer!"}
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:700,width:"100%"}}>
              {shuffled.map((opt,si) => {
                const isR = showCorrect && opt.oi === phase.correctIndex;
                const isS = sel === si;
                const isWrong = showCorrect && isS && opt.oi !== phase.correctIndex;
                let ex = {};
                if (showCorrect) {
                  if (isR) ex = {boxShadow:"0 0 0 4px #22c55e,0 0 30px rgba(34,197,94,0.4)",transform:"scale(1.03)"};
                  else if (isWrong) ex = {opacity:0.4,transform:"scale(0.97)"};
                  else ex = {opacity:0.4};
                } else if (isS) ex = {boxShadow:"0 0 0 4px #fff",transform:"scale(1.02)"};

                return (
                  <button key={si} onClick={()=>handleAnswer(si)} disabled={sel!==null||phase.phase!=="answering"||isHost} style={{padding:"24px 20px",borderRadius:16,border:"none",background:OC[si%4].bg,color:"#fff",fontSize:16,fontWeight:700,cursor:isHost?"default":"pointer",fontFamily:"'Outfit',sans-serif",display:"flex",alignItems:"center",gap:12,transition:"all 0.2s",position:"relative",textAlign:"left",minHeight:70,...ex}}>
                    <span style={{fontSize:20,opacity:0.7,flexShrink:0}}>{OC[si%4].shape}</span>
                    <span style={{flex:1,lineHeight:1.4}}>{opt.text}</span>
                    {showCorrect&&isR&&<span style={{position:"absolute",top:8,right:8,color:"#22c55e"}}><I.Check/></span>}
                    {showCorrect&&isWrong&&<span style={{position:"absolute",top:8,right:8,color:"#ef4444"}}><I.X/></span>}
                  </button>
                );
              })}
            </div>

            {/* Host sees live scores during results */}
            {isHost && showCorrect && players.length > 0 && (
              <div style={{marginTop:24,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:16,maxWidth:400,width:"100%"}}>
                <p style={{fontSize:13,fontWeight:600,color:"#94a3b8",margin:"0 0 8px"}}>Live Scores</p>
                {[...players].sort((a,b)=>b.score-a.score).slice(0,5).map((p,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13,color:"#e2e8f0"}}>
                    <span>{i+1}. {p.name}</span><span style={{color:"#a855f7",fontWeight:700}}>{p.score} pts</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OTHER PAGES (same structure, cleaned up)
// ═══════════════════════════════════════════════════════════════════
function Landing({ onStart, onLogin, onJoin }) {
  return (<div style={S.center}><div style={{textAlign:"center",maxWidth:900,padding:"40px 20px"}}>
    <div style={S.badge}><I.Star/> <span>Live Quiz Platform</span></div>
    <h1 style={S.heroTitle}>Make Learning<br/><span style={S.accent}>Unforgettable</span></h1>
    <p style={S.heroSub}>Create interactive quizzes, host live sessions with up to 500 players, and watch the competition heat up in real-time.</p>
    <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
      <button onClick={onStart} style={{...S.pri,padding:"16px 40px",fontSize:16}}>Create a Quiz</button>
      <button onClick={onJoin} style={{...S.out,padding:"16px 40px",fontSize:16}}>Join a Quiz</button>
    </div>
    <button onClick={onLogin} style={{...S.lnk,marginTop:24}}>Already have an account? <span style={{color:"#a855f7"}}>Sign in</span></button>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginTop:60}}>
      {[{i:"⚡",t:"Real-time",d:"Speed-based scoring"},{i:"🎮",t:"500 Players",d:"Host massive sessions"},{i:"📄",t:"Batch Upload",d:"Import from .txt files"},{i:"🏆",t:"Leaderboards",d:"Instant final rankings"}].map((f,x)=>(<div key={x} style={S.feat}><span style={{fontSize:28}}>{f.i}</span><h3 style={{fontSize:16,fontWeight:700,margin:"12px 0 6px"}}>{f.t}</h3><p style={{fontSize:13,color:"#94a3b8",margin:0}}>{f.d}</p></div>))}
    </div></div></div>);
}

function Auth({ mode, setMode, onAuth, onBack }) {
  const [em,setEm]=useState("");const [pw,setPw]=useState("");const [nm,setNm]=useState("");
  const go=()=>{if(em&&pw&&(mode==="login"||nm))onAuth(em,pw,nm)};const kd=e=>{if(e.key==="Enter")go()};
  return (<div style={S.center}><div style={{width:"100%",maxWidth:420,padding:"0 20px"}}>
    <button onClick={onBack} style={S.bk}><I.Back/> Back</button>
    <div style={S.card}><div style={{textAlign:"center",marginBottom:32}}><I.Logo/><h2 style={{fontSize:24,fontWeight:700,margin:"16px 0 8px"}}>{mode==="login"?"Welcome Back":"Create Account"}</h2><p style={{fontSize:14,color:"#94a3b8"}}>{mode==="login"?"Sign in to manage your quizzes":"Start creating amazing quizzes"}</p></div>
      {mode==="register"&&<div style={S.field}><label style={S.label}>Full Name</label><input style={S.inp} placeholder="Enter your name" value={nm} onChange={e=>setNm(e.target.value)} onKeyDown={kd}/></div>}
      <div style={S.field}><label style={S.label}>Email</label><input style={S.inp} type="email" placeholder="you@example.com" value={em} onChange={e=>setEm(e.target.value)} onKeyDown={kd}/></div>
      <div style={S.field}><label style={S.label}>Password</label><input style={S.inp} type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={kd}/></div>
      <button onClick={go} style={{...S.pri,width:"100%",padding:14,marginTop:8}}>{mode==="login"?"Sign In":"Create Account"}</button>
      <p style={{textAlign:"center",marginTop:24,fontSize:14,color:"#64748b"}}>{mode==="login"?"No account?":"Have an account?"}<button onClick={()=>setMode(mode==="login"?"register":"login")} style={{...S.lnk,marginLeft:6,color:"#a855f7",fontWeight:600}}>{mode==="login"?"Sign up":"Sign in"}</button></p>
    </div></div></div>);
}

function Dashboard({ user, quizzes, onCreate, onEdit, onDelete, onHost, onLogout }) {
  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}><div style={S.hdr}><div style={{display:"flex",alignItems:"center",gap:12}}><I.Logo/><span style={{fontSize:20,fontWeight:800}}>QuizArena</span></div><div style={{display:"flex",alignItems:"center",gap:16}}><span style={{fontSize:14,color:"#94a3b8"}}>{user?.name}</span><button onClick={onLogout} style={S.ib}><I.Logout/></button></div></div>
    <div style={{padding:32,maxWidth:1000,width:"100%",margin:"0 auto",flex:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:32,flexWrap:"wrap",gap:16}}><div><h1 style={{fontSize:28,fontWeight:800,margin:0}}>My Quizzes</h1><p style={{fontSize:14,color:"#64748b",margin:"4px 0 0"}}>{quizzes.length} quiz{quizzes.length!==1?"zes":""}</p></div><button onClick={onCreate} style={{...S.pri,display:"flex",alignItems:"center",gap:8}}><I.Plus/> New Quiz</button></div>
      {!quizzes.length?<div style={{textAlign:"center",padding:"60px 20px",background:"rgba(255,255,255,0.02)",borderRadius:24,border:"2px dashed rgba(255,255,255,0.1)"}}><div style={{fontSize:56,marginBottom:16}}>🎯</div><h3 style={{fontSize:20,fontWeight:700,margin:"0 0 8px"}}>No quizzes yet</h3><p style={{fontSize:14,color:"#64748b",margin:"0 0 24px"}}>Create your first quiz!</p><button onClick={onCreate} style={S.pri}>Create Quiz</button></div>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>{quizzes.map(q=><div key={q.id} style={S.qzC}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={S.qzB}>{q.questions?.length||0} Qs</span><button onClick={()=>onDelete(q.id)} style={S.del}><I.Trash/></button></div><h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px"}}>{q.title}</h3><p style={{fontSize:13,color:"#64748b",margin:"0 0 20px"}}>{q.description||"No description"}</p><div style={{display:"flex",gap:10}}><button onClick={()=>onEdit(q)} style={S.sm}>Edit</button><button onClick={()=>onHost(q)} style={{...S.smP,display:"flex",alignItems:"center",gap:6}}><I.Play/> Host</button></div></div>)}</div>}
    </div></div>);
}

function CreateQuiz({ quiz, userId, onSave, onBack, notify }) {
  const [t,setT]=useState(quiz?.title||"");const [d,setD]=useState(quiz?.description||"");
  const [qs,setQs]=useState(quiz?.questions||[{id:genId(),text:"",options:["","","",""],correctIndex:0}]);const fr=useRef(null);
  const addQ=()=>{if(qs.length<50)setQs([...qs,{id:genId(),text:"",options:["","","",""],correctIndex:0}])};
  const rmQ=i=>{if(qs.length>1)setQs(qs.filter((_,x)=>x!==i))};
  const uQ=(i,f,v)=>{const u=[...qs];u[i]={...u[i],[f]:v};setQs(u)};
  const uO=(qi,oi,v)=>{const u=[...qs];u[qi]={...u[qi],options:[...u[qi].options]};u[qi].options[oi]=v;setQs(u)};
  const hf=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseTxtQuiz(ev.target.result);if(!p.length)return notify("No questions found","error");setQs(p);const fl=ev.target.result.split("\n").find(l=>l.trim());if(fl&&!fl.match(/^Q?\d/i))setT(fl.trim());notify(p.length+" questions imported!")};r.readAsText(f);e.target.value=""};
  const sv=()=>{if(!t.trim())return notify("Enter a title","error");const v=qs.filter(q=>q.text.trim()&&q.options.filter(o=>o.trim()).length>=2);if(!v.length)return notify("Need 1+ questions with 2+ options","error");onSave({id:quiz?.id||genId(),userId,title:t.trim(),description:d.trim(),questions:v,createdAt:quiz?.createdAt||Date.now(),updatedAt:Date.now()})};
  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}><div style={{...S.hdr,justifyContent:"space-between"}}><button onClick={onBack} style={S.bk}><I.Back/> Back</button><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><input type="file" accept=".txt" ref={fr} onChange={hf} style={{display:"none"}}/><button onClick={()=>fr.current?.click()} style={{...S.out,display:"flex",alignItems:"center",gap:8,padding:"10px 20px"}}><I.Upload/> Upload .txt</button><button onClick={sv} style={S.pri}>Save Quiz</button></div></div>
    <div style={{padding:32,maxWidth:800,width:"100%",margin:"0 auto",flex:1}}>
      <div style={{background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:"14px 20px",marginBottom:24,fontSize:13,color:"#c084fc"}}>💡 <strong>Batch upload:</strong> Upload a .txt file with Q1./A./B./C./D./Answer: format</div>
      <div style={{marginBottom:32}}><input style={{width:"100%",padding:16,background:"transparent",border:"none",borderBottom:"2px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:32,fontWeight:800,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box"}} placeholder="Quiz Title" value={t} onChange={e=>setT(e.target.value)}/><input style={{width:"100%",padding:"12px 16px",background:"transparent",border:"none",color:"#94a3b8",fontSize:16,outline:"none",marginTop:8,boxSizing:"border-box"}} placeholder="Description (optional)" value={d} onChange={e=>setD(e.target.value)}/></div>
      {qs.map((q,qi)=><div key={q.id} style={S.qC}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:13,fontWeight:700,color:"#a855f7",textTransform:"uppercase",letterSpacing:1}}>Q{qi+1}</span>{qs.length>1&&<button onClick={()=>rmQ(qi)} style={S.del}><I.Trash/></button>}</div><input style={{...S.inp,fontSize:16,marginBottom:16}} placeholder="Question..." value={q.text} onChange={e=>uQ(qi,"text",e.target.value)}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{q.options.map((o,oi)=><div key={oi} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"4px 4px 4px 12px",borderLeft:"4px solid "+OC[oi].bg}}><input style={{flex:1,padding:"10px 8px",background:"transparent",border:"none",color:"#fff",fontSize:14,outline:"none"}} placeholder={String.fromCharCode(65+oi)} value={o} onChange={e=>uO(qi,oi,e.target.value)}/><button onClick={()=>uQ(qi,"correctIndex",oi)} style={{width:36,height:36,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:q.correctIndex===oi?"#22c55e":"transparent",color:q.correctIndex===oi?"#fff":"#94a3b8",border:q.correctIndex===oi?"none":"2px solid #334155"}}>{q.correctIndex===oi&&<I.Check/>}</button></div>)}</div></div>)}
      {qs.length<50&&<button onClick={addQ} style={{width:"100%",padding:16,background:"rgba(168,85,247,0.1)",border:"2px dashed rgba(168,85,247,0.3)",borderRadius:16,color:"#a855f7",fontSize:15,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><I.Plus/> Add ({qs.length}/50)</button>}
    </div></div>);
}

function LobbyPage({ code, participants, onStart, onBack }) {
  const [cp,setCp]=useState(false);const url=getDomain()+"/join/"+code;
  const copy=()=>{navigator.clipboard?.writeText(url);setCp(true);setTimeout(()=>setCp(false),2000)};
  return (<div style={{...S.center,position:"relative"}}><button onClick={onBack} style={{...S.bk,position:"absolute",top:24,left:24}}><I.Back/> End</button>
    <div style={{textAlign:"center",maxWidth:700,width:"100%",padding:"0 20px"}}>
      <p style={{fontSize:14,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:3,margin:"0 0 12px"}}>GAME PIN</p>
      <div style={{fontSize:"clamp(48px,10vw,80px)",fontWeight:900,letterSpacing:12,fontFamily:"'Space Mono',monospace",textShadow:"0 0 40px rgba(168,85,247,0.5)"}}>{code}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:16,flexWrap:"wrap"}}><span style={{fontSize:13,color:"#64748b",background:"rgba(255,255,255,0.06)",padding:"8px 16px",borderRadius:8,wordBreak:"break-all"}}>{url}</span><button onClick={copy} style={{background:"rgba(168,85,247,0.2)",border:"none",borderRadius:8,padding:"8px 16px",color:"#c084fc",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>{cp?"Copied!":<><I.Copy/> Copy</>}</button></div>
      <div style={{background:"rgba(255,255,255,0.03)",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",padding:24,marginTop:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:600,color:"#c084fc"}}><I.Users/> {participants.length}/500</span><span style={{fontSize:12,color:"#475569"}}><span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",display:"inline-block",marginRight:6}}></span>Live</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,minHeight:80}}>{participants.map((p,i)=><div key={p.id||i} style={{background:"linear-gradient(135deg,rgba(124,58,237,0.2),rgba(168,85,247,0.1))",border:"1px solid rgba(168,85,247,0.3)",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,color:"#e2e8f0",animation:"fadeIn 0.3s ease both"}}>{p.name}</div>)}{!participants.length&&<p style={{color:"#94a3b8",textAlign:"center",gridColumn:"1/-1",padding:"40px 0"}}>Waiting for players...</p>}</div>
      </div>
      <button onClick={onStart} style={{...S.pri,padding:"18px 60px",fontSize:18,marginTop:24,display:"inline-flex",alignItems:"center",gap:10}}><I.Play/> Start Quiz</button>
    </div></div>);
}

function WaitingPage({ code, participants, playerName, onBack }) {
  return (<div style={S.center}><div style={{textAlign:"center",maxWidth:500,padding:"0 20px"}}>
    <div style={{width:100,height:100,borderRadius:"50%",background:"rgba(168,85,247,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px",animation:"pulse 2s ease infinite"}}><span style={{fontSize:48}}>⏳</span></div>
    <h2 style={{fontSize:28,fontWeight:800,margin:"0 0 8px"}}>You're In!</h2>
    <p style={{fontSize:16,color:"#94a3b8",margin:"0 0 32px"}}>Playing as <span style={{color:"#a855f7",fontWeight:700}}>{playerName}</span> — waiting for host...</p>
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)",padding:20}}>
      <p style={{fontSize:13,color:"#94a3b8",margin:"0 0 12px"}}>{participants.length} player{participants.length!==1?"s":""}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>{participants.map((p,i)=><span key={i} style={{fontSize:13,padding:"6px 12px",borderRadius:8,background:p.name===playerName?"rgba(168,85,247,0.3)":"rgba(255,255,255,0.06)",color:p.name===playerName?"#c084fc":"#94a3b8",fontWeight:p.name===playerName?700:500}}>{p.name}</span>)}</div>
    </div><button onClick={onBack} style={{...S.lnk,marginTop:24}}>Leave</button>
  </div></div>);
}

function JoinPage({ code, setCode, name, setName, onJoin, onBack }) {
  const kd=e=>{if(e.key==="Enter")onJoin()};
  return (<div style={S.center}><div style={{width:"100%",maxWidth:420,padding:"0 20px"}}>
    <button onClick={onBack} style={S.bk}><I.Back/> Back</button>
    <div style={S.card}><div style={{textAlign:"center",marginBottom:32}}><I.Logo/><h2 style={{fontSize:24,fontWeight:700,margin:"16px 0 8px"}}>Join a Quiz</h2><p style={{fontSize:14,color:"#94a3b8"}}>Enter the game PIN from the host</p></div>
      <div style={S.field}><label style={S.label}>Game PIN</label><input style={{...S.inp,textAlign:"center",fontSize:24,letterSpacing:8,fontWeight:700}} placeholder="ABC123" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} onKeyDown={kd}/></div>
      <div style={S.field}><label style={S.label}>Your Username</label><input style={S.inp} placeholder="e.g. DiscordUser#1234" value={name} onChange={e=>setName(e.target.value)} onKeyDown={kd}/></div>
      <button onClick={onJoin} style={{...S.pri,width:"100%",padding:16,marginTop:8}}>Join Game</button>
    </div></div></div>);
}

function LeaderboardPage({ players, onBack, isHost }) {
  const sorted=[...players].sort((a,b)=>b.score-a.score);const top3=sorted.slice(0,3);const rest=sorted.slice(3);const medals=["🥇","🥈","🥉"];const hts=[140,180,120];const ord=[1,0,2];
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 20px",background:"linear-gradient(180deg,#0c0a1a,#1a0e2e)"}}>
    <div style={{textAlign:"center",marginBottom:40}}><h1 style={{fontSize:32,fontWeight:800,margin:"0 0 8px",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}><I.Trophy/> Final Results</h1></div>
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:12,marginBottom:40,maxWidth:500,width:"100%"}}>{ord.map(idx=>{const p=top3[idx];if(!p)return<div key={idx} style={{flex:1}}/>;return <div key={idx} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}><span style={{fontSize:32,marginBottom:8}}>{medals[idx]}</span><p style={{fontSize:14,fontWeight:700,margin:"0 0 4px",textAlign:"center"}}>{p.name}</p><p style={{fontSize:13,color:"#c084fc",fontWeight:600,margin:"0 0 8px"}}>{p.score} pts</p><div style={{width:"100%",borderRadius:"12px 12px 0 0",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:16,height:hts[idx],background:idx===0?"linear-gradient(180deg,#a855f7,#7c3aed)":idx===1?"linear-gradient(180deg,#8b5cf6,#6d28d9)":"linear-gradient(180deg,#7c3aed,#5b21b6)"}}><span style={{fontSize:24,fontWeight:900,color:"rgba(255,255,255,0.3)"}}>#{idx+1}</span></div></div>})}</div>
    {rest.length>0&&<div style={{maxWidth:500,width:"100%",background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>{rest.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:16,padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{fontSize:14,fontWeight:700,color:"#64748b",width:40}}>#{i+4}</span><span style={{flex:1,fontSize:15,fontWeight:600,color:"#e2e8f0"}}>{p.name}</span><span style={{fontSize:14,fontWeight:700,color:"#a855f7"}}>{p.score} pts</span></div>)}</div>}
    <button onClick={onBack} style={{...S.pri,padding:"16px 48px",marginTop:32}}>{isHost?"Dashboard":"Leave"}</button>
  </div>);
}

function Foot() {
  return (<footer style={{borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)",padding:"40px 32px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",maxWidth:1000,margin:"0 auto",flexWrap:"wrap",gap:32,paddingBottom:32}}>
      <div style={{maxWidth:300}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><I.Logo/><span style={{fontSize:18,fontWeight:800}}>QuizArena</span></div><p style={{fontSize:13,color:"#64748b",margin:0}}>Live quiz platform for communities and events.</p></div>
      <div style={{display:"flex",gap:48}}><div style={{display:"flex",flexDirection:"column",gap:10}}><h4 style={{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,margin:"0 0 4px"}}>Platform</h4><span style={{fontSize:14,color:"#64748b"}}>Create Quiz</span><span style={{fontSize:14,color:"#64748b"}}>Join Game</span></div><div style={{display:"flex",flexDirection:"column",gap:10}}><h4 style={{fontSize:13,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,margin:"0 0 4px"}}>Community</h4><span style={{fontSize:14,color:"#64748b"}}>Discord</span><span style={{fontSize:14,color:"#64748b"}}>Twitter</span></div></div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 0",borderTop:"1px solid rgba(255,255,255,0.06)",maxWidth:1000,margin:"0 auto",flexWrap:"wrap",gap:12}}><span style={{fontSize:13,color:"#475569"}}>Inspired by <span style={{color:"#a855f7",fontWeight:600}}>GenLayer Community</span> · Built by <span style={{color:"#a855f7",fontWeight:600}}>Amie</span></span><span style={{fontSize:13,color:"#475569"}}>© 2026 QuizArena</span></div>
  </footer>);
}

const S = {
  center:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"},
  badge:{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 20px",borderRadius:100,fontSize:13,fontWeight:600,background:"rgba(168,85,247,0.15)",color:"#c084fc",border:"1px solid rgba(168,85,247,0.3)",marginBottom:24},
  heroTitle:{fontSize:"clamp(36px,7vw,72px)",fontWeight:800,lineHeight:1.1,margin:"0 0 20px"},
  accent:{background:"linear-gradient(135deg,#a855f7,#ec4899,#f97316)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  heroSub:{fontSize:18,lineHeight:1.7,color:"#94a3b8",maxWidth:560,margin:"0 auto 36px"},
  feat:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"24px 16px",textAlign:"center"},
  pri:{background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"},
  out:{background:"transparent",color:"#c084fc",border:"2px solid rgba(168,85,247,0.4)",borderRadius:12,padding:"12px 28px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"},
  sm:{background:"transparent",color:"#c084fc",border:"1px solid rgba(168,85,247,0.4)",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"},
  smP:{background:"linear-gradient(135deg,#7c3aed,#a855f7)",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"},
  lnk:{background:"none",border:"none",color:"#64748b",fontSize:14,cursor:"pointer",fontFamily:"inherit"},
  bk:{background:"none",border:"none",color:"#94a3b8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontWeight:500,padding:"8px 0",marginBottom:16},
  ib:{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,padding:8,cursor:"pointer",color:"#94a3b8",display:"flex"},
  del:{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:4,display:"flex"},
  card:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:40},
  field:{marginBottom:20},
  label:{display:"block",fontSize:13,fontWeight:600,color:"#94a3b8",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5},
  inp:{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.06)",border:"2px solid rgba(255,255,255,0.1)",borderRadius:12,color:"#fff",fontSize:15,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box"},
  hdr:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 32px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  qzC:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:24},
  qzB:{fontSize:12,fontWeight:600,color:"#a855f7",padding:"4px 12px",background:"rgba(168,85,247,0.15)",borderRadius:100},
  qC:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:24,marginBottom:20},
};

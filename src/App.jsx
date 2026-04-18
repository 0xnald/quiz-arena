import { useState, useEffect, useRef, useCallback } from "react";

const genId = () => Math.random().toString(36).substring(2, 10);
const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const getDomain = () => window.location.origin;
const QT = 22; // question time in seconds

const getWsUrl = () => {
  const p = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (window.location.port === "5173" || window.location.port === "5174") return `${p}//${window.location.hostname}:3001`;
  return `${p}//${window.location.host}`;
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

// ─── Theme Toggle ───────────────────────────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("qa-theme");
    return saved ? saved === "dark" : true; // default dark
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("qa-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button onClick={() => setDark(!dark)} title={dark ? "Switch to light" : "Switch to dark"}
      style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: "var(--toggle-bg)", position: "relative", cursor: "pointer", padding: 0, transition: "background 0.3s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--text)", position: "absolute", top: 3, left: dark ? 3 : 23, transition: "left 0.25s ease, background 0.3s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────
const I = {
  Logo: () => (<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M8 16L12 12L16 16L20 12L21 13L16 18L12 14L8 18V16Z" fill="var(--accent-text)" opacity=".9"/><path d="M8 20L12 16L16 20L20 16L21 17L16 22L12 18L8 22V20Z" fill="var(--accent-text)" opacity=".5"/></svg>),
  Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Play: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Logout: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Upload: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Arrow: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
};

// ─── WS Hook ────────────────────────────────────────────────────────
function useWs() {
  const wsRef = useRef(null); const hRef = useRef({}); const [conn, setConn] = useState(false);
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(getWsUrl());
    ws.onopen = () => setConn(true); ws.onclose = () => { setConn(false); setTimeout(connect, 2000); };
    ws.onerror = () => {};
    ws.onmessage = e => { try { const m = JSON.parse(e.data); hRef.current[m.type]?.(m); } catch (err) { console.error("WS:", err); } };
    wsRef.current = ws;
  }, []);
  const send = useCallback(m => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(m)); }, []);
  const on = useCallback((t, h) => { hRef.current[t] = h; }, []);
  useEffect(() => { connect(); return () => { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } }; }, [connect]);
  return { send, on, connected: conn };
}

// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const ws = useWs();
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [quizzes, setQuizzes] = useState([]);
  const [sessionCode, setSessionCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [frozenPlayers, setFrozenPlayers] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [toast, setToast] = useState(null);
  const [gamePhase, setGamePhase] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);

  const notify = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => { const m = window.location.pathname.match(/\/join\/([A-Za-z0-9]+)/i); if (m) { setJoinCode(m[1].toUpperCase()); setPage("join"); window.history.replaceState({},"","/"); } }, []);
  useEffect(() => { const u = LS.get("qa-user"); if (u) { setUser(u); setPage("dashboard"); } }, []);
  useEffect(() => { if (!ws.connected||!user) return; const s=LS.get("qa-host-session"); if (s?.code&&page==="dashboard") ws.send({type:"host_reconnect",code:s.code}); }, [ws.connected, user]);

  useEffect(() => {
    ws.on("error", m => notify(m.message, "error"));
    ws.on("session_created", m => { setSessionCode(m.code); setPlayers([]); LS.set("qa-host-session",{code:m.code}); setPage("lobby"); });
    ws.on("session_restored", m => { setSessionCode(m.code); setPlayers(m.session.players||[]); setPage("lobby"); });
    ws.on("player_joined", m => setPlayers(m.players));
    ws.on("player_left", m => setPlayers(m.players));
    ws.on("joined", m => { setPlayerId(m.playerId); setSessionCode(m.code); setPlayers(m.players); setPage("waiting"); notify("Joined!"); });
    ws.on("phase", m => { setGamePhase(m); if (m.phase==="showing") setAnswerResult(null); setPage("game"); });
    ws.on("answer_result", m => setAnswerResult(m));
    ws.on("score_update", m => setPlayers(m.players));
    ws.on("game_ended", m => { setFrozenPlayers(m.players); setPage("leaderboard"); });
    ws.on("session_closed", () => { notify("Session ended","error"); setSessionCode(null); setPage(LS.get("qa-user")?"dashboard":"landing"); });
  }, []);

  const doAuth = async (email, pw, name) => {
    try { const r = await fetch(authMode==="register"?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(authMode==="register"?{email,password:pw,name}:{email,password:pw})}); const d=await r.json(); if(!r.ok) return notify(d.error,"error"); setUser(d.user); LS.set("qa-user",d.user); setPage("dashboard"); notify(authMode==="register"?"Account created!":"Welcome back!"); } catch { notify("Connection error","error"); }
  };
  const doLogout = () => { setUser(null); LS.del("qa-user"); LS.del("qa-host-session"); setPage("landing"); };
  const loadQuizzes = async () => { if(!user)return; try{const r=await fetch(`/api/quizzes?userId=${user.id}`);const d=await r.json();setQuizzes(d.quizzes||[])}catch{} };
  const doSaveQuiz = async q => { try{const r=await fetch("/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(q)});if(!r.ok){const d=await r.json();return notify(d.error,"error")}setPage("dashboard");notify("Saved!")}catch{notify("Error","error")} };
  const doDeleteQuiz = async id => { try{await fetch(`/api/quizzes/${id}`,{method:"DELETE"});loadQuizzes();notify("Deleted")}catch{} };
  useEffect(() => { if(user&&page==="dashboard")loadQuizzes() }, [user,page]);

  const doHost = q => ws.send({type:"host_create",code:genCode(),quiz:q,hostId:user.id});
  const doStart = () => ws.send({type:"host_start",code:sessionCode});
  const doEnd = () => { ws.send({type:"host_close",code:sessionCode}); setSessionCode(null); LS.del("qa-host-session"); setPage("dashboard"); };
  const doJoin = () => { if(!joinCode.trim()||!playerName.trim()) return notify("Fill in both fields","error"); ws.send({type:"player_join",code:joinCode.trim().toUpperCase(),playerName:playerName.trim()}); };
  const doAnswer = idx => ws.send({type:"player_answer",code:sessionCode,playerId,answerIndex:idx});
  const isHost = !!user&&!!sessionCode;

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"var(--bg)",color:"var(--text)",transition:"background 0.3s,color 0.3s"}}>
      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",padding:"12px 24px",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"var(--shadow)",animation:"slideDown 0.3s ease",background:toast.type==="error"?"var(--red)":"var(--accent)"}}>{toast.msg}</div>}
      {!ws.connected&&page!=="landing"&&page!=="auth"&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",padding:"8px 20px",borderRadius:8,background:"#fbbf24",color:"#000",fontSize:13,fontWeight:600,zIndex:9999}}>Connecting...</div>}

      {page==="landing"&&<Landing onStart={()=>{setAuthMode("register");setPage("auth")}} onLogin={()=>{setAuthMode("login");setPage("auth")}} onJoin={()=>setPage("join")}/>}
      {page==="auth"&&<Auth mode={authMode} setMode={setAuthMode} onAuth={doAuth} onBack={()=>setPage("landing")}/>}
      {page==="dashboard"&&<Dash user={user} quizzes={quizzes} onCreate={()=>setPage("create")} onEdit={q=>{LS.set("qa-edit",q);setPage("create")}} onDelete={doDeleteQuiz} onHost={doHost} onLogout={doLogout}/>}
      {page==="create"&&<CreateQuiz quiz={LS.get("qa-edit")} userId={user?.id} onSave={q=>{LS.del("qa-edit");doSaveQuiz(q)}} onBack={()=>{LS.del("qa-edit");setPage("dashboard")}} notify={notify}/>}
      {page==="lobby"&&<Lobby code={sessionCode} participants={players} onStart={doStart} onBack={doEnd}/>}
      {page==="waiting"&&<Waiting participants={players} playerName={playerName} onBack={()=>{setSessionCode(null);setPage("landing")}}/>}
      {page==="game"&&<Game phase={gamePhase} onAnswer={doAnswer} answerResult={answerResult} isHost={isHost} players={players}/>}
      {page==="leaderboard"&&<LB players={frozenPlayers||players} onBack={()=>{setFrozenPlayers(null);if(isHost)doEnd();else{setSessionCode(null);setPage("landing")}}} isHost={isHost}/>}
      {page==="join"&&<Join code={joinCode} setCode={setJoinCode} name={playerName} setName={setPlayerName} onJoin={doJoin} onBack={()=>setPage("landing")}/>}
      <Foot/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GAME
// ═══════════════════════════════════════════════════════════════════
function Game({ phase, onAnswer, answerResult, isHost, players }) {
  const [timeLeft,setTimeLeft]=useState(QT);const [sel,setSel]=useState(null);const [shuffled,setShuffled]=useState([]);const timerRef=useRef(null);const lastQ=useRef(-1);

  useEffect(()=>{if(!phase?.options||phase.questionIndex===lastQ.current)return;lastQ.current=phase.questionIndex;setShuffled(shuffle(phase.options.map((t,i)=>({text:t,oi:i})).filter(o=>o.text.trim())));setSel(null)},[phase?.questionIndex]);

  useEffect(()=>{clearInterval(timerRef.current);if(phase?.phase==="answering"&&phase.deadline){const off=phase.serverTime?(Date.now()-phase.serverTime):0;const tick=()=>setTimeLeft(Math.max(0,Math.ceil((phase.deadline-Date.now()+off)/1000)));tick();timerRef.current=setInterval(tick,250)}else if(phase?.phase==="showing")setTimeLeft(QT);return()=>clearInterval(timerRef.current)},[phase?.phase,phase?.deadline,phase?.questionIndex]);

  const pick=si=>{if(sel!==null||phase?.phase!=="answering"||isHost)return;setSel(si);onAnswer(shuffled[si].oi)};
  if(!phase)return null;
  const pct=(timeLeft/QT)*100;const qNum=phase.questionIndex+1;const showC=phase.phase==="results";

  if(phase.phase==="showing")return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
      <div style={{animation:"countIn 0.4s ease",textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:"var(--bg-subtle)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px",border:"2px solid var(--border)"}}>
          <span style={{fontSize:36,fontWeight:700}}>{qNum}</span>
        </div>
        <p style={{fontSize:14,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:3,marginBottom:8}}>Question {qNum} of {phase.totalQuestions}</p>
        <h2 style={{fontSize:28,fontWeight:700,maxWidth:600,lineHeight:1.4}}>{phase.question}</h2>
        <div style={{marginTop:32,display:"flex",gap:8,justifyContent:"center"}}>
          {Array.from({length:phase.totalQuestions}).map((_,i)=>(
            <div key={i} style={{width:i===phase.questionIndex?24:8,height:8,borderRadius:4,background:i<phase.questionIndex?"var(--text-secondary)":i===phase.questionIndex?"var(--text)":"var(--border)",transition:"all 0.3s"}}/>
          ))}
        </div>
      </div>
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 24px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--text-muted)"}}>Question {qNum}/{phase.totalQuestions}</span>
          <span style={{fontSize:28,fontWeight:700,fontFamily:"var(--mono)",color:timeLeft<=5?"var(--red)":"var(--text)"}}>{timeLeft}s</span>
        </div>
        <div style={{height:4,background:"var(--bg-subtle)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:timeLeft<=5?"var(--red)":"var(--text)",borderRadius:2,transition:"width 0.3s linear",width:pct+"%"}}/>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px 40px",maxWidth:800,width:"100%",margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(20px,3.5vw,30px)",fontWeight:700,textAlign:"center",marginBottom:32,lineHeight:1.5,animation:"fadeUp 0.3s ease"}}>{phase.question}</h2>

        {answerResult&&<div style={{marginBottom:20,padding:"12px 24px",borderRadius:10,fontSize:15,fontWeight:700,animation:"fadeIn 0.3s ease",background:answerResult.correct?"var(--green-bg)":"var(--red-bg)",color:answerResult.correct?"var(--green)":"var(--red)",border:answerResult.correct?"1px solid var(--green-border)":"1px solid var(--red-border)"}}>{answerResult.correct?`Correct! +${answerResult.points} pts`:"Wrong — 0 pts"}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,width:"100%"}}>
          {shuffled.map((opt,si)=>{
            const isR=showC&&opt.oi===phase.correctIndex;const isS=sel===si;const isW=showC&&isS&&opt.oi!==phase.correctIndex;
            let border="2px solid var(--border)";let bg="var(--bg-card)";let opacity=1;let scale="scale(1)";
            if(showC){if(isR){border="2px solid var(--green)";bg="var(--green-bg)";scale="scale(1.02)"}else if(isW){border="2px solid var(--red)";bg="var(--red-bg)";opacity=0.6}else{opacity=0.4}}
            else if(isS){border="2px solid var(--text)";bg="var(--bg-hover)"}

            return(<button key={si} onClick={()=>pick(si)} disabled={sel!==null||phase.phase!=="answering"||isHost}
              style={{padding:"20px 18px",borderRadius:14,border,background:bg,color:"var(--text)",fontSize:15,fontWeight:600,cursor:isHost||sel!==null?"default":"pointer",display:"flex",alignItems:"center",gap:14,transition:"all 0.2s",position:"relative",textAlign:"left",minHeight:64,opacity,transform:scale,animation:`fadeIn 0.3s ease ${si*0.05}s both`}}>
              <span style={{width:32,height:32,borderRadius:8,background:"var(--bg-subtle)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0,color:"var(--text-secondary)",border:"1px solid var(--border)"}}>{String.fromCharCode(65+si)}</span>
              <span style={{flex:1,lineHeight:1.4}}>{opt.text}</span>
              {showC&&isR&&<span style={{color:"var(--green)"}}><I.Check/></span>}
              {showC&&isW&&<span style={{color:"var(--red)"}}><I.X/></span>}
            </button>);
          })}
        </div>

        {isHost&&showC&&players.length>0&&(
          <div style={{marginTop:24,background:"var(--bg-card)",borderRadius:12,padding:16,maxWidth:360,width:"100%",border:"1px solid var(--border)"}}>
            <p style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:1}}>Live Scores</p>
            {[...players].sort((a,b)=>b.score-a.score).slice(0,5).map((p,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:14,color:"var(--text-secondary)",animation:`slideIn 0.2s ease ${i*0.05}s both`}}>
                <span><span style={{color:"var(--text-muted)",marginRight:6}}>{i+1}.</span>{p.name}</span>
                <span style={{fontWeight:700,fontFamily:"var(--mono)"}}>{p.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════
function Landing({ onStart, onLogin, onJoin }) {
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px"}}>
    <div style={{position:"absolute",top:20,right:20}}><ThemeToggle/></div>
    <div style={{textAlign:"center",maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:48}}><I.Logo/><span style={{fontSize:20,fontWeight:700,letterSpacing:"-0.5px"}}>QuizArena</span></div>
      <h1 style={{fontSize:"clamp(40px,6vw,64px)",fontWeight:700,lineHeight:1.1,letterSpacing:"-1.5px",marginBottom:20}}>Live Quiz Platform<br/><span style={{color:"var(--text-secondary)"}}>for Communities</span></h1>
      <p style={{fontSize:17,lineHeight:1.7,color:"var(--text-secondary)",maxWidth:480,margin:"0 auto 40px"}}>Create interactive quizzes, host live sessions with up to 500 players, and rank participants in real-time.</p>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={onStart} style={S.btnAccent}>Create a Quiz <I.Arrow/></button>
        <button onClick={onJoin} style={S.btnOutline}>Join a Quiz</button>
      </div>
      <button onClick={onLogin} style={{...S.link,marginTop:32}}>Have an account? <span style={{fontWeight:600,color:"var(--text)"}}>Sign in</span></button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:1,marginTop:80,maxWidth:640,width:"100%",background:"var(--border)",borderRadius:12,overflow:"hidden"}}>
      {[{n:"22s",d:"Per question"},{n:"500",d:"Max players"},{n:"50",d:"Questions/quiz"},{n:"Real-time",d:"Synced timer"}].map((f,i)=>(
        <div key={i} style={{background:"var(--bg-card)",padding:"24px 16px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{f.n}</div><div style={{fontSize:13,color:"var(--text-muted)"}}>{f.d}</div></div>
      ))}
    </div>
  </div>);
}

function Auth({ mode, setMode, onAuth, onBack }) {
  const [em,setEm]=useState("");const [pw,setPw]=useState("");const [nm,setNm]=useState("");
  const go=()=>{if(em&&pw&&(mode==="login"||nm))onAuth(em,pw,nm)};const kd=e=>{if(e.key==="Enter")go()};
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
    <div style={{position:"absolute",top:20,right:20}}><ThemeToggle/></div>
    <div style={{width:"100%",maxWidth:400}}>
      <button onClick={onBack} style={S.back}><I.Back/> Back</button>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:"40px 32px"}}>
        <div style={{textAlign:"center",marginBottom:32}}><I.Logo/><h2 style={{fontSize:22,fontWeight:700,marginTop:16}}>{mode==="login"?"Sign in":"Create account"}</h2><p style={{fontSize:14,color:"var(--text-secondary)",marginTop:6}}>{mode==="login"?"Enter your credentials":"Get started free"}</p></div>
        {mode==="register"&&<div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Your name" value={nm} onChange={e=>setNm(e.target.value)} onKeyDown={kd}/></div>}
        <div style={S.field}><label style={S.label}>Email</label><input style={S.input} type="email" placeholder="you@example.com" value={em} onChange={e=>setEm(e.target.value)} onKeyDown={kd}/></div>
        <div style={S.field}><label style={S.label}>Password</label><input style={S.input} type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={kd}/></div>
        <button onClick={go} style={{...S.btnAccent,width:"100%",justifyContent:"center",marginTop:8}}>{mode==="login"?"Sign in":"Create account"}</button>
        <p style={{textAlign:"center",marginTop:20,fontSize:14,color:"var(--text-muted)"}}>{mode==="login"?"No account?":"Have an account?"} <button onClick={()=>setMode(mode==="login"?"register":"login")} style={{...S.link,fontWeight:600,color:"var(--text)"}}>{mode==="login"?"Sign up":"Sign in"}</button></p>
      </div>
    </div>
  </div>);
}

function Dash({ user, quizzes, onCreate, onEdit, onDelete, onHost, onLogout }) {
  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 28px",borderBottom:"1px solid var(--border)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><I.Logo/><span style={{fontSize:17,fontWeight:700}}>QuizArena</span></div>
      <div style={{display:"flex",alignItems:"center",gap:12}}><ThemeToggle/><span style={{fontSize:14,color:"var(--text-secondary)"}}>{user?.name}</span><button onClick={onLogout} style={{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:6,color:"var(--text-secondary)",display:"flex"}}><I.Logout/></button></div>
    </div>
    <div style={{padding:"32px 28px",maxWidth:960,width:"100%",margin:"0 auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
        <div><h1 style={{fontSize:24,fontWeight:700}}>My Quizzes</h1><p style={{fontSize:14,color:"var(--text-muted)",marginTop:4}}>{quizzes.length} quiz{quizzes.length!==1?"zes":""}</p></div>
        <button onClick={onCreate} style={{...S.btnAccent,gap:8}}><I.Plus/> New Quiz</button>
      </div>
      {!quizzes.length?<div style={{textAlign:"center",padding:"64px 20px",border:"2px dashed var(--border)",borderRadius:16}}><p style={{fontSize:40,marginBottom:12}}>📝</p><h3 style={{fontSize:18,fontWeight:600,marginBottom:6}}>No quizzes yet</h3><p style={{fontSize:14,color:"var(--text-muted)",marginBottom:20}}>Create your first quiz</p><button onClick={onCreate} style={S.btnAccent}>Create Quiz</button></div>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>{quizzes.map(q=><div key={q.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",background:"var(--bg-subtle)",padding:"3px 10px",borderRadius:100}}>{q.questions?.length||0} Qs</span><button onClick={()=>onDelete(q.id)} style={{background:"none",border:"none",color:"var(--text-muted)",display:"flex"}}><I.Trash/></button></div>
        <h3 style={{fontSize:16,fontWeight:600,marginBottom:4}}>{q.title}</h3><p style={{fontSize:13,color:"var(--text-muted)",marginBottom:16}}>{q.description||""}</p>
        <div style={{display:"flex",gap:8}}><button onClick={()=>onEdit(q)} style={S.btnSm}>Edit</button><button onClick={()=>onHost(q)} style={{...S.btnSmAccent,display:"flex",alignItems:"center",gap:5}}><I.Play/> Host</button></div>
      </div>)}</div>}
    </div>
  </div>);
}

function CreateQuiz({ quiz, userId, onSave, onBack, notify }) {
  const [t,setT]=useState(quiz?.title||"");const [d,setD]=useState(quiz?.description||"");
  const [qs,setQs]=useState(quiz?.questions||[{id:genId(),text:"",options:["","","",""],correctIndex:0}]);const fr=useRef(null);
  const addQ=()=>{if(qs.length<50)setQs([...qs,{id:genId(),text:"",options:["","","",""],correctIndex:0}])};
  const rmQ=i=>{if(qs.length>1)setQs(qs.filter((_,x)=>x!==i))};
  const uQ=(i,f,v)=>{const u=[...qs];u[i]={...u[i],[f]:v};setQs(u)};
  const uO=(qi,oi,v)=>{const u=[...qs];u[qi]={...u[qi],options:[...u[qi].options]};u[qi].options[oi]=v;setQs(u)};
  const hf=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const p=parseTxtQuiz(ev.target.result);if(!p.length)return notify("No questions found","error");setQs(p);const fl=ev.target.result.split("\n").find(l=>l.trim());if(fl&&!fl.match(/^Q?\d/i))setT(fl.trim());notify(p.length+" Qs imported!")};r.readAsText(f);e.target.value=""};
  const sv=()=>{if(!t.trim())return notify("Enter a title","error");const v=qs.filter(q=>q.text.trim()&&q.options.filter(o=>o.trim()).length>=2);if(!v.length)return notify("Need 1+ questions","error");onSave({id:quiz?.id||genId(),userId,title:t.trim(),description:d.trim(),questions:v,createdAt:quiz?.createdAt||Date.now(),updatedAt:Date.now()})};

  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 28px",borderBottom:"1px solid var(--border)"}}>
      <button onClick={onBack} style={S.back}><I.Back/> Back</button>
      <div style={{display:"flex",gap:10}}><input type="file" accept=".txt" ref={fr} onChange={hf} style={{display:"none"}}/><button onClick={()=>fr.current?.click()} style={{...S.btnSm,display:"flex",alignItems:"center",gap:6}}><I.Upload/> Upload .txt</button><button onClick={sv} style={S.btnSmAccent}>Save</button></div>
    </div>
    <div style={{padding:28,maxWidth:720,width:"100%",margin:"0 auto",flex:1}}>
      <input style={{width:"100%",padding:"12px 0",background:"transparent",border:"none",borderBottom:"2px solid var(--border)",color:"var(--text)",fontSize:28,fontWeight:700,outline:"none",boxSizing:"border-box"}} placeholder="Quiz title" value={t} onChange={e=>setT(e.target.value)}/>
      <input style={{width:"100%",padding:"10px 0",background:"transparent",border:"none",color:"var(--text-secondary)",fontSize:15,outline:"none",marginTop:4,boxSizing:"border-box"}} placeholder="Description (optional)" value={d} onChange={e=>setD(e.target.value)}/>
      <div style={{marginTop:28}}>{qs.map((q,qi)=><div key={q.id} style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1}}>Q{qi+1}</span>{qs.length>1&&<button onClick={()=>rmQ(qi)} style={{background:"none",border:"none",color:"var(--text-muted)",display:"flex"}}><I.Trash/></button>}</div>
        <input style={{...S.input,fontSize:15,marginBottom:14}} placeholder="Question..." value={q.text} onChange={e=>uQ(qi,"text",e.target.value)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{q.options.map((o,oi)=><div key={oi} style={{display:"flex",alignItems:"center",gap:8,borderRadius:10,border:"1px solid var(--border)",padding:"4px 4px 4px 12px",background:q.correctIndex===oi?"var(--green-bg)":"transparent"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--text-muted)",flexShrink:0}}>{String.fromCharCode(65+oi)}</span>
          <input style={{flex:1,padding:"8px 6px",background:"transparent",border:"none",color:"var(--text)",fontSize:14,outline:"none"}} placeholder={"Option "+String.fromCharCode(65+oi)} value={o} onChange={e=>uO(qi,oi,e.target.value)}/>
          <button onClick={()=>uQ(qi,"correctIndex",oi)} style={{width:30,height:30,borderRadius:6,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:q.correctIndex===oi?"var(--green)":"transparent",color:q.correctIndex===oi?"#fff":"var(--text-muted)",border:q.correctIndex===oi?"none":"1px solid var(--border)"}}>{q.correctIndex===oi&&<I.Check/>}</button>
        </div>)}</div>
      </div>)}
      {qs.length<50&&<button onClick={addQ} style={{width:"100%",padding:14,border:"2px dashed var(--border)",borderRadius:12,background:"transparent",color:"var(--text-secondary)",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><I.Plus/> Add ({qs.length}/50)</button>}
      </div>
    </div>
  </div>);
}

function Lobby({ code, participants, onStart, onBack }) {
  const [cp,setCp]=useState(false);const url=getDomain()+"/join/"+code;
  const copy=()=>{navigator.clipboard?.writeText(url);setCp(true);setTimeout(()=>setCp(false),2000)};
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,position:"relative"}}>
    <button onClick={onBack} style={{...S.back,position:"absolute",top:24,left:24}}><I.Back/> End</button>
    <div style={{position:"absolute",top:20,right:20}}><ThemeToggle/></div>
    <div style={{textAlign:"center",maxWidth:600,width:"100%"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:3,marginBottom:12}}>Game Pin</p>
      <div style={{fontSize:"clamp(48px,10vw,72px)",fontWeight:700,letterSpacing:8,fontFamily:"var(--mono)"}}>{code}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:16}}>
        <span style={{fontSize:13,color:"var(--text-muted)",background:"var(--bg-subtle)",padding:"8px 14px",borderRadius:8,wordBreak:"break-all",border:"1px solid var(--border)"}}>{url}</span>
        <button onClick={copy} style={{...S.btnSm,display:"flex",alignItems:"center",gap:5}}><I.Copy/>{cp?"Copied":"Copy"}</button>
      </div>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:24,marginTop:32}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:14,fontWeight:600,color:"var(--text-secondary)",display:"flex",alignItems:"center",gap:6}}><I.Users/> {participants.length}/500</span>
          <span style={{fontSize:12,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",display:"inline-block"}}></span>Live</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,minHeight:60}}>
          {participants.map((p,i)=><span key={p.id||i} style={{fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:8,background:"var(--bg-subtle)",border:"1px solid var(--border)",animation:"fadeIn 0.2s ease both"}}>{p.name}</span>)}
          {!participants.length&&<p style={{color:"var(--text-muted)",textAlign:"center",width:"100%",padding:"20px 0",fontSize:14}}>Waiting for players...</p>}
        </div>
      </div>
      <button onClick={onStart} style={{...S.btnAccent,padding:"16px 48px",fontSize:16,marginTop:24}}><I.Play/> Start Quiz</button>
    </div>
  </div>);
}

function Waiting({ participants, playerName, onBack }) {
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{textAlign:"center",maxWidth:420}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:"var(--bg-subtle)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",border:"1px solid var(--border)"}}><span style={{fontSize:36}}>⏳</span></div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:6}}>You're in!</h2>
      <p style={{fontSize:15,color:"var(--text-secondary)"}}>Playing as <span style={{fontWeight:700,color:"var(--text)"}}>{playerName}</span></p>
      <p style={{fontSize:14,color:"var(--text-muted)",marginTop:4,marginBottom:28}}>Waiting for the host...</p>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:12,padding:20}}>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:10}}>{participants.length} player{participants.length!==1?"s":""}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>{participants.map((p,i)=><span key={i} style={{fontSize:13,padding:"5px 12px",borderRadius:6,background:p.name===playerName?"var(--accent-bg)":"var(--bg-subtle)",color:p.name===playerName?"var(--accent-text)":"var(--text-secondary)",fontWeight:p.name===playerName?600:400}}>{p.name}</span>)}</div>
      </div>
      <button onClick={onBack} style={{...S.link,marginTop:20,color:"var(--text-muted)"}}>Leave</button>
    </div>
  </div>);
}

function Join({ code, setCode, name, setName, onJoin, onBack }) {
  const kd=e=>{if(e.key==="Enter")onJoin()};
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{position:"absolute",top:20,right:20}}><ThemeToggle/></div>
    <div style={{width:"100%",maxWidth:400}}>
      <button onClick={onBack} style={S.back}><I.Back/> Back</button>
      <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:16,padding:"40px 32px"}}>
        <div style={{textAlign:"center",marginBottom:28}}><I.Logo/><h2 style={{fontSize:22,fontWeight:700,marginTop:16}}>Join a Quiz</h2><p style={{fontSize:14,color:"var(--text-secondary)",marginTop:6}}>Enter the game PIN</p></div>
        <div style={S.field}><label style={S.label}>Game PIN</label><input style={{...S.input,textAlign:"center",fontSize:22,letterSpacing:6,fontWeight:700,fontFamily:"var(--mono)"}} placeholder="ABC123" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} onKeyDown={kd}/></div>
        <div style={S.field}><label style={S.label}>Username</label><input style={S.input} placeholder="Your display name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={kd}/></div>
        <button onClick={onJoin} style={{...S.btnAccent,width:"100%",justifyContent:"center",marginTop:8}}>Join Game</button>
      </div>
    </div>
  </div>);
}

function LB({ players, onBack, isHost }) {
  const sorted=[...players].sort((a,b)=>b.score-a.score);const top3=sorted.slice(0,3);const rest=sorted.slice(3);
  const medals=["🥇","🥈","🥉"];const hts=[120,160,100];const ord=[1,0,2];
  return (<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 20px"}}>
    <div style={{textAlign:"center",marginBottom:40,animation:"fadeUp 0.4s ease"}}><h1 style={{fontSize:32,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><I.Trophy/> Final Results</h1></div>
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:10,marginBottom:40,maxWidth:440,width:"100%"}}>
      {ord.map(idx=>{const p=top3[idx];if(!p)return<div key={idx} style={{flex:1}}/>;return(
        <div key={idx} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",animation:`fadeUp 0.4s ease ${idx*0.1}s both`}}>
          <span style={{fontSize:28,marginBottom:6}}>{medals[idx]}</span>
          <p style={{fontSize:14,fontWeight:600,marginBottom:2,textAlign:"center",wordBreak:"break-word"}}>{p.name}</p>
          <p style={{fontSize:13,color:"var(--text-muted)",fontFamily:"var(--mono)",fontWeight:700,marginBottom:8}}>{p.score}</p>
          <div style={{width:"100%",borderRadius:"10px 10px 0 0",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:14,height:hts[idx],background:"var(--bg-subtle)",border:"1px solid var(--border)",borderBottom:"none"}}>
            <span style={{fontSize:22,fontWeight:800,color:"var(--text-muted)",opacity:0.4}}>#{idx+1}</span>
          </div>
        </div>
      )})}
    </div>
    {rest.length>0&&<div style={{maxWidth:440,width:"100%",borderRadius:12,overflow:"hidden",border:"1px solid var(--border)"}}>
      {rest.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 18px",borderBottom:"1px solid var(--border)",background:"var(--bg-card)",animation:`slideIn 0.2s ease ${i*0.03}s both`}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--text-muted)",width:28}}>{i+4}</span>
        <span style={{flex:1,fontSize:14,fontWeight:500}}>{p.name}</span>
        <span style={{fontSize:14,fontWeight:700,fontFamily:"var(--mono)",color:"var(--text-secondary)"}}>{p.score}</span>
      </div>)}
    </div>}
    <button onClick={onBack} style={{...S.btnAccent,padding:"14px 40px",marginTop:32}}>{isHost?"Dashboard":"Leave"}</button>
  </div>);
}

function Foot() {
  return (<footer style={{borderTop:"1px solid var(--border)",padding:"32px 28px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",maxWidth:960,margin:"0 auto",flexWrap:"wrap",gap:24,paddingBottom:24}}>
      <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><I.Logo/><span style={{fontSize:16,fontWeight:700}}>QuizArena</span></div><p style={{fontSize:13,color:"var(--text-muted)",maxWidth:260}}>Live quiz platform for communities.</p></div>
      <div style={{display:"flex",gap:40}}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Platform</span><span style={{fontSize:14,color:"var(--text-secondary)"}}>Create Quiz</span><span style={{fontSize:14,color:"var(--text-secondary)"}}>Join Game</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Community</span><span style={{fontSize:14,color:"var(--text-secondary)"}}>Discord</span><span style={{fontSize:14,color:"var(--text-secondary)"}}>Twitter</span></div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0",borderTop:"1px solid var(--border)",maxWidth:960,margin:"0 auto",flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:13,color:"var(--text-muted)"}}>Inspired by <span style={{fontWeight:600,color:"var(--text-secondary)"}}>GenLayer Community</span> · Built by <span style={{fontWeight:600,color:"var(--text-secondary)"}}>Amie</span></span>
      <span style={{fontSize:13,color:"var(--text-muted)"}}>© 2026</span>
    </div>
  </footer>);
}

// ═══════════════════════════════════════════════════════════════════
const S = {
  btnAccent: { background:"var(--accent-bg)",color:"var(--accent-text)",border:"none",borderRadius:10,padding:"12px 24px",fontSize:15,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8 },
  btnOutline: { background:"transparent",color:"var(--text)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 24px",fontSize:15,fontWeight:600,cursor:"pointer" },
  btnSm: { background:"transparent",color:"var(--text-secondary)",border:"1px solid var(--border)",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer" },
  btnSmAccent: { background:"var(--accent-bg)",color:"var(--accent-text)",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer" },
  link: { background:"none",border:"none",color:"var(--text-muted)",fontSize:14,cursor:"pointer",fontFamily:"inherit" },
  back: { background:"none",border:"none",color:"var(--text-secondary)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontWeight:500,padding:"8px 0",marginBottom:16 },
  field: { marginBottom:18 },
  label: { display:"block",fontSize:13,fontWeight:600,color:"var(--text-secondary)",marginBottom:6 },
  input: { width:"100%",padding:"12px 14px",background:"var(--bg-subtle)",border:"1px solid var(--border)",borderRadius:10,color:"var(--text)",fontSize:15,outline:"none",boxSizing:"border-box",transition:"border 0.2s" },
};

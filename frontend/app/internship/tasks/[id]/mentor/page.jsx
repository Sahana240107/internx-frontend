// frontend/app/internship/tasks/[id]/mentor/page.jsx
"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function TaskMentorPage() {
  const { id: taskId } = useParams();
  // reuse same UI, just pass taskId from URL
  const [messages, setMessages] = useState([
    { role: "assistant", content: `👋 Hi! I'm your AI Mentor for task ${taskId}. What do you need help with?` }
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  const userId = typeof window !== "undefined"
    ? localStorage.getItem("user_id") || "demo-user"
    : "demo-user";

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const wsUrl = backendUrl.replace("http", "ws") + `/api/mentor/chat/${taskId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const token = event.data;
      if (token === "[DONE]") { setIsTyping(false); return; }
      if (token.startsWith("[ERROR]")) {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: "error", content: token }]);
        return;
      }
      setIsTyping(true);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last?.streaming)
          return [...prev.slice(0, -1), { ...last, content: last.content + token }];
        return [...prev, { role: "assistant", content: token, streaming: true }];
      });
    };
    return () => ws.close();
  }, [taskId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setMessages(prev => [...prev, { role: "user", content: input }]);
    wsRef.current.send(JSON.stringify({ message: input, user_id: userId }));
    setInput("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh",
      background:"#0f172a", color:"#e2e8f0", fontFamily:"sans-serif" }}>
      <div style={{ padding:"16px 24px", borderBottom:"1px solid #1e293b",
        display:"flex", alignItems:"center", gap:"12px" }}>
        <div style={{ width:10, height:10, borderRadius:"50%",
          background: isConnected ? "#22c55e" : "#ef4444" }} />
        <span style={{ fontWeight:600, fontSize:18 }}>🤖 AI Mentor</span>
        <span style={{ marginLeft:"auto", fontSize:13, color:"#64748b" }}>Task: {taskId}</span>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"24px",
        display:"flex", flexDirection:"column", gap:"16px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:"flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth:"70%", padding:"12px 16px", borderRadius:12,
              background: msg.role==="user" ? "#3b82f6" : msg.role==="error" ? "#7f1d1d" : "#1e293b",
              color:"#f1f5f9", fontSize:15, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding:"16px 24px", borderTop:"1px solid #1e293b",
        display:"flex", gap:"12px" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
          placeholder={isConnected ? "Ask your mentor..." : "Connecting..."}
          disabled={!isConnected} rows={2}
          style={{ flex:1, background:"#1e293b", border:"1px solid #334155",
            borderRadius:8, color:"#f1f5f9", padding:"10px 14px", fontSize:15,
            resize:"none", outline:"none" }} />
        <button onClick={sendMessage} disabled={!isConnected||!input.trim()}
          style={{ padding:"0 24px", background:"#3b82f6", color:"white",
            border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
          Send
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import "./Chatbot.css";
import botAvatar from "../assets/chatbotavatar.jpeg";
import userAvatar from "../assets/useravatar.png";

// KaTeX for rendering LaTeX on the client
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

export default function ChatBot() {
  const [sessions, setSessions] = useState([{ id: 1, messages: [] }]);
  const [activeSession, setActiveSession] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const [imageMode, setImageMode] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ Replace with your deployed backend URL
  const BACKEND_URL = "https://chatbot-1-zkc1.onrender.com";

  useEffect(() => {
    const timeout = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    inputRef.current?.focus();
    return () => clearTimeout(timeout);
  }, [sessions, activeSession, isTyping]);

  const getCurrentMessages = () => sessions[activeSession].messages;

  const TypingIndicator = () => (
    <div className="typing-indicator">
      <span></span><span></span><span></span>
    </div>
  );

  // Helper: render content and LaTeX blocks safely using react-katex
  const renderMessageContent = (text) => {
    if (!text && text !== "") return null;

    // If the content is not a string just render it directly
    if (typeof text !== "string") return <span>{String(text)}</span>;

    // Regex to find $$...$$ (display) and \( ... \) (inline). Also supports $...$ inline.
    // Note: we prioritize $$ (display) and \( \) (inline) as recommended.
    const regex = /(\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\$(?!\s)(?:\\.|[^\$\\])+\$)/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      if (idx > lastIndex) {
        parts.push({ type: "text", content: text.slice(lastIndex, idx) });
      }
      const token = match[0];
      if (token.startsWith("$$") && token.endsWith("$$")) {
        parts.push({ type: "display", content: token.slice(2, -2).trim() });
      } else if (token.startsWith("\\(") && token.endsWith("\\)")) {
        parts.push({ type: "inline", content: token.slice(2, -2).trim() });
      } else if (token.startsWith("$") && token.endsWith("$")) {
        parts.push({ type: "inline", content: token.slice(1, -1).trim() });
      } else {
        parts.push({ type: "text", content: token });
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts.map((p, i) => {
      if (p.type === "text") return <span key={i}>{p.content}</span>;
      if (p.type === "inline")
        return <InlineMath key={i} math={p.content} />;
      if (p.type === "display")
        return <div key={i} style={{ margin: "8px 0" }}><BlockMath math={p.content} /></div>;
      return null;
    });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);
    setIsTyping(true);

    // Add user message + assistant typing placeholder
    setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
      ...session,
      messages: [...session.messages, { role: "user", content: userMessage }, { role: "assistant", typing: true }]
    } : session));

    try {
      let endpoint = "/chat";
      let payload = { message: userMessage };

      if (pdfMode) {
        endpoint = "/ask-pdf";
        payload = { question: userMessage };
      } else if (imageMode) {
        endpoint = "/ask-image";
        payload = { question: userMessage };
      }

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Server error");
      const data = await response.json();

      // data.reply should be a plain string with LaTeX using single backslashes, e.g. \frac{1}{2}
      const replyText = data.reply ?? "No reply";

      setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
        ...session,
        messages: session.messages.map(msg => msg.typing ? { role: "assistant", content: replyText } : msg)
      } : session));
    } catch (err) {
      console.error(err);
      setError("⚠️ No response from AI. Please try again.");
      setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
        ...session,
        messages: session.messages.filter(m => !m.typing)
      } : session));
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type.includes("pdf");

    setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
      ...session,
      messages: [
        ...session.messages,
        { role: "user", fileName: file.name, fileType: file.type, preview },
        { role: "assistant", content: isPdf ? "PDF uploaded. You can now ask questions about it." : "Image uploaded. You can now ask questions about it." }
      ]
    } : session));

    if (isPdf) {
      setPdfMode(true);
      setImageMode(false);
    }
    if (isImage) {
      setImageMode(true);
      setPdfMode(false);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = isPdf ? "/upload" : "/upload-image";
      const response = await fetch(`${BACKEND_URL}${endpoint}`, { method: "POST", body: formData });

      if (!response.ok) {
        setError("⚠️ File upload failed.");
      } else {
        // Optional: read backend reply and append as assistant message (backend already responds)
        const data = await response.json();
        if (data?.reply) {
          setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
            ...session,
            messages: [...session.messages, { role: "assistant", content: data.reply }]
          } : session));
        }
      }
    } catch (err) {
      console.error(err);
      setError("⚠️ File upload failed.");
    }
  };

  const newChat = () => {
    const newSession = { id: sessions.length + 1, messages: [] };
    setSessions(prev => [...prev, newSession]);
    setActiveSession(sessions.length);
    setInput("");
    setError(null);
    setPdfMode(false);
    setImageMode(false);
  };

  const clearAllSessions = () => {
    setSessions([{ id: 1, messages: [] }]);
    setActiveSession(0);
    setInput("");
    setError(null);
    setPdfMode(false);
    setImageMode(false);
  };

  const exportChat = () => {
    const text = getCurrentMessages()
      .map(m => m.fileName
        ? `You uploaded: ${m.fileName}`
        : `${m.role === "user" ? "You" : "Bot"}: ${m.content}`)
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chat_session_${activeSession + 1}.txt`;
    link.click();
  };

  return (
    <div className={`chatbot-app ${darkMode ? "dark" : "light"}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="bot-title"><img src={botAvatar} className="heading-avatar" alt="bot" /> ChatBot</h2>
        <div className="session-list">
          {sessions.map((s, idx) => (
            <button
              key={s.id}
              className={idx === activeSession ? "active-session" : ""}
              onClick={() => setActiveSession(idx)}
            >
              {s.messages.length > 0
                ? (s.messages[0].content || s.messages[0].fileName || "File").slice(0, 15) + "..."
                : `Session ${s.id}`}
            </button>
          ))}
        </div>
        <div className="sidebar-buttons">
          <button onClick={newChat}>➕ New Chat</button>
          <button onClick={clearAllSessions}>❌ Clear All</button>
          <button onClick={exportChat}>💾 Export Chat</button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-area">
        <div className="mode-toggle">
          <button onClick={() => setDarkMode(p => !p)}>
            {darkMode ? "🌞 Light Mode" : "🌚 Dark Mode"}
          </button>
        </div>

        <div className="messages">
          {getCurrentMessages().map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <img
                src={m.role === "user" ? userAvatar : botAvatar}
                alt="avatar"
                className="avatar"
              />
              <div className="message-content">
                <b>{m.role === "user" ? "You" : "Bot"}:</b>{" "}
                {m.typing ? (
                  <TypingIndicator />
                ) : m.fileName ? (
                  <div className="file-message">
                    {m.preview ? (
                      <img src={m.preview} alt="uploaded preview" className="file-preview" />
                    ) : (
                      <div className="file-icon">📎</div>
                    )}
                    <span className="file-name">{m.fileName}</span>
                  </div>
                ) : (
                  renderMessageContent(m.content)
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message..."
          />

          <input
            type="file"
            id="file-upload"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          <button onClick={() => document.getElementById("file-upload").click()}>
            📎 Attach
          </button>
          <button onClick={sendMessage}>Send</button>
        </div>
      </main>
    </div>
  );
}

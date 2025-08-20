import React, { useState, useEffect, useRef } from "react";
import "./ChatBot.css";
import botAvatar from "../assets/chatbotavatar.jpeg";
import userAvatar from "../assets/useravatar.png";

export default function ChatBot() {
  const [sessions, setSessions] = useState([{ id: 1, messages: [] }]);
  const [activeSession, setActiveSession] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);        // PDF uploaded flag
  const [imageMode, setImageMode] = useState(false);    // Image uploaded flag

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  // Updated sendMessage : pdf & image logic
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);
    setIsTyping(true);

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

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();

      setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
        ...session,
        messages: session.messages.map(msg => msg.typing ? { role: "assistant", content: data.reply } : msg)
      } : session));
    } catch {
      setError("⚠️ No response from AI. Please try again.");
      setSessions(prev => prev.map((session, idx) => idx === activeSession ? {
        ...session,
        messages: session.messages.filter(m => !m.typing)
      } : session));
    } finally {
      setIsTyping(false);
    }
  };

  // Updated File Upload: detects image vs pdf
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type.includes("pdf");

    // Add a message that PDF or Image was uploaded
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
      await fetch(`http://localhost:5000${endpoint}`, { method: "POST", body: formData });
    } catch {
      setError("⚠️ File upload failed.");
    }
  };

  const newChat = () => {
    const newSession = { id: sessions.length + 1, messages: [] };
    setSessions(prev => [...prev, newSession]);
    setActiveSession(sessions.length);
    setInput("");
    setError(null);
    setPdfMode(false);   // reset both modes
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
        <h2 className="bot-title"><img src={botAvatar} className="heading-avatar"></img> ChatBot</h2>
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
                  m.content
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

          {/* Hidden file input */}
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

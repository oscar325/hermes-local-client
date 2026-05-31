import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Send, Settings, User, Bot, Paperclip, Mic, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import "./App.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("http://localhost:8642");
  const [apiKey, setApiKey] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // 加载配置
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<any>("get_gateway_config");
      if (config) {
        setGatewayUrl(config.base_url);
        setApiKey(config.api_key);
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function saveConfig() {
    try {
      await invoke("set_gateway_config", {
        baseUrl: gatewayUrl,
        apiKey: apiKey,
      });
      setShowSettings(false);
    } catch (e) {
      alert("Failed to save config: " + e);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await invoke<any>("send_message", {
        message: inputMessage,
        sessionId: sessionId || undefined,
        attachments: [],
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSessionId(response.session_id);
    } catch (e) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${e}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleNewChat() {
    setSessionId(null);
    setMessages([]);
  }

  return (
    <div className="app-container">
      {/* 头部 */}
      <header className="app-header">
        <div className="header-left">
          <h1>Hermes Local</h1>
          <button onClick={handleNewChat} className="btn-new-chat">
            + New Chat
          </button>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn-settings"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* 设置面板 */}
      {showSettings && (
        <div className="settings-panel">
          <h3>Gateway Configuration</h3>
          <div className="form-group">
            <label>Gateway URL</label>
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="http://localhost:8642"
            />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
            />
          </div>
          <button onClick={saveConfig} className="btn-primary">
            Save Configuration
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <main className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <Bot size={64} className="empty-icon" />
            <h2>Welcome to Hermes Local</h2>
            <p>Start a conversation by typing a message below</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.role === "user" ? "message-user" : "message-assistant"}`}
              >
                <div className="message-avatar">
                  {msg.role === "user" ? (
                    <User size={24} />
                  ) : (
                    <Bot size={24} />
                  )}
                </div>
                <div className="message-content">
                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-assistant">
                <div className="message-avatar">
                  <Bot size={24} />
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* 输入区域 */}
      <footer className="input-area">
        <div className="input-container">
          <button className="btn-icon" title="Attach file">
            <Paperclip size={20} />
          </button>
          <button
            className={`btn-icon ${isRecording ? "recording" : ""}`}
            title="Voice message"
            onClick={() => setIsRecording(!isRecording)}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
          />
          <button
            className="btn-send"
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
          >
            <Send size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;

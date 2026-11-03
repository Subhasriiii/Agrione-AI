import React, { useState, useRef, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import { advisoryApi } from '../api/advisoryApi';
import {
  BotMessageSquare,
  Send,
  Sparkles,
  Sprout,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Layers,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Which crop is most profitable for my soil and location?',
  'How to cure yellowing leaves and brown spots on cotton?',
  'What is the optimal drip irrigation schedule during flowering?',
  'How do I apply for the PM-KISAN subsidy and KCC loan?',
  'Recommend organic alternatives to synthetic Urea and DAP.',
];

const AIAssistant = () => {
  const { activeFarm } = useFarm();
  const [messages, setMessages] = useState([
    {
      id: 'msg-0',
      sender: 'bot',
      text: `Namaste! I am your **AgriOne AI Agricultural Advisor**. I have loaded the context for **${activeFarm?.name || 'your farm'}** (${activeFarm?.totalArea || 5.5} Acres, ${activeFarm?.primaryCrop || 'Cotton'} in ${activeFarm?.location?.district || 'Guntur'}, ${activeFarm?.location?.state || 'AP'}).\n\nHow can I assist your farming decisions today? You can ask about crop selection, pest control, soil nutrient dosing, irrigation timing, or government subsidies.`,
      isAI: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await advisoryApi.chatAssistant(query, {
        farmName: activeFarm?.name,
        location: activeFarm?.location,
        crop: activeFarm?.primaryCrop,
        soil: activeFarm?.soilData,
      });

      const botMsg = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'bot',
        text: res?.response || 'I am analyzing your field question. Please check back shortly.',
        isAI: res?.isAI || false,
        source: res?.source || 'Agricultural Knowledge Engine',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      // Offline fallback answer
      const botMsg = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'bot',
        text: `Regarding "${query}":\n\n1. Maintain balanced fertilization based on your soil test (N: ${activeFarm?.soilData?.nitrogen || 135} kg/ha, P: ${activeFarm?.soilData?.phosphorus || 42}, K: ${activeFarm?.soilData?.potassium || 195}).\n2. For pest and disease issues, deploy sticky traps and spray 5% Neem Seed Kernel Extract (NSKE) as early preventive bio-control.\n3. Always consult your district Krishi Vigyan Kendra (KVK) officer for field-specific confirmation.`,
        isAI: false,
        source: 'Built-in Agricultural Rulebase',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            AgriOne AI <span className="gradient-text">Agronomist Advisor</span>
          </h1>
          <p className="page-subtitle">
            Context-aware AI agricultural expert calibrated for Indian agronomy, soils, and climate zones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() =>
              setMessages([
                {
                  id: 'msg-0',
                  sender: 'bot',
                  text: 'Chat history cleared. How can I help you with your crops today?',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ])
            }
            className="btn btn-secondary btn-sm"
          >
            <Trash2 size={14} /> Clear History
          </button>
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          FREQUENT FARMER QUESTIONS
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="glass-panel chat-window">
        {/* Messages Body */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${
                msg.sender === 'user' ? 'message-user' : 'message-bot'
              }`}
            >
              {msg.sender === 'bot' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.4rem',
                    fontSize: '0.75rem',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                >
                  <Sparkles size={14} />
                  AgriOne AI
                  {msg.source && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      ({msg.source})
                    </span>
                  )}
                </div>
              )}

              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                {msg.text}
              </div>

              <div
                style={{
                  fontSize: '0.65rem',
                  color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                  textAlign: 'right',
                  marginTop: '0.4rem',
                }}
              >
                {msg.time}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-bubble message-bot" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sparkles size={16} className="animate-spin" style={{ color: '#34d399' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Consulting agronomic database and weather context...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(9, 16, 20, 0.95)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Type your question about crops, fertilizers, irrigation, diseases..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.25rem' }}
          >
            <Send size={16} />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;

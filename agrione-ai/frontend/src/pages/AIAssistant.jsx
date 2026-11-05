import { useState, useRef, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import { advisoryApi } from '../api/advisoryApi';
import {
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Which crop is most profitable for my soil and location?',
  'How to cure yellowing leaves and brown spots on cotton?',
  'What is the optimal drip irrigation schedule during flowering?',
  'How do I apply for the PM-KISAN subsidy and KCC loan?',
  'Recommend organic alternatives to synthetic Urea and DAP.',
];

const SOIL_MEASUREMENT_KEYS = [
  'nitrogen',
  'phosphorus',
  'potassium',
  'pH',
  'moisture',
  'organicCarbon',
];

const getRecordedSoilData = (soilData) => {
  if (!soilData || typeof soilData !== 'object') return {};

  return SOIL_MEASUREMENT_KEYS.reduce((recorded, key) => {
    const value = soilData[key];
    const provenance = soilData.measurementProvenance?.[key];
    const recordedAt = provenance?.recordedAt
      ? new Date(provenance.recordedAt).getTime()
      : Number.NaN;

    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      (key !== 'pH' || value <= 14) &&
      provenance?.source === 'farmer-entered' &&
      Number.isFinite(recordedAt)
    ) {
      recorded[key] = value;
    }

    return recorded;
  }, {});
};

const getAvailableFarmContext = (farm) => {
  if (!farm || typeof farm !== 'object') return undefined;
  const context = {};

  if (typeof farm.farmName === 'string' && farm.farmName.trim()) {
    context.farmName = farm.farmName.trim();
  }
  if (typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0) {
    context.area = farm.area;
  }
  if (typeof farm.currentCrop === 'string' && farm.currentCrop.trim()) {
    context.currentCrop = farm.currentCrop.trim();
  }
  if (typeof farm.location === 'string' && farm.location.trim()) {
    context.location = farm.location.trim();
  }

  const soilData = getRecordedSoilData(farm.soilData);
  if (Object.keys(soilData).length > 0) context.soilData = soilData;

  return Object.keys(context).length > 0 ? context : undefined;
};

const getFarmWelcomeDetails = (farm) => {
  if (!farm) return 'Farm details are unavailable because no farm is selected.';

  const details = [];
  const unavailable = [];

  if (typeof farm.farmName === 'string' && farm.farmName.trim()) {
    details.push(`Farm: ${farm.farmName.trim()}`);
  } else {
    unavailable.push('farm name');
  }
  if (typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0) {
    details.push(`Area: ${farm.area} acres`);
  } else {
    unavailable.push('area');
  }
  if (typeof farm.currentCrop === 'string' && farm.currentCrop.trim()) {
    details.push(`Current crop: ${farm.currentCrop.trim()}`);
  } else {
    unavailable.push('current crop');
  }
  if (typeof farm.location === 'string' && farm.location.trim()) {
    details.push(`Location: ${farm.location.trim()}`);
  } else {
    unavailable.push('location');
  }

  const soilData = getRecordedSoilData(farm.soilData);
  if (Object.keys(soilData).length > 0) {
    details.push(`Recorded soil measurements: ${Object.entries(soilData)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')}`);
  } else {
    unavailable.push('provenance-recorded soil measurements');
  }

  return [
    details.length > 0 ? `Available farm details: ${details.join('; ')}.` : 'Farm details are unavailable.',
    unavailable.length > 0 ? `Unavailable: ${unavailable.join(', ')}.` : '',
  ].filter(Boolean).join('\n');
};

const createWelcomeMessage = () => ({
  id: 'welcome',
  sender: 'bot',
  isWelcome: true,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

const AIAssistant = () => {
  const { activeFarm } = useFarm();
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [failedQuery, setFailedQuery] = useState('');
  const loadingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const messageSequenceRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, requestError]);

  const handleSend = async (textToSend, isRetry = false) => {
    if (loadingRef.current) return;

    const query = (typeof textToSend === 'string' ? textToSend : inputText).trim();
    if (!query) return;

    loadingRef.current = true;
    setLoading(true);
    setRequestError('');

    if (!isRetry) {
      const userMsg = {
        id: `msg-${++messageSequenceRef.current}`,
        sender: 'user',
        text: query,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setFailedQuery('');
    }

    try {
      const res = await advisoryApi.chatAssistant(query, getAvailableFarmContext(activeFarm));
      if (
        res?.success !== true ||
        typeof res.response !== 'string' ||
        !res.response.trim() ||
        typeof res.isAI !== 'boolean' ||
        typeof res.source !== 'string' ||
        !res.source.trim()
      ) {
        throw new Error('The assistant returned an invalid response.');
      }

      setMessages((prev) => [...prev, {
        id: `msg-${++messageSequenceRef.current}`,
        sender: 'bot',
        text: res.response.trim(),
        isAI: res.isAI,
        source: res.source.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setFailedQuery('');
    } catch {
      setFailedQuery(query);
      setRequestError('Unable to get a response right now. Please try again.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([createWelcomeMessage()]);
    setRequestError('');
    setFailedQuery('');
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
          <button onClick={clearHistory} className="btn btn-secondary btn-sm">
            <Trash2 size={14} /> Clear History
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          FREQUENT FARMER QUESTIONS
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                textAlign: 'left',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel chat-window">
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
                  {msg.isAI === true
                    ? 'Gemini AI'
                    : msg.isAI === false
                      ? msg.source === 'Unsupported question response'
                        ? 'Predefined notice'
                        : 'Predefined guidance'
                      : 'AgriOne AI'}
                  {msg.source && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      ({msg.source})
                    </span>
                  )}
                </div>
              )}

              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                {msg.isWelcome
                  ? `Namaste! I am your **AgriOne AI Agricultural Advisor**.\n${getFarmWelcomeDetails(activeFarm)}\n\nHow can I assist your farming decisions today?`
                  : msg.text}
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
                Preparing your response...
              </span>
            </div>
          )}

          {requestError && (
            <div className="message-bubble message-bot" role="alert">
              <div style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                {requestError}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSend(failedQuery, true)}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

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

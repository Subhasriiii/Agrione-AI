import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import LanguageSelector from './LanguageSelector';

const AuthModal = ({ isOpen, onClose, fullScreen = false }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'farmer',
    state: 'Andhra Pradesh',
    district: 'Guntur',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isRegister) {
      const res = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: formData.role,
        state: formData.state,
        district: formData.district,
      });
      if (res?.success) {
        onClose();
      } else {
        setError(res?.message || 'Registration failed');
      }
    } else {
      const res = await login(formData.email, formData.password);
      if (res?.success) {
        onClose();
      } else {
        setError(res?.message || 'Invalid credentials');
      }
    }
    setLoading(false);
  };

  return (
    <div
      className={`modal-overlay${fullScreen ? ' auth-screen' : ''}`}
      onClick={fullScreen ? undefined : onClose}
    >
      <div className="auth-modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="auth-visual-panel">
          <div className="auth-visual-overlay" />
          <div className="auth-visual-content">
            <div className="auth-brand-row">
              <div className="logo-icon-box">
                <span>🌾</span>
              </div>
              <div className="auth-brand-name">
                AgriOne <span>AI</span>
              </div>
            </div>

            <h2>Empowering Agriculture, Connecting Markets</h2>
            <p>
              Grow with confidence using practical insights for every season.
            </p>

            <div className="auth-platform-list">
              <span>Dashboard</span>
              <span>Soil</span>
              <span>Smart Irrigation</span>
              <span>Crop Insights</span>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <LanguageSelector />
          </div>
          <div className="modal-header">
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#0f172a' }}>
                {isRegister ? 'Join AgriOne AI' : 'Sign in to AgriOne AI'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Precision agriculture intelligence platform
              </p>
            </div>
            {!fullScreen && (
              <button
                onClick={onClose}
                aria-label="Close sign-in"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="modal-body">
            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <div className="auth-continue-label" style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              ── CONTINUE WITH YOUR ACCOUNT ──
            </div>

            {isRegister && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={formData.email}
                autoComplete="email"
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="farmer@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                required
                value={formData.password}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

          {isRegister && (
            <>
              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="buyer">Buyer</option>
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">District</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'Processing...' : isRegister ? 'Create Farmer Account' : 'Sign In'}
          </button>

            <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary-dark)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {isRegister
                  ? 'Already have an account? Sign In'
                  : "Don't have an account yet? Register here"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

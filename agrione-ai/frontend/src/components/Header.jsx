import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import {
  Bell,
  MapPin,
  ChevronDown,
  User,
  LogOut,
  Sun,
  Sprout,
  ShieldCheck,
  PlusCircle,
  Menu,
} from 'lucide-react';

const Header = ({ onOpenAuth, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const {
    farms,
    activeFarm,
    setActiveFarm,
    notifications,
    setShowNotificationDrawer,
  } = useFarm();

  const [farmDropdownOpen, setFarmDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          onClick={onToggleSidebar}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0.4rem', display: 'flex', alignItems: 'center' }}
          title="Toggle Navigation"
        >
          <Menu size={20} />
        </button>

        {/* Farm Selector Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setFarmDropdownOpen(!farmDropdownOpen)}
            className="farm-selector-pill"
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }}
            />
            <span style={{ color: 'var(--text-primary)' }}>
              {activeFarm?.farmName || 'Select Farm'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              ({activeFarm?.area ?? 0} Acres)
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {farmDropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: '115%',
                left: 0,
                width: 260,
                padding: '0.5rem',
                zIndex: 60,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '0.3rem 0.5rem',
                  textTransform: 'uppercase',
                }}
              >
                Switch Active Farm
              </div>
              {farms.map((f) => (
                <div
                  key={f._id}
                  onClick={() => {
                    setActiveFarm(f);
                    setFarmDropdownOpen(false);
                  }}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      activeFarm?._id === f._id
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 600,
                      color:
                        activeFarm?._id === f._id
                          ? 'var(--primary-light)'
                          : 'var(--text-primary)',
                    }}
                  >
                    <span>{f.farmName}</span>
                    <span style={{ fontSize: '0.75rem' }}>
                      {f.area} Acres
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <MapPin size={12} />
                    {f.location || 'Location not set'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Weather Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            padding: '0.35rem 0.8rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <MapPin size={15} style={{ color: '#fbbf24' }} />
          <span>
            {activeFarm?.location || 'Location unavailable'}
          </span>
        </div>
      </div>

      <div className="header-right">
        {/* Notification Bell */}
        <button
          onClick={() => setShowNotificationDrawer(true)}
          style={{
            position: 'relative',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
          title="Alerts & Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ef4444',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #34d399, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  maxWidth: 110,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.name || 'Farmer'}
              </div>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {userDropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                width: 220,
                padding: '0.5rem',
                zIndex: 60,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '0.3rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {user?.name || 'Farmer'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {user?.phone || user?.email || 'Active Session'}
                </div>
                <div style={{ marginTop: '0.3rem' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                    {user?.role || 'Farmer'}
                  </span>
                </div>
              </div>

              <div
                onClick={() => {
                  setUserDropdownOpen(false);
                  onOpenAuth();
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <User size={16} />
                Switch Account / Login
              </div>

              <div
                onClick={() => {
                  logout();
                  setUserDropdownOpen(false);
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: '0.3rem',
                }}
              >
                <LogOut size={16} />
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

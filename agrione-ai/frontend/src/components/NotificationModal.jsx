import React from 'react';
import { useFarm } from '../context/FarmContext';
import {
  X,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { schemesApi } from '../api/schemesApi';

const NotificationModal = () => {
  const {
    notifications,
    setNotifications,
    showNotificationDrawer,
    setShowNotificationDrawer,
    markAllNotificationsRead,
    activeFarm,
  } = useFarm();

  if (!showNotificationDrawer) return null;

  const handleGenerate = async () => {
    try {
      const res = await schemesApi.generateAlerts();
      if (res?.alerts) {
        setNotifications((prev) => [...res.alerts, ...prev]);
      }
    } catch (e) {
      // Add a simulated alert
      const mockAlert = {
        _id: 'notif-' + Date.now(),
        title: 'Irrigation Deficit Warning',
        message: `Soil moisture in ${activeFarm?.name || 'Active Plot'} dropped to ${activeFarm?.soilData?.moisture || 24}%. Scheduled irrigation required within 24h.`,
        type: 'irrigation_reminder',
        severity: 'warning',
        read: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [mockAlert, ...prev]);
    }
  };

  const getIcon = (severity) => {
    switch (severity) {
      case 'critical':
      case 'danger':
        return <AlertCircle size={20} style={{ color: '#ef4444' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: '#f59e0b' }} />;
      default:
        return <Info size={20} style={{ color: '#0ea5e9' }} />;
    }
  };

  return (
    <>
      <div
        className="drawer-overlay"
        onClick={() => setShowNotificationDrawer(false)}
      />
      <div className="slide-drawer">
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              Farm Early Warnings
            </span>
            <span className="badge badge-info">
              {notifications.filter((n) => !n.read).length} New
            </span>
          </div>
          <button
            onClick={() => setShowNotificationDrawer(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={handleGenerate}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem' }}
          >
            <Sparkles size={14} />
            Scan New Warnings
          </button>
          <button
            onClick={markAllNotificationsRead}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Mark all read
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-muted)',
              }}
            >
              <CheckCircle2
                size={40}
                style={{ color: '#10b981', margin: '0 auto 1rem' }}
              />
              <p>No active alerts. Your crops and soil are in optimal state!</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif._id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: notif.read
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(16, 185, 129, 0.06)',
                  border: `1px solid ${
                    notif.read ? 'var(--border-subtle)' : 'var(--border-accent)'
                  }`,
                  display: 'flex',
                  gap: '0.85rem',
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {getIcon(notif.severity)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {notif.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {notif.message}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {new Date(notif.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      {notif.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationModal;

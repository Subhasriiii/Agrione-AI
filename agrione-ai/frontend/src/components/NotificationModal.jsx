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
    unreadNotificationCount,
    notificationLoading,
    notificationError,
    setNotificationError,
    refreshNotifications,
    showNotificationDrawer,
    setShowNotificationDrawer,
    markAllNotificationsRead,
    markNotificationRead,
  } = useFarm();

  if (!showNotificationDrawer) return null;

  const handleGenerate = async () => {
    try {
      const res = await schemesApi.generateAlerts();
      if (res?.success !== true) {
        throw new Error(res?.message || 'Unable to scan for new warnings.');
      }
      const refreshResult = await refreshNotifications();
      if (!refreshResult.success) {
        return;
      }
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message || 'Unable to scan for new warnings.');
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
              {unreadNotificationCount} New
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
            disabled={unreadNotificationCount === 0 || notificationLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: unreadNotificationCount === 0 ? 'default' : 'pointer',
              opacity: unreadNotificationCount === 0 ? 0.6 : 1,
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
          {notificationError && (
            <div className="alert" role="alert">
              <div>{notificationError}</div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={refreshNotifications}
                disabled={notificationLoading}
                style={{ marginTop: '0.75rem' }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}
          {notificationLoading ? (
            <div role="status" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading notifications...
            </div>
          ) : notificationError ? null : notifications.length === 0 ? (
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
              <p>No notifications to display.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif._id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: notif.isRead
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(16, 185, 129, 0.06)',
                  border: `1px solid ${
                    notif.isRead ? 'var(--border-subtle)' : 'var(--border-accent)'
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                        {notif.type.replace('_', ' ')}
                      </span>
                      {!notif.isRead && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                          onClick={() => markNotificationRead(notif._id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
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

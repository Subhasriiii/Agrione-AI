import React from 'react';

const MetricCard = ({
  title,
  value,
  unit = '',
  icon: Icon,
  subtitle,
  badgeText,
  badgeType = 'success',
  glowColor = 'emerald',
}) => {
  const getIconStyles = () => {
    switch (glowColor) {
      case 'amber':
        return { bg: 'var(--accent-amber-light)', color: '#b45309' };
      case 'blue':
        return { bg: 'var(--accent-blue-light)', color: '#0369a1' };
      case 'purple':
        return { bg: 'var(--accent-purple-light)', color: '#6d28d9' };
      default:
        return { bg: 'var(--primary-light)', color: 'var(--primary-dark)' };
    }
  };

  const iconStyle = getIconStyles();

  return (
    <div className="glass-panel stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="stat-label">{title}</span>
        {Icon && (
          <div
            className="stat-icon-wrapper"
            style={{
              background: iconStyle.bg,
              color: iconStyle.color,
            }}
          >
            <Icon size={22} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '0.25rem 0' }}>
        <div className="stat-val">{value}</div>
        {unit && <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>{unit}</span>}
      </div>

      {(subtitle || badgeText) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem' }}>
          {subtitle && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {subtitle}
            </span>
          )}
          {badgeText && (
            <span className={`badge badge-${badgeType}`}>{badgeText}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricCard;

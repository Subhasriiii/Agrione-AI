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
    <div className="glass-panel stat-card dashboard-metric-card">
      <div className="dashboard-metric-header">
        <span className="stat-label">{title}</span>
        {Icon && (
          <div
            className="stat-icon-wrapper"
            style={{
              background: iconStyle.bg,
              color: iconStyle.color,
            }}
          >
            <Icon size={21} />
          </div>
        )}
      </div>

      <div className="dashboard-metric-value-row">
        <div className="stat-val">{value}</div>
        {unit && <span className="dashboard-metric-unit">{unit}</span>}
      </div>

      {(subtitle || badgeText) && (
        <div className="dashboard-metric-details">
          {subtitle && (
            <span className="dashboard-metric-subtitle">
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

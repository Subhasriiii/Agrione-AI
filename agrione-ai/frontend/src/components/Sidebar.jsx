import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  FlaskConical,
  Sprout,
  Bug,
  Droplets,
  TrendingUp,
  Calculator,
  Sliders,
  CloudSun,
  Store,
  ShoppingBag,
  Landmark,
  BotMessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'Core Platform',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'My Farms', path: '/farms', icon: MapPin },
    ],
  },
  {
    title: 'Farm Intelligence',
    items: [
      { name: 'Soil & OCR', path: '/soil', icon: FlaskConical, badge: 'AI' },
      { name: 'Crop Advisory', path: '/crop-recommendation', icon: Sprout },
      { name: 'Disease Detection', path: '/disease-detection', icon: Bug, badge: 'Vision' },
      { name: 'Smart Irrigation', path: '/irrigation', icon: Droplets },
    ],
  },
  {
    title: 'Financials & Scenarios',
    items: [
      { name: 'Yield & Risk', path: '/yield-risk', icon: TrendingUp },
      { name: 'Profit Calculator', path: '/profit-calculator', icon: Calculator },
      { name: 'What-If Simulator', path: '/simulation', icon: Sliders, badge: 'Sim' },
    ],
  },
  {
    title: 'Market & Ecosystem',
    items: [
      { name: 'Weather Forecast', path: '/weather', icon: CloudSun },
      { name: 'Mandi Rates', path: '/market', icon: Store },
      { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
      { name: 'Govt Schemes', path: '/schemes', icon: Landmark },
    ],
  },
  {
    title: 'AI Advisory',
    items: [
      { name: 'Agri Assistant', path: '/assistant', icon: BotMessageSquare, badge: 'GPT' },
    ],
  },
];

const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  return (
    <aside
      className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${
        isMobileOpen ? 'mobile-open' : ''
      }`}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-icon-box">
            <Sprout size={24} />
          </div>
          {!isCollapsed && (
            <div>
              <div className="brand-name">
                AgriOne <span className="brand-badge">AI</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Precision Agro OS
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: isCollapsed ? 'none' : 'block',
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx}>
            {!isCollapsed && (
              <div className="nav-group-title">{group.title}</div>
            )}
            <div className="nav-links">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `nav-link-item ${isActive ? 'active' : ''}`
                    }
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon size={19} />
                    {!isCollapsed && <span>{item.name}</span>}
                    {!isCollapsed && item.badge && (
                      <span className="nav-badge-pill">{item.badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      {!isCollapsed && (
        <div className="sidebar-footer">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
            }}
          >
            <Sparkles size={20} style={{ color: '#34d399', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399' }}>
                AI Engine Active
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Rule + ML Baselines v1.2
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

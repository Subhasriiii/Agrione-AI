import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import MetricCard from '../components/MetricCard';
import {
  Sprout,
  Droplets,
  Activity,
  IndianRupee,
  Sun,
  Wind,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  Bug,
  Calculator,
  BotMessageSquare,
  Sparkles,
} from 'lucide-react';
import { marketApi } from '../api/marketApi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

const MOCK_MANDI_PRICES = [
  { crop: 'Cotton', price: 6500, minPrice: 6000, maxPrice: 7000, market: 'Adilabad' },
  { crop: 'Chilli', price: 12000, minPrice: 10000, maxPrice: 14000, market: 'Guntur' },
  { crop: 'Rice', price: 2200, minPrice: 2000, maxPrice: 2400, market: 'Guntur' },
  { crop: 'Tomato', price: 2500, minPrice: 1500, maxPrice: 3500, market: 'Madanapalle' },
  { crop: 'Wheat', price: 2300, minPrice: 2100, maxPrice: 2500, market: 'Hapur' },
];

const HISTORICAL_HEALTH = [
  { month: 'Apr', score: 68 },
  { month: 'May', score: 72 },
  { month: 'Jun', score: 76 },
  { month: 'Jul', score: 81 },
  { month: 'Aug', score: 85 },
  { month: 'Sep', score: 88 },
];

const Dashboard = () => {
  const { user } = useAuth();
  const { activeFarm, loading, farmError, notifications, setShowNotificationDrawer } = useFarm();
  const [mandiRates, setMandiRates] = useState([]);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await marketApi.getMarketData();
        if (res?.marketData && res.marketData.length > 0) {
          setMandiRates(res.marketData.slice(0, 5));
        }
      } catch (error) {
        setMandiRates([]);
      }
    };

    fetchMarket();
  }, []);

  const soil = activeFarm?.soilData || {};

  if (!user) {
    return (
      <div className="page-container">
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Please sign in to view your farm dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Your personalized soil, crop, and farm data will appear after login.</p>
        </div>
      </div>
    );
  }

  const nutrientData = [
    { name: 'Nitrogen (N)', current: soil.nitrogen || 0, optimal: 140, unit: 'kg/ha' },
    { name: 'Phosphorus (P)', current: soil.phosphorus || 0, optimal: 40, unit: 'kg/ha' },
    { name: 'Potassium (K)', current: soil.potassium || 0, optimal: 200, unit: 'kg/ha' },
    { name: 'pH Level', current: soil.pH ? soil.pH * 20 : 0, optimal: 140, unit: 'score' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Welcome back, <span className="gradient-text">{user?.name || 'Farmer'}</span>
          </h1>
          <p className="page-subtitle">
            {activeFarm ? (
              <>
                Field operations overview for <strong>{activeFarm?.farmName || activeFarm?.name}</strong> •{' '}
                {activeFarm?.location || 'your district'}
              </>
            ) : (
              'No farm registered yet. Add your first farm to get started.'
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowNotificationDrawer(true)}
            className="btn btn-secondary btn-sm"
            disabled={notifications.length === 0}
          >
            <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
            {notifications.length} Active Warnings
          </button>
          <Link to="/assistant" className="btn btn-primary btn-sm">
            <Sparkles size={15} />
            Ask AI Advisor
          </Link>
        </div>
      </div>

      {farmError && <div className="alert" role="alert">Unable to load farm data: {farmError}</div>}

      {loading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading farm data...</div>
      ) : !activeFarm && farmError ? null : !activeFarm ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>No farm registered yet.</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add your first farm to get started.</p>
        </div>
      ) : (
        <>
          <div className="grid-4">
            <MetricCard
              title="Soil Health Index"
              value={soil.pH ? 'Healthy' : 'N/A'}
              unit={soil.pH ? '/ 100' : ''}
              icon={Activity}
              subtitle={soil.pH ? 'This farm has soil measurements recorded.' : 'No soil measurements yet'}
              badgeText={soil.pH ? 'GOOD' : 'EMPTY'}
              badgeType={soil.pH ? 'success' : 'info'}
              glowColor="emerald"
            />

            <MetricCard
              title="Soil Moisture"
              value={soil.moisture ?? 'N/A'}
              unit={soil.moisture !== undefined ? '%' : ''}
              icon={Droplets}
              subtitle={soil.moisture !== undefined ? 'Based on latest moisture record' : 'No moisture record'}
              badgeText={soil.moisture !== undefined ? 'STABLE' : 'WAITING'}
              badgeType="info"
              glowColor="blue"
            />

            <MetricCard
              title="Active Acreage"
              value={activeFarm?.area || 0}
              unit="Acres"
              icon={Sprout}
              subtitle={`Crop: ${activeFarm?.currentCrop || 'Not set'}`}
              badgeText={activeFarm?.soilType ? activeFarm.soilType.toUpperCase() : 'N/A'}
              badgeType="purple"
              glowColor="purple"
            />

            <MetricCard
              title="Market Data"
              value={mandiRates.length > 0 ? mandiRates[0].crop : 'N/A'}
              unit={mandiRates.length > 0 ? `₹${mandiRates[0].price}` : ''}
              icon={IndianRupee}
              subtitle={mandiRates.length > 0 ? `${mandiRates[0].market}` : 'No live mandi data available'}
              badgeText={mandiRates.length > 0 ? 'LIVE' : 'WAITING'}
              badgeType="warning"
              glowColor="amber"
            />
          </div>

          <div className="grid-split-2-1">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div className="card-title-bar">
                  <div className="card-title">
                    <FlaskConical size={20} style={{ color: '#34d399' }} />
                    Soil Nutrient Balance (NPK & pH)
                  </div>
                  <Link to="/soil" className="btn btn-secondary btn-sm">
                    View Full Soil Report <ArrowRight size={14} />
                  </Link>
                </div>

                <div style={{ height: 200, width: '100%', marginTop: '1rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nutrientData} barGap={8}>
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#0d171b', borderColor: '#34d399', borderRadius: 8 }} />
                      <Bar dataKey="current" name="Current Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="optimal" name="Target Optimal" fill="#38bdf8" radius={[4, 4, 0, 0]} opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1.25rem', textAlign: 'center' }}>
                  <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nitrogen (N)</span>
                    <div style={{ fontWeight: 700, color: '#34d399' }}>{soil.nitrogen ?? 'N/A'}</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phosphorus (P)</span>
                    <div style={{ fontWeight: 700, color: '#38bdf8' }}>{soil.phosphorus ?? 'N/A'}</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Potassium (K)</span>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{soil.potassium ?? 'N/A'}</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pH Level</span>
                    <div style={{ fontWeight: 700, color: '#a855f7' }}>{soil.pH ?? 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

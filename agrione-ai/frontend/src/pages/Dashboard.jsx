import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import MetricCard from '../components/MetricCard';
import {
  Sprout,
  Droplets,
  Activity,
  IndianRupee,
  AlertTriangle,
  ArrowRight,
  FlaskConical,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { marketApi } from '../api/marketApi';

const requestMarketData = async () => {
  const res = await marketApi.getMarketData();
  if (!Array.isArray(res?.marketData)) {
    throw new Error(res?.message || 'The market data service returned an unexpected response.');
  }

  return {
    marketData: res.marketData.filter((item) =>
      item &&
      typeof item.crop === 'string' &&
      typeof item.market === 'string' &&
      typeof item.price === 'number' &&
      Number.isFinite(item.price)
    ).slice(0, 5),
    note: typeof res.note === 'string' ? res.note : '',
  };
};

const getRecordedSoilValue = (soilData, field) => {
  const value = soilData?.[field];
  const provenance = soilData?.measurementProvenance?.[field];
  const recordedAt = provenance?.recordedAt;

  return typeof value === 'number' &&
    Number.isFinite(value) &&
    provenance?.source === 'farmer-entered' &&
    Boolean(recordedAt) &&
    Number.isFinite(Date.parse(recordedAt))
    ? value
    : 'Not recorded';
};

const Dashboard = () => {
  const { user } = useAuth();
  const {
    activeFarm,
    loading,
    farmError,
    unreadNotificationCount,
    notificationLoading,
    notificationError,
    refreshNotifications,
    setShowNotificationDrawer,
  } = useFarm();
  const [marketData, setMarketData] = useState([]);
  const [marketNote, setMarketNote] = useState('');
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState('');

  const fetchMarket = useCallback(async () => {
    try {
      const result = await requestMarketData();
      setMarketData(result.marketData);
      setMarketNote(result.note);
      setMarketError('');
    } catch (error) {
      setMarketData([]);
      setMarketNote('');
      setMarketError(error.message || 'Unable to load market data.');
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestMarketData().then((result) => {
      if (!active) return;
      setMarketData(result.marketData);
      setMarketNote(result.note);
      setMarketError('');
      setMarketLoading(false);
    }).catch((error) => {
      if (!active) return;
      setMarketData([]);
      setMarketNote('');
      setMarketError(error.message || 'Unable to load market data.');
      setMarketLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const featuredMarket = marketData[0];
  const soilData = activeFarm?.soilData;
  const marketStatus = featuredMarket
    ? featuredMarket.status === 'VERIFIED' && featuredMarket.source
      ? 'VERIFIED'
      : 'INDICATIVE'
    : 'NOT AVAILABLE';

  if (!user) {
    return (
      <div className="page-container dashboard-page">
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Please sign in to view your farm dashboard</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Your personalized soil, crop, and farm data will appear after login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container dashboard-page">
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

        <div className="dashboard-header-actions">
          <button
            onClick={() => setShowNotificationDrawer(true)}
            className="btn btn-secondary btn-sm"
            title={notificationError || 'Open unread notifications'}
          >
            <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
            {notificationError ? 'Alerts unavailable' : notificationLoading ? 'Loading alerts...' : `${unreadNotificationCount} Active Warnings`}
          </button>
          <Link to="/assistant" className="btn btn-primary btn-sm">
            <Sparkles size={15} />
            Ask AI Advisor
          </Link>
        </div>
      </div>

      {farmError && <div className="alert dashboard-alert" role="alert">Unable to load farm data: {farmError}</div>}
      {notificationError && (
        <div className="alert dashboard-alert dashboard-alert-retry" role="alert">
          <span>Unable to load notifications: {notificationError}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={refreshNotifications} disabled={notificationLoading}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel dashboard-state" role="status">Loading farm data...</div>
      ) : !activeFarm && farmError ? null : !activeFarm ? (
        <div className="glass-panel dashboard-state">
          <h3>No farm registered yet.</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add your first farm to get started.</p>
        </div>
      ) : (
        <>
          <div className="dashboard-metrics">
            <MetricCard
              title="Soil Health Index"
              value="Not available"
              icon={Activity}
              subtitle="No calculated soil health score is recorded"
              badgeText="UNAVAILABLE"
              badgeType="info"
              glowColor="emerald"
            />

            <MetricCard
              title="Soil Moisture"
              value="Not recorded"
              icon={Droplets}
              subtitle="Measurement provenance is not available"
              badgeText="UNAVAILABLE"
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
              value={marketLoading ? 'Loading...' : marketError ? 'Not available' : featuredMarket?.crop || 'Not available'}
              unit={featuredMarket ? `₹${Number(featuredMarket.price).toLocaleString()}` : ''}
              icon={IndianRupee}
              subtitle={marketLoading ? 'Fetching market records' : marketError ? marketError : featuredMarket?.market || 'No market records available'}
              badgeText={marketLoading ? 'LOADING' : marketError ? 'ERROR' : marketStatus}
              badgeType={marketStatus === 'VERIFIED' ? 'success' : marketStatus === 'INDICATIVE' ? 'warning' : 'info'}
              glowColor="amber"
            />
          </div>

          <div className="dashboard-sections">
            <div className="dashboard-section-stack">
              <div className="glass-panel dashboard-panel">
                <div className="card-title-bar">
                  <div className="card-title">
                    <FlaskConical size={20} style={{ color: '#34d399' }} />
                    Soil Measurements
                  </div>
                  <Link to="/soil" className="btn btn-secondary btn-sm">
                    View Full Soil Report <ArrowRight size={14} />
                  </Link>
                </div>

                <p className="dashboard-section-note">
                  Only soil measurements with valid recorded provenance are displayed.
                </p>
                <div className="dashboard-nutrient-grid">
                  <div className="dashboard-nutrient-item dashboard-nutrient-n">
                    <span className="dashboard-nutrient-label">Nitrogen (N)</span>
                    <strong>{getRecordedSoilValue(soilData, 'nitrogen')}</strong>
                    <span className="dashboard-nutrient-unit">kg/ha</span>
                  </div>
                  <div className="dashboard-nutrient-item dashboard-nutrient-p">
                    <span className="dashboard-nutrient-label">Phosphorus (P)</span>
                    <strong>{getRecordedSoilValue(soilData, 'phosphorus')}</strong>
                    <span className="dashboard-nutrient-unit">kg/ha</span>
                  </div>
                  <div className="dashboard-nutrient-item dashboard-nutrient-k">
                    <span className="dashboard-nutrient-label">Potassium (K)</span>
                    <strong>{getRecordedSoilValue(soilData, 'potassium')}</strong>
                    <span className="dashboard-nutrient-unit">kg/ha</span>
                  </div>
                  <div className="dashboard-nutrient-item dashboard-nutrient-ph">
                    <span className="dashboard-nutrient-label">pH Level</span>
                    <strong>{getRecordedSoilValue(soilData, 'pH')}</strong>
                    <span className="dashboard-nutrient-unit">pH scale: 0–14</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel dashboard-panel">
                <div className="card-title-bar">
                  <div className="card-title">
                    <IndianRupee size={20} style={{ color: '#f59e0b' }} />
                    Market Prices
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm dashboard-retry-button"
                    onClick={() => {
                      setMarketLoading(true);
                      setMarketError('');
                      setMarketData([]);
                      setMarketNote('');
                      fetchMarket();
                    }}
                    disabled={marketLoading}
                  >
                    <RefreshCw size={14} />
                    {marketLoading ? 'Loading...' : 'Retry'}
                  </button>
                </div>

                {marketNote && (
                  <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>{marketNote}</p>
                )}
                {marketLoading ? (
                  <p role="status" className="dashboard-state">Loading market prices...</p>
                ) : marketError ? (
                  <div role="alert" className="alert dashboard-state dashboard-error">
                    Unable to load market prices: {marketError}
                  </div>
                ) : marketData.length === 0 ? (
                  <p className="dashboard-state">No usable market data is available.</p>
                ) : (
                  <div className="dashboard-market-list">
                    {marketData.map((item, index) => {
                      const verified = item.status === 'VERIFIED' && item.source;
                      const priceDate = verified && item.priceDate && Number.isFinite(Date.parse(item.priceDate))
                        ? new Date(item.priceDate).toLocaleDateString()
                        : 'Not available';

                      return (
                        <div
                          key={item._id || `${item.crop}-${item.market}-${index}`}
                          className="dashboard-market-item"
                        >
                          <div className="dashboard-market-crop"><strong>{item.crop}</strong><span>{item.market}</span></div>
                          <div className="dashboard-market-price">₹{Number(item.price).toLocaleString()} <span>{item.unit || 'Unit not provided'}</span></div>
                          <div className="dashboard-market-status">{verified ? 'VERIFIED' : 'INDICATIVE'}<span>Date: {priceDate}</span></div>
                          <div className="dashboard-market-source">
                            {item.source ? `Source: ${item.source}` : marketNote || 'Source not provided'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

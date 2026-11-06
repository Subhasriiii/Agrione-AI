import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import { schemesApi } from '../api/schemesApi';
import { translations } from '../i18n/translations';
import useLanguage from '../context/useLanguage';
import {
  Activity,
  ArrowRight,
  Bell,
  Bug,
  CloudSun,
  Droplets,
  FlaskConical,
  Leaf,
  MapPin,
  RefreshCw,
  Sprout,
} from 'lucide-react';

const SOIL_MEASUREMENTS = [
  { field: 'nitrogen', label: 'Nitrogen (N)', unit: 'kg/ha', tone: 'nitrogen' },
  { field: 'phosphorus', label: 'Phosphorus (P)', unit: 'kg/ha', tone: 'phosphorus' },
  { field: 'potassium', label: 'Potassium (K)', unit: 'kg/ha', tone: 'potassium' },
  { field: 'pH', label: 'pH Level', unit: 'pH scale: 0–14', tone: 'ph' },
];

const QUICK_LINKS = [
  { label: 'Crop Recommendation', path: '/crop-recommendation', icon: Sprout },
  { label: 'Soil Intelligence', path: '/soil', icon: FlaskConical },
  { label: 'Weather Forecast', path: '/weather', icon: CloudSun },
  { label: 'Smart Irrigation', path: '/irrigation', icon: Droplets },
  { label: 'Disease Detection', path: '/disease-detection', icon: Bug },
  { label: 'My Farms', path: '/farms', icon: Leaf },
];

const getRecordedSoilMeasurements = (soilData) => SOIL_MEASUREMENTS.flatMap((measurement) => {
  const value = soilData?.[measurement.field];
  const provenance = soilData?.measurementProvenance?.[measurement.field];
  const recordedAt = provenance?.recordedAt;
  const validValue = typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    (measurement.field !== 'pH' || value <= 14);
  const validProvenance = provenance?.source === 'farmer-entered' &&
    Boolean(recordedAt) &&
    Number.isFinite(Date.parse(recordedAt));

  return validValue && validProvenance ? [{ ...measurement, value }] : [];
});

const getFarmLocation = (farm) => (
  typeof farm?.location === 'string' && farm.location.trim()
    ? farm.location.trim()
    : ''
);

const formatNotificationTime = (date, language) => {
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const Dashboard = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const {
    activeFarm,
    loading,
    farmError,
    notifications,
    unreadNotificationCount,
    notificationLoading,
    notificationError,
    refreshNotifications,
    setShowNotificationDrawer,
  } = useFarm();
  const [weatherRequest, setWeatherRequest] = useState({ key: '', weather: null, error: '' });
  const [weatherRetry, setWeatherRetry] = useState(0);
  const t = (key, fallback = key) => translations[language]?.[key] ?? fallback;
  const farmLocation = getFarmLocation(activeFarm);
  const weatherRequestKey = `${farmLocation}:${weatherRetry}`;
  const weatherLoading = Boolean(farmLocation) && weatherRequest.key !== weatherRequestKey;
  const weather = weatherRequest.key === weatherRequestKey ? weatherRequest.weather : null;
  const weatherError = weatherRequest.key === weatherRequestKey ? weatherRequest.error : '';

  useEffect(() => {
    if (!farmLocation) return undefined;
    let active = true;

    const loadWeather = async () => {
      try {
        const response = await schemesApi.getWeather({ location: farmLocation });
        if (!active) return;
        if (response?.success !== true || response?.isLive !== true || !response.weather) {
          throw new Error(response?.message || 'Live weather data is unavailable.');
        }
        setWeatherRequest({ key: weatherRequestKey, weather: response.weather, error: '' });
      } catch (error) {
        if (!active) return;
        setWeatherRequest({
          key: weatherRequestKey,
          weather: null,
          error: error.message || 'Unable to load weather data.',
        });
      }
    };

    loadWeather();
    return () => {
      active = false;
    };
  }, [farmLocation, weatherRequestKey]);

  const soilMeasurements = getRecordedSoilMeasurements(activeFarm?.soilData);
  const farmArea = typeof activeFarm?.area === 'number' &&
    Number.isFinite(activeFarm.area) &&
    activeFarm.area > 0
    ? activeFarm.area
    : null;
  const currentCrop = typeof activeFarm?.currentCrop === 'string' && activeFarm.currentCrop.trim()
    ? activeFarm.currentCrop.trim()
    : '';
  const recentNotifications = notifications.slice(0, 3);

  if (!user) {
    return (
      <div className="page-container dashboard-page">
        <div className="glass-panel dashboard-state" role="status">
          <h2>{t('Please sign in to view your farm dashboard')}</h2>
          <p>{t('Your personalized soil, crop, and farm data will appear after login.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container dashboard-page">
      <section className="dashboard-welcome">
        <div className="dashboard-welcome-content">
          <div className="dashboard-eyebrow">
            <Sprout size={16} />
            {t('Your farm at a glance')}
          </div>
          <h1>
            {t('Welcome back,')} <span>{user.name || t('Farmer')}</span>
          </h1>
          {activeFarm ? (
            <div className="dashboard-farm-caption">
              <MapPin size={16} />
              <span>
                {t('Active farm')}: <strong>{activeFarm.farmName || activeFarm.name}</strong>
                {farmLocation && <> · {farmLocation}</>}
              </span>
            </div>
          ) : (
            <p className="dashboard-welcome-description">
              {t('No farm registered yet. Add your first farm to get started.')}
            </p>
          )}
        </div>
        <div className="dashboard-welcome-mark" aria-hidden="true">
          <Leaf size={82} strokeWidth={1.2} />
        </div>
        <div className="dashboard-header-actions">
          <button
            type="button"
            onClick={() => setShowNotificationDrawer(true)}
            className="btn btn-secondary btn-sm"
            title={notificationError || t('Open unread notifications')}
          >
            <Bell size={15} />
            {notificationLoading
              ? t('Loading alerts...')
              : `${unreadNotificationCount} ${t('Active Warnings')}`}
          </button>
          <Link to="/crop-recommendation" className="btn btn-primary btn-sm">
            <Sprout size={15} />
            {t('Get crop recommendations')}
          </Link>
        </div>
      </section>

      {farmError && (
        <div className="alert dashboard-alert" role="alert">
          {t('Unable to load farm data:')} {farmError}
        </div>
      )}
      {notificationError && (
        <div className="alert dashboard-alert dashboard-alert-retry" role="alert">
          <span>{t('Unable to load notifications:')} {notificationError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshNotifications}
            disabled={notificationLoading}
          >
            <RefreshCw size={14} /> {t('Retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel dashboard-state" role="status">{t('Loading farm data...')}</div>
      ) : !activeFarm && farmError ? null : !activeFarm ? (
        <div className="glass-panel dashboard-state dashboard-empty-farm">
          <Sprout size={28} />
          <h2>{t('No farm registered yet.')}</h2>
          <p>{t('Add your first farm to get started.')}</p>
          <Link to="/farms" className="btn btn-primary btn-sm">{t('Add New Farm')}</Link>
        </div>
      ) : (
        <>
          {(farmArea !== null || currentCrop) && (
            <section className="dashboard-overview-grid" aria-label={t('Farm overview')}>
              {farmArea !== null && (
                <article className="dashboard-overview-card dashboard-overview-acreage">
                  <div className="dashboard-overview-icon"><Sprout size={21} /></div>
                  <div>
                    <span className="dashboard-overview-label">{t('Active Acreage')}</span>
                    <div className="dashboard-overview-value">
                      {farmArea.toLocaleString(language === 'te' ? 'te-IN' : 'en-IN')}
                      <span>{t('Acres')}</span>
                    </div>
                  </div>
                </article>
              )}
              {currentCrop && (
                <article className="dashboard-overview-card dashboard-overview-crop">
                  <div className="dashboard-overview-icon"><Leaf size={21} /></div>
                  <div>
                    <span className="dashboard-overview-label">{t('Current crop')}</span>
                    <div className="dashboard-overview-value dashboard-overview-crop-value">{currentCrop}</div>
                  </div>
                </article>
              )}
            </section>
          )}

          <section className="dashboard-main-grid">
            <article className="glass-panel dashboard-panel dashboard-soil-panel">
              <div className="dashboard-panel-heading">
                <div className="dashboard-panel-title">
                  <span className="dashboard-panel-icon dashboard-icon-soil"><FlaskConical size={20} /></span>
                  <div>
                    <h2>{t('Soil Measurements')}</h2>
                    <p>{t('Recorded readings from your active farm')}</p>
                  </div>
                </div>
                <Link to="/soil" className="btn btn-secondary btn-sm">
                  {t('View Full Soil Report')} <ArrowRight size={14} />
                </Link>
              </div>
              {soilMeasurements.length > 0 ? (
                <div className="dashboard-soil-grid">
                  {soilMeasurements.map((measurement) => (
                    <div
                      key={measurement.field}
                      className={`dashboard-soil-measurement dashboard-soil-${measurement.tone}`}
                    >
                      <span className="dashboard-soil-symbol">
                        {measurement.field === 'pH' ? 'pH' : measurement.field.charAt(0).toUpperCase()}
                      </span>
                      <span className="dashboard-soil-label">{t(measurement.label)}</span>
                      <strong>{measurement.value.toLocaleString(language === 'te' ? 'te-IN' : 'en-IN')}</strong>
                      <span className="dashboard-soil-unit">{t(measurement.unit)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-inline-empty">
                  <FlaskConical size={22} />
                  <p>{t('No valid recorded soil measurements are available for this farm.')}</p>
                  <Link to="/soil">{t('Add soil measurements')}</Link>
                </div>
              )}
            </article>

            <article className="glass-panel dashboard-panel dashboard-weather-panel">
              <div className="dashboard-panel-heading">
                <div className="dashboard-panel-title">
                  <span className="dashboard-panel-icon dashboard-icon-weather"><CloudSun size={21} /></span>
                  <div>
                    <h2>{t('Weather overview')}</h2>
                    <p>{farmLocation || t('Farm location not set')}</p>
                  </div>
                </div>
                <Link to="/weather" className="dashboard-text-link" aria-label={t('Open weather forecast')}>
                  <ArrowRight size={18} />
                </Link>
              </div>
              {weatherLoading ? (
                <div className="dashboard-weather-state" role="status">{t('Loading weather...')}</div>
              ) : weatherError ? (
                <div className="dashboard-weather-state dashboard-weather-error" role="alert">
                  <p>{t(weatherError)}</p>
                  {farmLocation && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setWeatherRetry((retry) => retry + 1)}
                    >
                      <RefreshCw size={14} /> {t('Retry')}
                    </button>
                  )}
                </div>
              ) : weather ? (
                <div className="dashboard-weather-content">
                  <div className="dashboard-weather-current">
                    <span className="dashboard-weather-temperature">
                      {Number.isFinite(weather.temperature) ? `${Math.round(weather.temperature)}°` : '—'}
                    </span>
                    <span className="dashboard-weather-condition">
                      {weather.description || t('Weather condition unavailable')}
                    </span>
                    <span className="dashboard-weather-place">{weather.location || farmLocation}</span>
                  </div>
                  <div className="dashboard-weather-details">
                    {Number.isFinite(weather.humidity) && (
                      <div><Droplets size={16} /><span>{t('Humidity')}</span><strong>{weather.humidity}%</strong></div>
                    )}
                    {Number.isFinite(weather.windSpeed) && (
                      <div><Activity size={16} /><span>{t('Wind')}</span><strong>{weather.windSpeed} m/s</strong></div>
                    )}
                  </div>
                  <span className="dashboard-live-label"><span />{t('Live weather')}</span>
                </div>
              ) : (
                <div className="dashboard-weather-state">
                  <CloudSun size={24} />
                  <p>{t('Weather is shown when live data is available for your farm location.')}</p>
                </div>
              )}
            </article>

            <article className="glass-panel dashboard-panel dashboard-notifications-panel">
              <div className="dashboard-panel-heading">
                <div className="dashboard-panel-title">
                  <span className="dashboard-panel-icon dashboard-icon-alerts"><Bell size={19} /></span>
                  <div>
                    <h2>{t('Recent farm alerts')}</h2>
                    <p>{t('Updates from your farm notifications')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="dashboard-text-link"
                  onClick={() => setShowNotificationDrawer(true)}
                  aria-label={t('View all notifications')}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
              {notificationLoading ? (
                <div className="dashboard-notification-state" role="status">{t('Loading notifications...')}</div>
              ) : notificationError ? (
                <div className="dashboard-notification-state" role="alert">
                  <p>{t('Unable to load notifications:')} {notificationError}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={refreshNotifications}
                  >
                    <RefreshCw size={14} /> {t('Retry')}
                  </button>
                </div>
              ) : recentNotifications.length > 0 ? (
                <div className="dashboard-notification-list">
                  {recentNotifications.map((notification) => (
                    <div className="dashboard-notification-item" key={notification._id}>
                      <span className={`dashboard-notification-dot ${notification.isRead ? '' : 'unread'}`} />
                      <div>
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                        {notification.createdAt && (
                          <time>{formatNotificationTime(notification.createdAt, language)}</time>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-notification-state">
                  <p>{t('No recent farm alerts.')}</p>
                  <button type="button" className="dashboard-inline-link" onClick={() => setShowNotificationDrawer(true)}>
                    {t('Open notifications')} <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </article>

            <article className="dashboard-recommendation-card">
              <div className="dashboard-recommendation-art" aria-hidden="true"><Sprout size={34} /></div>
              <div className="dashboard-recommendation-copy">
                <span>{t('Crop Recommendation')}</span>
                <h2>{t('Plan your next crop with farm-specific insights')}</h2>
                <p>{t('Explore recommendations using your recorded soil and farm conditions.')}</p>
              </div>
              <Link to="/crop-recommendation" className="btn btn-primary btn-sm">
                {t('Explore crops')} <ArrowRight size={14} />
              </Link>
            </article>
          </section>

          <section className="dashboard-quick-access">
            <div className="dashboard-quick-heading">
              <div>
                <span className="dashboard-eyebrow"><Leaf size={15} />{t('Farm tools')}</span>
                <h2>{t('Quick access')}</h2>
              </div>
            </div>
            <div className="dashboard-quick-grid">
              {QUICK_LINKS.map(({ label, path, icon: Icon }) => (
                <Link to={path} className="dashboard-quick-link" key={path}>
                  <span><Icon size={20} /></span>
                  <strong>{t(label)}</strong>
                  <ArrowRight size={15} className="dashboard-quick-arrow" />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;

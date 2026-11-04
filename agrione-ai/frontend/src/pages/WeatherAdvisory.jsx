import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFarm } from '../context/FarmContext';
import { schemesApi } from '../api/schemesApi';
import { AlertTriangle } from 'lucide-react';

const WeatherAdvisory = () => {
  const { activeFarm } = useFarm();
  const farmLocation = activeFarm?.location?.district || activeFarm?.location?.state || 'Hyderabad';
  const [location, setLocation] = useState(farmLocation);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [forecastError, setForecastError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const fetchWeather = useCallback(async (city) => {
    const requestedLocation = city.trim();
    if (!requestedLocation) {
      requestId.current += 1;
      setLoading(false);
      setCurrentWeather(null);
      setForecast([]);
      setForecastError('');
      setError('Enter a city name to search for weather.');
      return;
    }

    const currentRequestId = ++requestId.current;
    setLoading(true);
    setCurrentWeather(null);
    setForecast([]);
    setForecastError('');
    setError('');

    try {
      const res = await schemesApi.getWeather({ location: requestedLocation });
      if (currentRequestId !== requestId.current) return;

      if (res?.weather) {
        setCurrentWeather(res.weather);
        setForecast(res.forecast || []);
        setForecastError(res.forecastError || '');
      } else {
        setCurrentWeather(null);
        setForecast([]);
        setError(res?.message || `Unable to load weather for ${requestedLocation}. Check the city name and try again.`);
      }
    } catch (apiError) {
      if (currentRequestId !== requestId.current) return;
      setCurrentWeather(null);
      setForecast([]);
      setForecastError('');
      setError(apiError.message || `Unable to load weather for ${requestedLocation}. Check the city name and try again.`);
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setLocation(farmLocation);
    fetchWeather(farmLocation);
  }, [activeFarm?._id, farmLocation, fetchWeather]);

  const handleSearch = (event) => {
    event.preventDefault();
    fetchWeather(location);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Agro-Meteorological <span className="gradient-text">Weather Advisory</span>
          </h1>
          <p className="page-subtitle">
            Weather data is shown only when a live API key is configured. No fabricated values are displayed.
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Enter city name"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          aria-label="City name"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading ? (
        <div className="glass-panel" role="status" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading weather...
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ color: '#fbbf24', marginBottom: '0.5rem' }} />
          <h3>Weather data unavailable</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : currentWeather ? (
        <>
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
              <h2>{currentWeather.location || 'Location unavailable'}</h2>
              <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{currentWeather.temperature ?? '--'}°C</div>
              <div style={{ color: 'var(--text-secondary)' }}>{currentWeather.description || 'Weather condition unavailable'}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div><small>Humidity</small><div>{currentWeather.humidity ?? '--'}%</div></div>
                <div><small>Wind</small><div>{currentWeather.windSpeed ?? '--'} m/s</div></div>
                <div><small>Rain</small><div>{currentWeather.rainfall ?? 0} mm</div></div>
              </div>
            </div>
          </div>

          {forecastError && (
            <div className="glass-panel" role="alert" style={{ padding: '1rem', marginBottom: '1rem', color: '#fbbf24' }}>
              Five-day forecast unavailable: {forecastError}
            </div>
          )}

          {forecast.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {forecast.map((item) => (
                <div key={item.date || item.day} className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div>{item.day || 'Day'}</div>
                  {item.date && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.date}</div>}
                  <div style={{ margin: '0.5rem 0', fontWeight: 700 }}>
                    {item.tempMax ?? '--'}° / {item.tempMin ?? '--'}°C
                  </div>
                  <div style={{ textTransform: 'capitalize' }}>{item.condition || 'Condition unavailable'}</div>
                  <div>{item.rainProb ?? '--'}% rain probability</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>No live weather data available</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Configure the weather API to display real-time crop advisories.</p>
        </div>
      )}
    </div>
  );
};

export default WeatherAdvisory;

import React, { useState, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import { schemesApi } from '../api/schemesApi';
import {
  Sun,
  CloudRain,
  Wind,
  Droplets,
  CloudSun,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

const MOCK_FORECAST = [
  { day: 'Today', tempMax: 32, tempMin: 23, condition: 'Sunny', rainProb: 10, icon: Sun },
  { day: 'Tomorrow', tempMax: 33, tempMin: 24, condition: 'Partly Cloudy', rainProb: 20, icon: CloudSun },
  { day: 'Thursday', tempMax: 30, tempMin: 22, condition: 'Scattered Showers', rainProb: 65, icon: CloudRain },
  { day: 'Friday', tempMax: 29, tempMin: 22, condition: 'Light Rain', rainProb: 75, icon: CloudRain },
  { day: 'Saturday', tempMax: 31, tempMin: 23, condition: 'Partly Cloudy', rainProb: 30, icon: CloudSun },
  { day: 'Sunday', tempMax: 33, tempMin: 24, condition: 'Sunny & Warm', rainProb: 10, icon: Sun },
  { day: 'Monday', tempMax: 34, tempMin: 25, condition: 'Sunny', rainProb: 5, icon: Sun },
];

const WeatherAdvisory = () => {
  const { activeFarm } = useFarm();
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await schemesApi.getWeather({
          location: activeFarm?.location?.district || activeFarm?.location?.state || 'Hyderabad',
        });

        if (res?.weather) {
          setCurrentWeather(res.weather);
          setForecast(res.forecast || []);
          setError('');
        } else {
          setCurrentWeather(null);
          setForecast([]);
          setError(res?.message || 'Live weather is not configured yet.');
        }
      } catch (apiError) {
        setCurrentWeather(null);
        setForecast([]);
        setError(apiError.message || 'Weather feed is unavailable.');
      }
    };

    fetchWeather();
  }, [activeFarm]);

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

      {error ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ color: '#fbbf24', marginBottom: '0.5rem' }} />
          <h3>Weather data unavailable</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <p style={{ color: 'var(--text-muted)' }}>Add WEATHER_API_KEY to the backend .env file to enable live weather integration.</p>
        </div>
      ) : currentWeather ? (
        <>
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{currentWeather.temperature ?? '--'}°C</div>
                <div style={{ color: 'var(--text-secondary)' }}>{currentWeather.description || 'Weather condition unavailable'}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div><small>Humidity</small><div>{currentWeather.humidity ?? '--'}%</div></div>
                <div><small>Wind</small><div>{currentWeather.windSpeed ?? '--'} km/h</div></div>
                <div><small>Rain</small><div>{currentWeather.rainfall ?? 0} mm</div></div>
              </div>
            </div>
          </div>

          {forecast.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {forecast.map((item, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div>{item.day || 'Day'}</div>
                  <div style={{ margin: '0.5rem 0', fontWeight: 700 }}>{item.tempMax ?? '--'}° / {item.tempMin ?? '--'}°</div>
                  <div>{item.rainProb ?? 0}% rain</div>
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

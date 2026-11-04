import { useCallback, useEffect, useRef, useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { advisoryApi } from '../api/advisoryApi';
import { schemesApi } from '../api/schemesApi';
import {
  Droplets,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

const getFarmInputs = (farm) => ({
  crop: farm?.currentCrop || '',
  soilType: farm?.soilType || '',
  soilMoisture:
    typeof farm?.soilData?.moisture === 'number' && farm.soilData.moisture > 0
      ? String(farm.soilData.moisture)
      : '',
  temperature: '',
  humidity: '',
  rainfall: '',
  irrigationMethod: farm?.irrigationType || '',
  growthStage: '',
});

const getFarmWeatherLocation = (farm) => {
  const farmLocation = typeof farm?.location === 'string' ? farm.location.trim() : '';
  const looksLikeCityQuery = farmLocation.length > 0
    && farmLocation.length <= 60
    && !/[,\d]/.test(farmLocation)
    && !/\b(?:road|street|lane|highway|near|plot|house|survey|pincode|postal)\b/i.test(farmLocation)
    && /^[\p{L}][\p{L}\s.'-]*[\p{L}.]$/u.test(farmLocation);

  return looksLikeCityQuery ? farmLocation : 'Hyderabad';
};

const SmartIrrigation = () => {
  const { activeFarm } = useFarm();
  return <IrrigationCalculator key={activeFarm?._id || 'no-active-farm'} activeFarm={activeFarm} />;
};

const IrrigationCalculator = ({ activeFarm }) => {
  const initialWeatherLocation = useRef(getFarmWeatherLocation(activeFarm));
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(() => getFarmInputs(activeFarm));
  const [weatherLocation, setWeatherLocation] = useState(initialWeatherLocation.current);
  const [weatherResultLocation, setWeatherResultLocation] = useState('');
  const [advice, setAdvice] = useState(null);
  const [error, setError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherStatus, setWeatherStatus] = useState({ type: 'loading', message: 'Loading live weather...' });
  const manuallyEditedWeatherFields = useRef(new Set());
  const weatherRequestId = useRef(0);

  const fetchWeather = useCallback(async (city) => {
    const location = city.trim();
    const requestId = ++weatherRequestId.current;
    if (!location) {
      setWeatherLoading(false);
      setWeatherResultLocation('');
      setWeatherStatus({ type: 'unavailable', message: 'Enter a city name to fetch live weather.' });
      return;
    }

    setWeatherLoading(true);
    setWeatherStatus({ type: 'loading', message: `Loading live weather for ${location}...` });

    try {
      const res = await schemesApi.getWeather({ location });
      if (requestId !== weatherRequestId.current) return;

      if (!res?.weather) {
        setWeatherResultLocation('');
        setWeatherStatus({
          type: 'unavailable',
          message: res?.message || `Live weather for ${location} is unavailable. Temperature and humidity can be entered manually.`,
        });
        return;
      }

      const weatherValues = {};
      ['temperature', 'humidity'].forEach((field) => {
        const value = res.weather[field];
        if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
          weatherValues[field] = String(value);
        }
      });

      setInputs((current) => {
        const next = { ...current };
        Object.entries(weatherValues).forEach(([field, value]) => {
          if (!manuallyEditedWeatherFields.current.has(field)) {
            next[field] = value;
          }
        });
        return next;
      });
      const returnedLocation = res.weather.location || location;
      setWeatherResultLocation(returnedLocation);
      setWeatherStatus({
        type: 'success',
        message: `Live weather loaded for ${returnedLocation}. Rainfall remains a manual input.`,
      });
    } catch (weatherError) {
      if (requestId !== weatherRequestId.current) return;
      setWeatherResultLocation('');
      setWeatherStatus({
        type: 'unavailable',
        message: `${weatherError.message || `Live weather for ${location} is unavailable.`} Temperature and humidity can be entered manually.`,
      });
    } finally {
      if (requestId === weatherRequestId.current) {
        setWeatherLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchWeather(initialWeatherLocation.current);
    return () => {
      weatherRequestId.current += 1;
    };
  }, [fetchWeather]);

  const handleWeatherInputChange = (field, value) => {
    manuallyEditedWeatherFields.current.add(field);
    setInputs((current) => ({ ...current, [field]: value }));
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    const crop = inputs.crop.trim();
    const soilMoisture = Number(inputs.soilMoisture);
    if (!crop) {
      setError('Enter the crop being grown on this field.');
      setAdvice(null);
      return;
    }
    if (inputs.soilMoisture === '' || !Number.isFinite(soilMoisture) || soilMoisture < 0 || soilMoisture > 100) {
      setError('Enter a measured soil moisture value between 0 and 100%.');
      setAdvice(null);
      return;
    }

    const optionalNumbers = [
      { field: 'temperature', label: 'Temperature', min: -50, max: 60 },
      { field: 'humidity', label: 'Humidity', min: 0, max: 100 },
      { field: 'rainfall', label: 'Rainfall forecast', min: 0, max: Number.POSITIVE_INFINITY },
    ];
    for (const { field, label, min, max } of optionalNumbers) {
      const value = inputs[field];
      if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)) {
        setError(`${label} must be ${Number.isFinite(max) ? `between ${min} and ${max}` : `${min} or greater`}.`);
        setAdvice(null);
        return;
      }
    }

    setLoading(true);
    setAdvice(null);
    setError('');
    try {
      const res = await advisoryApi.getIrrigationAdvice({
        farmId: activeFarm?._id,
        crop: crop.toLowerCase(),
        soilType: inputs.soilType,
        soilMoisture,
        temperature: inputs.temperature === '' ? undefined : Number(inputs.temperature),
        humidity: inputs.humidity === '' ? undefined : Number(inputs.humidity),
        rainfall: inputs.rainfall === '' ? undefined : Number(inputs.rainfall),
        irrigationMethod: inputs.irrigationMethod,
        growthStage: inputs.growthStage,
      });
      if (res?.success && res.irrigation) {
        setAdvice(res.irrigation);
      } else {
        setError(res?.message || 'Irrigation advice could not be calculated.');
      }
    } catch (err) {
      setError(err.message || 'Unable to calculate irrigation advice right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Smart Irrigation & <span className="gradient-text">Water Scheduler</span>
          </h1>
          <p className="page-subtitle">
            Rule-based irrigation guidance from crop moisture ranges and the field conditions you provide.
          </p>
        </div>
      </div>

      <div className="grid-split-2-1">
        {/* Left Inputs */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div className="card-title-bar">
            <div className="card-title">
              <Droplets size={20} style={{ color: '#38bdf8' }} />
              Field Hydrology Inputs
            </div>
            <span className="badge badge-info">{activeFarm?.farmName || 'Select a farm'}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Weather city</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                className="form-input"
                value={weatherLocation}
                onChange={(e) => setWeatherLocation(e.target.value)}
                aria-label="Weather city"
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={weatherLoading}
                onClick={() => fetchWeather(weatherLocation)}
              >
                {weatherLoading ? 'Fetching...' : 'Fetch Weather'}
              </button>
            </div>
            {weatherResultLocation && (
              <small style={{ color: 'var(--text-muted)' }}>
                Weather for {weatherResultLocation}
              </small>
            )}
          </div>

          <form onSubmit={handleCalculate}>
            <div
              role={weatherStatus.type === 'unavailable' ? 'alert' : 'status'}
              style={{
                color: weatherStatus.type === 'success' ? '#34d399' : weatherStatus.type === 'unavailable' ? '#fbbf24' : 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              {weatherStatus.message}
            </div>
            <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Crop Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={inputs.crop}
                  onChange={(e) => setInputs({ ...inputs, crop: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Growth Stage</label>
                <select
                  className="form-select"
                  value={inputs.growthStage}
                  onChange={(e) => setInputs({ ...inputs, growthStage: e.target.value })}
                >
                  <option value="">Select stage (optional)</option>
                  <option value="germination">Germination & Emergence</option>
                  <option value="vegetative">Vegetative Growth</option>
                  <option value="flowering">Flowering & Squaring (Critical)</option>
                  <option value="fruiting">Boll / Fruit Formation</option>
                  <option value="maturity">Ripening & Maturity</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Soil Type</label>
                <select
                  className="form-select"
                  value={inputs.soilType}
                  onChange={(e) => setInputs({ ...inputs, soilType: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="black">Black Soil (High Water Retention)</option>
                  <option value="alluvial">Alluvial (Moderate Retention)</option>
                  <option value="red">Red Soil (Fast Drainage)</option>
                  <option value="sandy">Sandy Loam (Low Retention)</option>
                  <option value="laterite">Laterite</option>
                  <option value="clay">Clay</option>
                  <option value="loamy">Loamy</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Irrigation Method</label>
                <select
                  className="form-select"
                  value={inputs.irrigationMethod}
                  onChange={(e) => setInputs({ ...inputs, irrigationMethod: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="drip">Drip Irrigation (90% Efficiency)</option>
                  <option value="sprinkler">Sprinkler System (75% Efficiency)</option>
                  <option value="flood">Flood / Furrow (50% Efficiency)</option>
                  <option value="rainfed">Rainfed</option>
                  <option value="canal">Canal</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Current Moisture (%)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="100"
                  step="any"
                  required
                  value={inputs.soilMoisture}
                  onChange={(e) => setInputs({ ...inputs, soilMoisture: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Air Temp (°C)</label>
                <input
                  type="number"
                  className="form-input"
                  min="-50"
                  max="60"
                  step="any"
                  value={inputs.temperature}
                  onChange={(e) => handleWeatherInputChange('temperature', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Humidity (%) — optional</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="100"
                  step="any"
                  value={inputs.humidity}
                  onChange={(e) => handleWeatherInputChange('humidity', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rain Forecast (mm) — optional</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="any"
                value={inputs.rainfall}
                onChange={(e) => setInputs({ ...inputs, rainfall: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)' }}>
                Enter a measured forecast value if available. The existing rule treats values above 20 mm as significant.
              </small>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              <Sparkles size={16} />
              {loading ? 'Calculating rule-based advice...' : 'Calculate Irrigation Schedule'}
            </button>
          </form>
        </div>

        {/* Right Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error ? (
            <div className="glass-panel" role="alert" style={{ padding: '1.5rem', color: '#f87171' }}>
              <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              {error}
            </div>
          ) : loading ? (
            <div className="glass-panel" role="status" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
              Calculating rule-based irrigation guidance...
            </div>
          ) : !advice ? (
            <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
              Enter crop and a measured soil-moisture value, then calculate advice.
            </div>
          ) : (
            <>
              <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Irrigation Requirement
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: advice.irrigationRequired ? '#fbbf24' : '#34d399', fontFamily: 'var(--font-heading)' }}>
                  {advice.irrigationRequired ? 'Irrigation indicated' : 'Not currently indicated'}
                </div>
                <span className={`badge ${advice.priority === 'high' ? 'badge-danger' : advice.priority === 'medium' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.8rem' }}>
                  Priority: {advice.priority}
                </span>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  Current moisture: {advice.currentMoisture}%
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Crop moisture range: {advice.optimalRange[0]}-{advice.optimalRange[1]}% (critical below {advice.criticalLevel}%)
                </div>
                <span className="badge badge-info" style={{ marginTop: '0.75rem' }}>
                  Rule-based recommendation
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    WHY THIS ADVICE
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {advice.reasons.map((reason, idx) => (
                      <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {advice.recommendations.length > 0 && (
                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      GENERAL WATER-SAVING GUIDANCE
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {advice.recommendations.map((recommendation, idx) => (
                        <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <ShieldCheck size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Assumptions: {advice.assumptions.join(' ')}
                </div>
                <div role="note" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {advice.disclaimer}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartIrrigation;

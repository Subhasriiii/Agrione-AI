import { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { advisoryApi } from '../api/advisoryApi';
import {
  TrendingUp,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const YieldAndRisk = () => {
  const { activeFarm } = useFarm();
  const [activeSubTab, setActiveSubTab] = useState('yield'); // 'yield' | 'risk'

  // Risk inputs & output
  const [riskInputs, setRiskInputs] = useState({
    cropName: activeFarm?.primaryCrop || 'Cotton',
    weatherRisk: 35,
    pestRisk: 42,
    marketPriceVolatility: 30,
    soilHealthScore: 84,
    irrigationAdequacy: 80,
  });

  const [riskResult, setRiskResult] = useState({
    overallRiskScore: 38,
    riskCategory: 'Low-to-Moderate Risk',
    breakdown: [
      { factor: 'Weather Risk', score: 35, color: '#38bdf8' },
      { factor: 'Pest Outbreak Risk', score: 42, color: '#f59e0b' },
      { factor: 'Market Volatility', score: 30, color: '#a855f7' },
      { factor: 'Water Stress Risk', score: 25, color: '#10b981' },
      { factor: 'Soil Nutrient Lag', score: 20, color: '#34d399' },
    ],
    mitigationStrategies: [
      'Enroll in Pradhan Mantri Fasal Bima Yojana (PMFBY) to hedge against unseasonal rainfall.',
      'Deploy yellow sticky traps and pheromone traps at 5 traps/acre for early pest surveillance.',
      'Stagger crop harvest marketing across 3 tranches to average out mandi price fluctuations.',
    ],
  });

  const handleAssessRisk = async (e) => {
    e.preventDefault();
    try {
      const res = await advisoryApi.assessRisk(riskInputs);
      if (res?.risk) {
        setRiskResult(res.risk);
      }
    } catch (e) {
      console.warn('Risk baseline assessment used');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Harvest Yield & <span className="gradient-text">Risk Intelligence</span>
          </h1>
          <p className="page-subtitle">
            Rule-based yield estimates combined with multi-dimensional agro-climatic & market risk scoring.
          </p>
        </div>

        <div className="tab-container">
          <button
            onClick={() => setActiveSubTab('yield')}
            className={`tab-btn ${activeSubTab === 'yield' ? 'active' : ''}`}
          >
            <TrendingUp size={15} />
            Yield Forecast
          </button>
          <button
            onClick={() => setActiveSubTab('risk')}
            className={`tab-btn ${activeSubTab === 'risk' ? 'active' : ''}`}
          >
            <ShieldAlert size={15} />
            Multi-factor Risk Radar
          </button>
        </div>
      </div>

      {activeSubTab === 'yield' ? (
        <YieldEstimator key={activeFarm?._id || 'no-active-farm'} activeFarm={activeFarm} />
      ) : (
        /* Risk Assessment Tab */
        <div className="grid-split-2-1">
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div className="card-title-bar">
              <div className="card-title">
                <ShieldAlert size={20} style={{ color: '#f59e0b' }} />
                Vulnerability Variables
              </div>
            </div>

            <form onSubmit={handleAssessRisk}>
              <div className="form-group">
                <label className="form-label">Weather Volatility Risk ({riskInputs.weatherRisk}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  style={{ width: '100%', accentColor: '#10b981' }}
                  value={riskInputs.weatherRisk}
                  onChange={(e) => setRiskInputs({ ...riskInputs, weatherRisk: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pest & Disease Pressure ({riskInputs.pestRisk}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                  value={riskInputs.pestRisk}
                  onChange={(e) => setRiskInputs({ ...riskInputs, pestRisk: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Market Price Volatility ({riskInputs.marketPriceVolatility}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  style={{ width: '100%', accentColor: '#a855f7' }}
                  value={riskInputs.marketPriceVolatility}
                  onChange={(e) => setRiskInputs({ ...riskInputs, marketPriceVolatility: Number(e.target.value) })}
                />
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '1rem' }}>
                <Sparkles size={16} />
                Recalculate Composite Risk
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Composite Farm Risk Score
              </div>
              <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                {riskResult.overallRiskScore}
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <span className="badge badge-success">{riskResult.riskCategory}</span>
            </div>

            {/* Breakdown Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                RISK FACTOR BREAKDOWN
              </div>
              <div style={{ height: 180, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskResult.breakdown} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
                    <YAxis dataKey="factor" type="category" stroke="#64748b" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d171b', borderRadius: 8 }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {riskResult.breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getYieldInputs = (farm) => {
  const recordedSoilValue = (value) => (
    Number.isFinite(value) && value > 0 ? String(value) : ''
  );

  return {
    crop: farm?.currentCrop || '',
    farmArea: Number.isFinite(farm?.area) && farm.area > 0 ? String(farm.area) : '',
    nitrogen: recordedSoilValue(farm?.soilData?.nitrogen),
    phosphorus: recordedSoilValue(farm?.soilData?.phosphorus),
    potassium: recordedSoilValue(farm?.soilData?.potassium),
    rainfall: '',
    irrigationType: farm?.irrigationType || '',
  };
};

const YieldEstimator = ({ activeFarm }) => {
  const [inputs, setInputs] = useState(() => getYieldInputs(activeFarm));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateInput = (field, value) => {
    setInputs((previous) => ({ ...previous, [field]: value }));
    setResult(null);
    setError('');
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    const crop = inputs.crop.trim();
    const farmArea = Number(inputs.farmArea);
    if (!crop) {
      setResult(null);
      setError('Enter a supported crop.');
      return;
    }
    if (inputs.farmArea === '' || !Number.isFinite(farmArea) || farmArea <= 0 || farmArea > 1000000) {
      setResult(null);
      setError('Enter a farm area greater than 0 and no greater than 1,000,000 acres.');
      return;
    }

    const numericRanges = [
      { field: 'nitrogen', label: 'Nitrogen', min: 0, max: 300 },
      { field: 'phosphorus', label: 'Phosphorus', min: 0, max: 200 },
      { field: 'potassium', label: 'Potassium', min: 0, max: 300 },
      { field: 'rainfall', label: 'Seasonal rainfall', min: 0, max: 10000 },
    ];
    for (const { field, label, min, max } of numericRanges) {
      const value = inputs[field];
      if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max)) {
        setResult(null);
        setError(`${label} must be a number between ${min} and ${max}.`);
        return;
      }
    }

    const payload = {
      farmId: activeFarm?._id,
      crop: crop.toLowerCase(),
      farmArea,
      irrigationType: inputs.irrigationType || undefined,
    };
    for (const { field } of numericRanges) {
      if (inputs[field] !== '') payload[field] = Number(inputs[field]);
    }

    setLoading(true);
    setResult(null);
    setError('');
    try {
      const response = await advisoryApi.predictYield(payload);
      const prediction = response?.prediction;
      if (
        response?.success
        && prediction
        && Number.isFinite(prediction.predictedYieldPerAcre)
        && Number.isFinite(prediction.totalExpectedYield)
        && typeof prediction.unit === 'string'
        && Array.isArray(prediction.factors)
        && prediction.modelStatus === 'rule_based'
      ) {
        setResult(prediction);
      } else {
        setError(response?.message || 'Yield estimate could not be calculated.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to calculate a yield estimate right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-split-2-1">
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div className="card-title-bar">
          <div className="card-title">
            <TrendingUp size={20} style={{ color: '#10b981' }} />
            Yield Estimate Parameters
          </div>
          <span className="badge badge-success">{activeFarm?.farmName || 'No active farm'}</span>
        </div>

        <form onSubmit={handleCalculate} noValidate>
          <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Crop Name</label>
              <input
                type="text"
                className="form-input"
                value={inputs.crop}
                onChange={(e) => updateInput('crop', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cultivated Area (Acres)</label>
              <input
                type="number"
                min="0"
                max="1000000"
                step="any"
                className="form-input"
                value={inputs.farmArea}
                onChange={(e) => updateInput('farmArea', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: 0, gap: '1rem' }}>
            {[
              { field: 'nitrogen', label: 'Nitrogen (kg/ha)', max: 300 },
              { field: 'phosphorus', label: 'Phosphorus (kg/ha)', max: 200 },
              { field: 'potassium', label: 'Potassium (kg/ha)', max: 300 },
            ].map(({ field, label, max }) => (
              <div className="form-group" key={field}>
                <label className="form-label">{label} — optional</label>
                <input
                  type="number"
                  min="0"
                  max={max}
                  step="any"
                  className="form-input"
                  value={inputs[field]}
                  onChange={(e) => updateInput(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <small style={{ color: 'var(--text-muted)' }}>
            This form's rules use nitrogen, rainfall, and irrigation type when provided. Phosphorus and potassium are recorded but not currently used in the calculation.
          </small>

          <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Seasonal Rainfall (mm) — optional</label>
              <input
                type="number"
                min="0"
                max="10000"
                step="any"
                className="form-input"
                value={inputs.rainfall}
                onChange={(e) => updateInput('rainfall', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Irrigation Type — optional</label>
              <select
                className="form-select"
                value={inputs.irrigationType}
                onChange={(e) => updateInput('irrigationType', e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="rainfed">Rainfed</option>
                <option value="drip">Drip</option>
                <option value="sprinkler">Sprinkler</option>
                <option value="flood">Flood / Furrow</option>
                <option value="canal">Canal</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            <Sparkles size={16} />
            {loading ? 'Calculating estimate...' : 'Calculate Yield Estimate'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error ? (
          <div className="glass-panel" role="alert" style={{ padding: '1.5rem', color: '#f87171' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {error}
          </div>
        ) : loading ? (
          <div className="glass-panel" role="status" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
            Calculating rule-based yield estimate...
          </div>
        ) : !result ? (
          <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
            Enter a supported crop and farm area to calculate an estimate.
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
              <span className="badge badge-warning">Rule-based estimate — not ML</span>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                {result.crop} — Estimated yield per acre
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>
                {result.predictedYieldPerAcre}
                <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}> {result.unit} / acre</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Total estimated production:{' '}
                <span style={{ color: '#fbbf24', fontSize: '1.2rem' }}>
                  {result.totalExpectedYield} {result.unit}
                </span>{' '}
                ({result.farmArea} acres)
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                FACTORS USED
              </div>
              {result.factors.length > 0 ? (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {result.factors.map((factor, index) => (
                    <li key={`${factor.factor}-${index}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong>{factor.factor} ({factor.impact}):</strong> {factor.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  No optional adjustment factors were supplied.
                </div>
              )}
              <div role="note" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                {result.disclaimer}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default YieldAndRisk;

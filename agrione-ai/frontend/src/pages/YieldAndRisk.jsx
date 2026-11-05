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
        <RiskAssessment key={activeFarm?._id || 'no-active-farm'} activeFarm={activeFarm} />
      )}
    </div>
  );
};

const getRecordedSoilValue = (farm, field) => {
  const value = farm?.soilData?.[field];
  const provenance = farm?.soilData?.measurementProvenance?.[field];
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    provenance?.source === 'farmer-entered' &&
    Boolean(provenance.recordedAt) &&
    Number.isFinite(Date.parse(provenance.recordedAt))
    ? String(value)
    : '';
};

const getInitialRiskInputs = (farm) => ({
  temperature: '',
  humidity: '',
  rainfall: '',
  soilMoisture: getRecordedSoilValue(farm, 'moisture'),
  pH: getRecordedSoilValue(farm, 'pH'),
  nitrogen: getRecordedSoilValue(farm, 'nitrogen'),
  phosphorus: getRecordedSoilValue(farm, 'phosphorus'),
  potassium: getRecordedSoilValue(farm, 'potassium'),
  irrigationType: farm?.irrigationType || '',
  diseaseRisk: '',
});

const riskNumericFields = [
  { field: 'temperature', label: 'Temperature (°C)', min: -50, max: 60, required: true },
  { field: 'humidity', label: 'Humidity (%)', min: 0, max: 100, required: true },
  { field: 'rainfall', label: 'Rainfall (mm)', min: 0, max: 10000, required: true },
  { field: 'soilMoisture', label: 'Soil moisture (%)', min: 0, max: 100 },
  { field: 'pH', label: 'Soil pH', min: 0, max: 14 },
  { field: 'nitrogen', label: 'Nitrogen (kg/ha)', min: 0, max: 300 },
  { field: 'phosphorus', label: 'Phosphorus (kg/ha)', min: 0, max: 200 },
  { field: 'potassium', label: 'Potassium (kg/ha)', min: 0, max: 300 },
];

const isRiskSectionValid = (section, includesFactors) => (
  section &&
  typeof section === 'object' &&
  Number.isFinite(section.score) &&
  section.score >= 0 &&
  section.score <= 100 &&
  ['LOW', 'MEDIUM', 'HIGH'].includes(section.level) &&
  (!includesFactors || (
    Array.isArray(section.factors) &&
    section.factors.every((factor) => typeof factor === 'string')
  ))
);

const isValidRiskResult = (risk) => (
  risk &&
  isRiskSectionValid(risk.overall, false) &&
  ['weather', 'soil', 'disease', 'water', 'yield'].every((key) =>
    isRiskSectionValid(risk[key], true)
  ) &&
  (risk.mitigationStrategies === undefined || (
    Array.isArray(risk.mitigationStrategies) &&
    risk.mitigationStrategies.every((suggestion) => typeof suggestion === 'string')
  ))
);

const RiskAssessment = ({ activeFarm }) => {
  const [riskInputs, setRiskInputs] = useState(() => getInitialRiskInputs(activeFarm));
  const [riskResult, setRiskResult] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState('');

  const updateRiskInput = (field, value) => {
    setRiskInputs((previous) => ({ ...previous, [field]: value }));
    setRiskResult(null);
    setRiskError('');
  };

  const handleAssessRisk = async (event) => {
    event.preventDefault();
    const requiredFields = riskNumericFields.filter(({ required }) => required);
    for (const { field, label, min, max } of requiredFields) {
      const value = riskInputs[field];
      if (value === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
        setRiskResult(null);
        setRiskError(`${label} is required and must be between ${min} and ${max}.`);
        return;
      }
    }

    const payload = {};
    for (const { field, min, max } of riskNumericFields) {
      const rawValue = riskInputs[field];
      if (rawValue === '') continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < min || value > max) {
        setRiskResult(null);
        setRiskError(`${field} must be a number between ${min} and ${max}.`);
        return;
      }
      payload[field] = value;
    }
    if (riskInputs.irrigationType) payload.irrigationType = riskInputs.irrigationType;
    if (riskInputs.diseaseRisk) payload.diseaseRisk = riskInputs.diseaseRisk;

    setRiskLoading(true);
    setRiskResult(null);
    setRiskError('');
    try {
      const response = await advisoryApi.assessRisk(payload);
      if (response?.success !== true || !isValidRiskResult(response.risk)) {
        throw new Error(response?.message || 'Risk assessment returned an invalid response.');
      }
      setRiskResult(response.risk);
    } catch (error) {
      setRiskError(error.message || 'Unable to assess farm risk right now.');
    } finally {
      setRiskLoading(false);
    }
  };

  const chartData = riskResult ? [
    { factor: 'Weather', score: riskResult.weather.score, color: '#38bdf8' },
    { factor: 'Soil', score: riskResult.soil.score, color: '#34d399' },
    { factor: 'Disease', score: riskResult.disease.score, color: '#f59e0b' },
    { factor: 'Water', score: riskResult.water.score, color: '#10b981' },
    { factor: 'Yield', score: riskResult.yield.score, color: '#a855f7' },
  ] : [];

  return (
    <div className="grid-split-2-1">
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div className="card-title-bar">
          <div className="card-title">
            <ShieldAlert size={20} style={{ color: '#f59e0b' }} />
            Risk Assessment Inputs
          </div>
        </div>

        <form onSubmit={handleAssessRisk} noValidate>
          <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
            {riskNumericFields.map(({ field, label, min, max, required }) => (
              <div className="form-group" key={field}>
                <label className="form-label" htmlFor={`risk-${field}`}>
                  {label}{required ? ' — required' : ' — optional'}
                </label>
                <input
                  id={`risk-${field}`}
                  type="number"
                  className="form-input"
                  min={min}
                  max={max}
                  step="any"
                  required={required}
                  value={riskInputs[field]}
                  disabled={riskLoading}
                  onChange={(event) => updateRiskInput(field, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="risk-irrigation">Irrigation type — optional</label>
              <select
                id="risk-irrigation"
                className="form-select"
                value={riskInputs.irrigationType}
                disabled={riskLoading}
                onChange={(event) => updateRiskInput('irrigationType', event.target.value)}
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
            <div className="form-group">
              <label className="form-label" htmlFor="risk-disease">Previously identified disease risk — optional</label>
              <select
                id="risk-disease"
                className="form-select"
                value={riskInputs.diseaseRisk}
                disabled={riskLoading}
                onChange={(event) => updateRiskInput('diseaseRisk', event.target.value)}
              >
                <option value="">Not specified</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <small style={{ color: 'var(--text-muted)' }}>
            Temperature, humidity and rainfall are required. Optional soil values are prefilled only when their farmer-entered provenance is valid.
          </small>
          <button type="submit" disabled={riskLoading} className="btn btn-accent" style={{ width: '100%', marginTop: '1rem' }}>
            <Sparkles size={16} />
            {riskLoading ? 'Assessing risk...' : 'Assess Farm Risk'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {riskError ? (
          <div className="glass-panel" role="alert" style={{ padding: '1.5rem', color: '#f87171' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {riskError}
          </div>
        ) : riskLoading ? (
          <div className="glass-panel" role="status" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
            Calculating risk assessment...
          </div>
        ) : !riskResult ? (
          <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
            Enter current weather conditions and assess risk to see results.
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
              <span className="badge badge-success">Assessment complete</span>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Composite Farm Risk Score
              </div>
              <div style={{ fontSize: '3.2rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                {riskResult.overall.score}
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <span className={`badge ${riskResult.overall.level === 'HIGH' ? 'badge-danger' : riskResult.overall.level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                {riskResult.overall.level} RISK
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                RISK FACTOR BREAKDOWN
              </div>
              <div style={{ height: 180, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
                    <YAxis dataKey="factor" type="category" stroke="#64748b" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d171b', borderRadius: 8 }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry) => <Cell key={entry.factor} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {Array.isArray(riskResult.mitigationStrategies) && riskResult.mitigationStrategies.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3>Mitigation suggestions</h3>
                <ul>
                  {riskResult.mitigationStrategies.map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const getYieldInputs = (farm) => {
  return {
    crop: farm?.currentCrop || '',
    farmArea: Number.isFinite(farm?.area) && farm.area > 0 ? String(farm.area) : '',
    nitrogen: getRecordedSoilValue(farm, 'nitrogen'),
    phosphorus: getRecordedSoilValue(farm, 'phosphorus'),
    potassium: getRecordedSoilValue(farm, 'potassium'),
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

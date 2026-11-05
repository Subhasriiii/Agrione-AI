import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import {
  Sliders,
  AlertTriangle,
  RefreshCw,
  CloudRain,
  Thermometer,
  Layers,
  Bug,
} from 'lucide-react';

const getFarmScenarioDetails = (farm) => ({
  baseCrop: farm?.currentCrop || '',
  baseArea: Number.isFinite(farm?.area) && farm.area > 0 ? farm.area : '',
});

const getScenarioPrecautions = (scenario) => {
  const precautions = [];

  if (scenario.rainfallChangePercent < 0) {
    precautions.push('This scenario assumes rainfall below its reference level. Check local forecasts and actual soil moisture before making water-management decisions.');
  } else if (scenario.rainfallChangePercent > 0) {
    precautions.push('This scenario assumes rainfall above its reference level. Monitor local rainfall and field drainage for waterlogging conditions.');
  }

  if (scenario.temperatureChangeC > 0) {
    precautions.push('This scenario assumes higher temperatures. Monitor crop and weather conditions, and consult local agricultural guidance before taking action.');
  }

  if (scenario.fertilizerBudgetChangePercent !== 0) {
    precautions.push(`This scenario changes the fertilizer budget by ${scenario.fertilizerBudgetChangePercent}%; a budget change does not determine a safe application rate. Base any input decisions on soil-test results and local crop guidance.`);
  }

  if (scenario.pestOutbreak !== 'none') {
    precautions.push(`This scenario assumes ${scenario.pestOutbreak} pest pressure; it is not a diagnosis. Inspect the crop and seek local expert guidance before considering any treatment.`);
  }

  return precautions;
};

const WhatIfSimulation = () => {
  const { activeFarm } = useFarm();
  const [simInputs, setSimInputs] = useState({
    rainfallChangePercent: 0,
    temperatureChangeC: 0,
    fertilizerBudgetChangePercent: 0,
    pestOutbreak: 'none',
  });
  const farmDetails = getFarmScenarioDetails(activeFarm);

  const hasScenarioChanges = simInputs.rainfallChangePercent !== 0 ||
    simInputs.temperatureChangeC !== 0 ||
    simInputs.fertilizerBudgetChangePercent !== 0 ||
    simInputs.pestOutbreak !== 'none';
  const hasFarmScenarioDetails = Boolean(farmDetails.baseCrop) &&
    Number.isFinite(farmDetails.baseArea) &&
    farmDetails.baseArea > 0;
  const precautions = hasScenarioChanges ? getScenarioPrecautions(simInputs) : [];

  const resetScenario = () => {
    setSimInputs({
      rainfallChangePercent: 0,
      temperatureChangeC: 0,
      fertilizerBudgetChangePercent: 0,
      pestOutbreak: 'none',
    });
  };

  const updateScenario = (field, value) => {
    setSimInputs((previous) => ({ ...previous, [field]: value }));
  };

  if (!activeFarm) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-group">
            <h1>
              What-If Scenario <span className="gradient-text">Farm Simulator</span>
            </h1>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h2>No active farm selected</h2>
          <p>Select or create a farm before reviewing its scenario conditions.</p>
          <Link to="/farms" className="btn btn-primary">Go to My Farms</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            What-If Scenario <span className="gradient-text">Farm Simulator</span>
          </h1>
          <p className="page-subtitle">
            Review qualitative scenario conditions. The controls do not generate yield or financial predictions.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <strong>Selected farm:</strong> {activeFarm.farmName || 'Unnamed farm'}
        <span> · Crop: {farmDetails.baseCrop || 'Not set'}</span>
        <span> · Area: {farmDetails.baseArea || 'Not set'}{farmDetails.baseArea ? ' acres' : ''}</span>
        {!hasFarmScenarioDetails && (
          <div className="alert" role="status" style={{ marginTop: '0.75rem' }}>
            Set the farm’s current crop and a positive acreage in My Farms to contextualize this scenario.
            <Link to="/farms" className="btn btn-secondary btn-sm" style={{ marginLeft: '0.75rem' }}>Manage farm</Link>
          </div>
        )}
      </div>

      <div className="grid-split-2-1">
        {/* Sliders Card */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div className="card-title-bar">
            <div className="card-title">
              <Sliders size={20} style={{ color: '#38bdf8' }} />
              Stress Test Controls
            </div>
            <button
              type="button"
              onClick={resetScenario}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              <RefreshCw size={12} /> Reset to Baseline
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Rainfall Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <CloudRain size={16} style={{ color: '#38bdf8' }} /> Monsoon Rainfall Anomaly
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: simInputs.rainfallChangePercent >= 0 ? '#34d399' : '#f87171',
                  }}
                >
                  {simInputs.rainfallChangePercent > 0 ? `+${simInputs.rainfallChangePercent}` : simInputs.rainfallChangePercent}%
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                style={{ width: '100%', accentColor: '#38bdf8' }}
                value={simInputs.rainfallChangePercent}
                onChange={(e) => updateScenario('rainfallChangePercent', Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>-50% (Drought)</span>
                <span>Normal (0%)</span>
                <span>+50% (Heavy Deluge)</span>
              </div>
            </div>

            {/* Temperature Rise */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <Thermometer size={16} style={{ color: '#f59e0b' }} /> Heat Wave Temperature Spike
                </span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                  +{simInputs.temperatureChangeC}°C
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                style={{ width: '100%', accentColor: '#f59e0b' }}
                value={simInputs.temperatureChangeC}
                onChange={(e) => updateScenario('temperatureChangeC', Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>0°C (Seasonal Avg)</span>
                <span>+2.5°C (Warm Spell)</span>
                <span>+5.0°C (Severe Heatwave)</span>
              </div>
            </div>

            {/* Fertilizer Budget Change */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  <Layers size={16} style={{ color: '#10b981' }} /> Fertilizer Budget Scenario Change
                </span>
                <span style={{ fontWeight: 700, color: simInputs.fertilizerBudgetChangePercent >= 0 ? '#34d399' : '#f87171' }}>
                  {simInputs.fertilizerBudgetChangePercent > 0 ? `+${simInputs.fertilizerBudgetChangePercent}` : simInputs.fertilizerBudgetChangePercent}%
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="5"
                style={{ width: '100%', accentColor: '#10b981' }}
                value={simInputs.fertilizerBudgetChangePercent}
                onChange={(e) => updateScenario('fertilizerBudgetChangePercent', Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>-30% (Under-fertilized)</span>
                <span>Baseline (0%)</span>
                <span>+30% (Intensive Dosing)</span>
              </div>
            </div>

            {/* Pest Outbreak Severity */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bug size={16} style={{ color: '#f87171' }} /> Pest / Sucking Insect Infestation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {['none', 'low', 'moderate', 'severe'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => updateScenario('pestOutbreak', lvl)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor:
                        simInputs.pestOutbreak === lvl
                          ? 'var(--primary)'
                          : 'var(--border-subtle)',
                      background:
                        simInputs.pestOutbreak === lvl
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(255, 255, 255, 0.02)',
                      color:
                        simInputs.pestOutbreak === lvl
                          ? 'var(--primary-light)'
                          : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Qualitative scenario assessment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              QUALITATIVE SCENARIO ASSESSMENT
            </div>
            <span className="badge badge-info">Qualitative only · not a trained ML prediction</span>
            {!hasFarmScenarioDetails ? (
              <p role="status" style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                Scenario conditions are set, but a farm crop and acreage are needed before this assessment can be contextualized.
              </p>
            ) : !hasScenarioChanges ? (
              <p role="status" style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                Neutral scenario selected. Adjust a control to review relevant considerations.
              </p>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>
                  For {farmDetails.baseCrop} on {farmDetails.baseArea} acres, these are scenario assumptions only. No yield, risk score, revenue, profit, or margin is predicted.
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0 }}>
                  {precautions.map((precaution) => (
                    <li key={precaution} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                      <AlertTriangle size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                      <span>{precaution}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                  Check actual field conditions and local agricultural guidance before taking action. This page does not determine treatment rates or insurance eligibility.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulation;

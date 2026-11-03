import React, { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { simulationApi } from '../api/simulationApi';
import {
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  CloudRain,
  Thermometer,
  Layers,
  Bug,
} from 'lucide-react';

const WhatIfSimulation = () => {
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(false);

  const [simInputs, setSimInputs] = useState({
    baseCrop: activeFarm?.primaryCrop || 'Cotton',
    baseArea: activeFarm?.totalArea || 5.5,
    rainfallChangePercent: -20, // -50% to +50%
    temperatureChangeC: 2.0, // 0 to 5
    fertilizerBudgetChangePercent: 0, // -30% to +30%
    pestOutbreak: 'low', // 'none' | 'low' | 'moderate' | 'severe'
  });

  // Calculate dynamic simulation outcome
  const calculateSimOutcome = () => {
    let yieldChange = 0;
    // Rainfall effect
    if (simInputs.rainfallChangePercent < 0) {
      yieldChange += simInputs.rainfallChangePercent * 0.45; // drought drops yield
    } else {
      yieldChange += Math.min(10, simInputs.rainfallChangePercent * 0.2); // moderate rain helps, excess hurts
      if (simInputs.rainfallChangePercent > 30) yieldChange -= (simInputs.rainfallChangePercent - 30) * 0.3;
    }
    // Temp effect
    yieldChange -= simInputs.temperatureChangeC * 4.2;
    // Fertilizer effect
    if (simInputs.fertilizerBudgetChangePercent < 0) {
      yieldChange += simInputs.fertilizerBudgetChangePercent * 0.35;
    } else {
      yieldChange += simInputs.fertilizerBudgetChangePercent * 0.2;
    }
    // Pest effect
    if (simInputs.pestOutbreak === 'low') yieldChange -= 6;
    if (simInputs.pestOutbreak === 'moderate') yieldChange -= 18;
    if (simInputs.pestOutbreak === 'severe') yieldChange -= 35;

    yieldChange = Math.round(yieldChange);

    const baseProfit = 185000;
    const simulatedProfit = Math.round(baseProfit * (1 + yieldChange / 100));
    const profitDelta = simulatedProfit - baseProfit;

    let riskLevel = 'Low';
    if (yieldChange <= -10 && yieldChange > -25) riskLevel = 'Moderate';
    else if (yieldChange <= -25 && yieldChange > -40) riskLevel = 'High';
    else if (yieldChange <= -40) riskLevel = 'Severe Vulnerability';

    return {
      yieldChange,
      simulatedProfit,
      profitDelta,
      riskLevel,
    };
  };

  const outcome = calculateSimOutcome();

  const handleServerSim = async () => {
    setLoading(true);
    try {
      await simulationApi.simulate(simInputs);
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            What-If Scenario <span className="gradient-text">Farm Simulator</span>
          </h1>
          <p className="page-subtitle">
            Simulate climate shocks, drought stress, fertilizer adjustments, and pest pressure to test farm resilience.
          </p>
        </div>
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
              onClick={() =>
                setSimInputs({
                  baseCrop: 'Cotton',
                  baseArea: 5.5,
                  rainfallChangePercent: 0,
                  temperatureChangeC: 0,
                  fertilizerBudgetChangePercent: 0,
                  pestOutbreak: 'none',
                })
              }
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
                onChange={(e) => setSimInputs({ ...simInputs, rainfallChangePercent: Number(e.target.value) })}
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
                onChange={(e) => setSimInputs({ ...simInputs, temperatureChangeC: Number(e.target.value) })}
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
                  <Layers size={16} style={{ color: '#10b981' }} /> Fertilizer Input Dosage Change
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
                onChange={(e) => setSimInputs({ ...simInputs, fertilizerBudgetChangePercent: Number(e.target.value) })}
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
                    onClick={() => setSimInputs({ ...simInputs, pestOutbreak: lvl })}
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

        {/* Real-time Projected Impact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Projected Harvest Impact
            </div>
            <div
              style={{
                fontSize: '3.2rem',
                fontWeight: 800,
                color: outcome.yieldChange >= 0 ? '#34d399' : '#f87171',
                fontFamily: 'var(--font-heading)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              {outcome.yieldChange >= 0 ? (
                <TrendingUp size={36} />
              ) : (
                <TrendingDown size={36} />
              )}
              {outcome.yieldChange > 0 ? `+${outcome.yieldChange}` : outcome.yieldChange}%
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              Simulated Net Margin:{' '}
              <strong style={{ color: outcome.profitDelta >= 0 ? '#34d399' : '#f87171' }}>
                ₹{outcome.simulatedProfit.toLocaleString()}
              </strong>{' '}
              ({outcome.profitDelta >= 0 ? `+₹${outcome.profitDelta.toLocaleString()}` : `-₹${Math.abs(outcome.profitDelta).toLocaleString()}`})
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span
                className={`badge ${
                  outcome.riskLevel === 'Low'
                    ? 'badge-success'
                    : outcome.riskLevel === 'Moderate'
                    ? 'badge-warning'
                    : 'badge-danger'
                }`}
              >
                {outcome.riskLevel}
              </span>
            </div>
          </div>

          {/* Actionable Contingency Recommendations */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              CONTINGENCY ADAPTATION STRATEGY
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {simInputs.rainfallChangePercent < -15 && (
                <li style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
                  <CheckCircle2 size={14} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 2 }} />
                  <span>Switch to alternate furrow irrigation; apply kaolin clay spray (3%) to reduce foliar transpiration.</span>
                </li>
              )}
              {simInputs.temperatureChangeC >= 2.0 && (
                <li style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
                  <CheckCircle2 size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                  <span>Irrigate during evening hours; spray 1% Potassium Nitrate (13-0-45) to enhance crop heat tolerance.</span>
                </li>
              )}
              {simInputs.pestOutbreak !== 'none' && (
                <li style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
                  <CheckCircle2 size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                  <span>Install solar light traps and release Trichogramma egg parasitoids @ 50,000/acre.</span>
                </li>
              )}
              <li style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.4rem' }}>
                <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                <span>Verify PMFBY crop insurance enrolment to guarantee financial downside protection.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulation;

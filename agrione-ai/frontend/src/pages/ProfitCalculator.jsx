import React, { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { simulationApi } from '../api/simulationApi';
import {
  Calculator,
  IndianRupee,
  TrendingUp,
  PieChart as PieIcon,
  Percent,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const ProfitCalculator = () => {
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(false);

  const [inputs, setInputs] = useState({
    cropName: activeFarm?.primaryCrop || 'Cotton',
    area: activeFarm?.totalArea || 5.5,
    expectedYieldPerAcre: 12,
    expectedPricePerQuintal: 6500,
    costs: {
      seeds: 3500,
      fertilizers: 6500,
      pesticides: 4000,
      labor: 14000,
      machinery: 5000,
      irrigation: 2500,
      other: 2000,
    },
  });

  const costPerAcre = Object.values(inputs.costs).reduce((acc, c) => acc + Number(c), 0);
  const totalCost = costPerAcre * inputs.area;
  const totalProduction = inputs.expectedYieldPerAcre * inputs.area;
  const grossRevenue = totalProduction * inputs.expectedPricePerQuintal;
  const netProfit = grossRevenue - totalCost;
  const profitPerAcre = netProfit / inputs.area;
  const roi = ((netProfit / totalCost) * 100).toFixed(1);
  const breakEvenYield = (costPerAcre / inputs.expectedPricePerQuintal).toFixed(2);
  const breakEvenPrice = Math.round(costPerAcre / inputs.expectedYieldPerAcre);

  const expenseData = [
    { name: 'Labor & Weeding', value: inputs.costs.labor, color: '#10b981' },
    { name: 'Fertilizers & Nutrients', value: inputs.costs.fertilizers, color: '#38bdf8' },
    { name: 'Machinery & Diesel', value: inputs.costs.machinery, color: '#f59e0b' },
    { name: 'Pesticides / Plant Protection', value: inputs.costs.pesticides, color: '#ef4444' },
    { name: 'Certified Seeds', value: inputs.costs.seeds, color: '#a855f7' },
    { name: 'Irrigation Power', value: inputs.costs.irrigation, color: '#34d399' },
    { name: 'Overheads & Transport', value: inputs.costs.other, color: '#64748b' },
  ];

  const handleCostChange = (key, val) => {
    setInputs((prev) => ({
      ...prev,
      costs: {
        ...prev.costs,
        [key]: Number(val),
      },
    }));
  };

  const handleCalculateServer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await simulationApi.calculateProfit({
        cropName: inputs.cropName,
        area: inputs.area,
        expectedYieldPerAcre: inputs.expectedYieldPerAcre,
        expectedPricePerQuintal: inputs.expectedPricePerQuintal,
        costs: inputs.costs,
      });
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Farm Economics & <span className="gradient-text">Profit Calculator</span>
          </h1>
          <p className="page-subtitle">
            Accurate cost of cultivation modeling, break-even price analysis, and projected net profit per acre.
          </p>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid-4">
        <div className="glass-panel stat-card">
          <span className="stat-label">Net Projected Profit</span>
          <div className="stat-val" style={{ color: '#34d399' }}>
            ₹{Math.max(0, Math.round(netProfit)).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            For total {inputs.area} Acres
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Net Profit / Acre</span>
          <div className="stat-val" style={{ color: '#38bdf8' }}>
            ₹{Math.max(0, Math.round(profitPerAcre)).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cost: ₹{costPerAcre.toLocaleString()}/acre
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Return on Investment</span>
          <div className="stat-val" style={{ color: '#fbbf24' }}>
            {roi}%
          </div>
          <span className="badge badge-success" style={{ width: 'fit-content' }}>
            Healthy ROI
          </span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Break-Even Mandi Price</span>
          <div className="stat-val" style={{ color: '#a855f7' }}>
            ₹{breakEvenPrice.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            per quintal (cost recovery point)
          </div>
        </div>
      </div>

      <div className="grid-split-2-1">
        {/* Left Inputs: Crop Parameters & Cost Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div className="card-title-bar">
            <div className="card-title">
              <Calculator size={20} style={{ color: '#10b981' }} />
              Production & Market Rates
            </div>
            <span className="badge badge-success">{activeFarm?.name}</span>
          </div>

          <form onSubmit={handleCalculateServer}>
            <div className="grid-3" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Crop Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={inputs.cropName}
                  onChange={(e) => setInputs({ ...inputs, cropName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Acreage</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={inputs.area}
                  onChange={(e) => setInputs({ ...inputs, area: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Exp. Yield (Qt/acre)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={inputs.expectedYieldPerAcre}
                  onChange={(e) => setInputs({ ...inputs, expectedYieldPerAcre: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">
                Expected Selling Price (₹ per Quintal)
                <span style={{ color: '#34d399', fontWeight: 600 }}>Current Mandi Benchmark: ₹6,500</span>
              </label>
              <input
                type="number"
                className="form-input"
                value={inputs.expectedPricePerQuintal}
                onChange={(e) => setInputs({ ...inputs, expectedPricePerQuintal: Number(e.target.value) })}
              />
            </div>

            <div style={{ margin: '1.5rem 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Input Cost Breakdown (₹ per Acre)
            </div>

            <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Labor & Sowing (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.labor}
                  onChange={(e) => handleCostChange('labor', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fertilizers & Manure (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.fertilizers}
                  onChange={(e) => handleCostChange('fertilizers', e.target.value)}
                />
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Seeds (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.seeds}
                  onChange={(e) => handleCostChange('seeds', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Machinery/Tractor (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.machinery}
                  onChange={(e) => handleCostChange('machinery', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Pesticides (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.pesticides}
                  onChange={(e) => handleCostChange('pesticides', e.target.value)}
                />
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Irrigation Power (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.irrigation}
                  onChange={(e) => handleCostChange('irrigation', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Other Overheads (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={inputs.costs.other}
                  onChange={(e) => handleCostChange('other', e.target.value)}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Right: Cost Allocation Visual Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div className="card-title-bar">
              <div className="card-title">
                <PieIcon size={18} style={{ color: '#38bdf8' }} />
                Cost Structure / Acre (₹{costPerAcre.toLocaleString()})
              </div>
            </div>

            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${value.toLocaleString()}`}
                    contentStyle={{ backgroundColor: '#0d171b', borderRadius: 8, borderColor: '#34d399' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              BREAK-EVEN SENSITIVITY
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              • To cover your direct costs of <strong>₹{costPerAcre.toLocaleString()}/acre</strong>, you need a minimum harvest of <strong>{breakEvenYield} Quintals/acre</strong> at ₹{inputs.expectedPricePerQuintal}/Q.
              <br />
              • At expected yield of {inputs.expectedYieldPerAcre} Q/acre, any market price above <strong>₹{breakEvenPrice}/Q</strong> directly delivers net profit.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculator;

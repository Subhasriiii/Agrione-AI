import { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import {
  Calculator,
  PieChart as PieIcon,
  AlertTriangle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COST_FIELDS = [
  { key: 'labor', label: 'Labor & Sowing (₹)' },
  { key: 'fertilizers', label: 'Fertilizers & Manure (₹)' },
  { key: 'seeds', label: 'Seeds (₹)' },
  { key: 'machinery', label: 'Machinery/Tractor (₹)' },
  { key: 'pesticides', label: 'Pesticides (₹)' },
  { key: 'irrigation', label: 'Irrigation Power (₹)' },
  { key: 'other', label: 'Other Overheads (₹)' },
];

const getCalculations = (inputs) => {
  const errors = [];
  const numericFields = [
    { key: 'area', label: 'Acreage', positive: true },
    { key: 'expectedYieldPerAcre', label: 'Expected yield per acre', positive: true },
    { key: 'expectedPricePerQuintal', label: 'Selling price', positive: true },
    ...COST_FIELDS.map(({ key, label }) => ({ key: `costs.${key}`, label, positive: false })),
  ];
  const values = {};

  for (const { key, label, positive } of numericFields) {
    const rawValue = key.startsWith('costs.')
      ? inputs.costs[key.slice('costs.'.length)]
      : inputs[key];
    if (rawValue === '') {
      errors.push(`${label} is required.`);
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
      errors.push(`${label} must be a finite ${positive ? 'positive' : 'non-negative'} number.`);
      continue;
    }
    values[key] = value;
  }

  if (errors.length > 0) return { errors, values: null };

  const costPerAcre = COST_FIELDS.reduce((sum, { key }) => sum + values[`costs.${key}`], 0);
  const totalProduction = values.expectedYieldPerAcre * values.area;
  const grossRevenue = totalProduction * values.expectedPricePerQuintal;
  const totalCost = costPerAcre * values.area;
  const netProfit = grossRevenue - totalCost;
  const calculations = {
    costPerAcre,
    totalProduction,
    grossRevenue,
    totalCost,
    netProfit,
    profitPerAcre: netProfit / values.area,
    roi: totalCost > 0 ? (netProfit / totalCost) * 100 : null,
    profitMargin: (netProfit / grossRevenue) * 100,
    breakEvenYield: costPerAcre / values.expectedPricePerQuintal,
    breakEvenPrice: costPerAcre / values.expectedYieldPerAcre,
  };

  if (Object.values(calculations).some((value) => value !== null && !Number.isFinite(value))) {
    return { errors: ['The entered values are too large to calculate safely.'], values: null };
  }
  return { errors: [], values: calculations };
};

const formatCurrency = (value) => (
  value === null ? 'N/A' : `₹${Math.round(value).toLocaleString()}`
);

const formatNumber = (value, maximumFractionDigits = 2) => (
  value === null ? 'N/A' : value.toLocaleString(undefined, { maximumFractionDigits })
);

const ProfitCalculator = () => {
  const { activeFarm } = useFarm();

  const [inputs, setInputs] = useState(() => ({
    cropName: activeFarm?.currentCrop || '',
    area: Number.isFinite(activeFarm?.area) && activeFarm.area > 0 ? String(activeFarm.area) : '',
    expectedYieldPerAcre: '',
    expectedPricePerQuintal: '',
    costs: Object.fromEntries(COST_FIELDS.map(({ key }) => [key, ''])),
  }));
  const { errors, values } = getCalculations(inputs);
  const hasProjections = values !== null;

  const expenseData = [
    { name: 'Labor & Weeding', value: Number(inputs.costs.labor) || 0, color: '#10b981' },
    { name: 'Fertilizers & Nutrients', value: Number(inputs.costs.fertilizers) || 0, color: '#38bdf8' },
    { name: 'Machinery & Diesel', value: Number(inputs.costs.machinery) || 0, color: '#f59e0b' },
    { name: 'Pesticides / Plant Protection', value: Number(inputs.costs.pesticides) || 0, color: '#ef4444' },
    { name: 'Certified Seeds', value: Number(inputs.costs.seeds) || 0, color: '#a855f7' },
    { name: 'Irrigation Power', value: Number(inputs.costs.irrigation) || 0, color: '#34d399' },
    { name: 'Overheads & Transport', value: Number(inputs.costs.other) || 0, color: '#64748b' },
  ];

  const handleCostChange = (key, val) => {
    setInputs((prev) => ({
      ...prev,
      costs: {
        ...prev.costs,
        [key]: val,
      },
    }));
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
          <div className="stat-val" style={{ color: hasProjections && values.netProfit < 0 ? '#f87171' : '#34d399' }}>
            {hasProjections ? formatCurrency(values.netProfit) : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {hasProjections
              ? `${formatNumber(values.totalProduction)} Q total · Revenue ${formatCurrency(values.grossRevenue)} · Cost ${formatCurrency(values.totalCost)}`
              : 'Complete the planning inputs to view projections'}
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Net Profit / Acre</span>
          <div className="stat-val" style={{ color: hasProjections && values.profitPerAcre < 0 ? '#f87171' : '#38bdf8' }}>
            {hasProjections ? formatCurrency(values.profitPerAcre) : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {hasProjections ? `Cost: ${formatCurrency(values.costPerAcre)}/acre` : 'Not available'}
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Return on Investment</span>
          <div className="stat-val" style={{ color: '#fbbf24' }}>
            {hasProjections && values.roi !== null ? `${formatNumber(values.roi, 1)}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ROI = profit ÷ total cost
            <br />
            Profit margin: {hasProjections ? `${formatNumber(values.profitMargin, 1)}%` : '—'}
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Break-Even</span>
          <div className="stat-val" style={{ color: '#a855f7' }}>
            {hasProjections ? `${formatCurrency(values.breakEvenPrice)}/Q` : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {hasProjections ? `${formatNumber(values.breakEvenYield)} Q/acre at entered price` : 'Price / yield needed for cost recovery'}
          </div>
        </div>
      </div>

      <div className="grid-split-2-1">
        {/* Left Inputs: Crop Parameters & Cost Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div className="card-title-bar">
            <div className="card-title">
              <Calculator size={20} style={{ color: '#10b981' }} />
              Production & Selling Price
            </div>
            <span className="badge badge-info">{activeFarm?.farmName || 'Planning assumptions'}</span>
          </div>

          <div>
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
                  min="0"
                  required
                  value={inputs.area}
                  onChange={(e) => setInputs({ ...inputs, area: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Yield (Qt/acre)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="form-input"
                  required
                  value={inputs.expectedYieldPerAcre}
                  onChange={(e) => setInputs({ ...inputs, expectedYieldPerAcre: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">
                User-Entered Selling Price (₹ per Quintal)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-input"
                required
                value={inputs.expectedPricePerQuintal}
                onChange={(e) => setInputs({ ...inputs, expectedPricePerQuintal: e.target.value })}
              />
              <small style={{ color: 'var(--text-muted)' }}>This is a planning input, not a live mandi quote.</small>
            </div>

            <div style={{ margin: '1.5rem 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Input Cost Breakdown (₹ per Acre)
            </div>

            <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
              {COST_FIELDS.map(({ key, label }) => (
                <div className="form-group" key={key}>
                  <label className="form-label" htmlFor={`profit-cost-${key}`}>{label} — per acre</label>
                  <input
                    id={`profit-cost-${key}`}
                    type="number"
                    min="0"
                    step="any"
                    className="form-input"
                    required
                    value={inputs.costs[key]}
                    onChange={(e) => handleCostChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              Editable planning assumptions. Acreage is prefilled from the active farm when available; yield, price, and costs must be entered by you.
            </div>
          </div>
        </div>

        {/* Right: Cost Allocation Visual Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errors.length > 0 && (
            <div className="glass-panel" role="alert" style={{ padding: '1.25rem', color: '#f87171' }}>
              <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              <strong>Complete or correct the planning inputs:</strong>
              <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div className="card-title-bar">
              <div className="card-title">
                <PieIcon size={18} style={{ color: '#38bdf8' }} />
                Cost Structure / Acre ({hasProjections ? formatCurrency(values.costPerAcre) : '—'})
              </div>
            </div>

            {hasProjections ? (
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
            ) : (
              <div className="dashboard-state">Enter valid inputs to view cost allocation.</div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              BREAK-EVEN SENSITIVITY
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {hasProjections ? (
                <>
                  • To cover costs of <strong>{formatCurrency(values.costPerAcre)}/acre</strong>, break-even yield is <strong>{formatNumber(values.breakEvenYield)} Quintals/acre</strong> at {formatCurrency(Number(inputs.expectedPricePerQuintal))}/Q.
                  <br />
                  • At expected yield of {formatNumber(Number(inputs.expectedYieldPerAcre))} Q/acre, break-even price is <strong>{formatCurrency(values.breakEvenPrice)}/Q</strong>.
                </>
              ) : (
                'Break-even values will appear after all required inputs are valid.'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculator;

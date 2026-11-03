import React, { useState, useEffect } from 'react';
import { schemesApi } from '../api/schemesApi';
import {
  Landmark,
  Search,
  ExternalLink,
  CheckCircle2,
  Filter,
  ShieldCheck,
  IndianRupee,
  Layers,
  Sparkles,
} from 'lucide-react';

const DEFAULT_SCHEMES = [
  {
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    description: 'Direct income support of ₹6,000 per year to farmer families, paid in three equal installments directly into bank accounts via DBT.',
    eligibility: 'All land-holding farmer families with cultivable land.',
    benefits: '₹6,000 per year in 3 installments of ₹2,000 each.',
    category: 'subsidy',
    targetFarmers: 'Small and marginal farmers',
    state: 'All India',
    applicationUrl: 'https://pmkisan.gov.in',
  },
  {
    name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
    description: 'Comprehensive crop loss insurance coverage against non-preventable natural risks from pre-sowing to post-harvest stages.',
    eligibility: 'All farmers including sharecroppers and tenant farmers growing notified crops in notified areas.',
    benefits: 'Maximum premium payable by farmer: 2% for Kharif, 1.5% for Rabi, 5% for commercial/horticultural crops.',
    category: 'insurance',
    targetFarmers: 'All farmers',
    state: 'All India',
    applicationUrl: 'https://pmfby.gov.in',
  },
  {
    name: 'Kisan Credit Card (KCC) Scheme',
    description: 'Concessional credit facility enabling farmers to meet short-term crop production, post-harvest, and farm maintenance requirements.',
    eligibility: 'Individual/joint borrowers, tenant farmers, self-help groups (SHGs).',
    benefits: 'Credit limit up to ₹3 lakh at effective 4% annual interest with prompt repayment incentive.',
    category: 'loan',
    targetFarmers: 'All farmers',
    state: 'All India',
    applicationUrl: 'https://www.pmkisan.gov.in/kcc',
  },
  {
    name: 'Micro Irrigation Fund (MIF / PMKSY)',
    description: 'Financial subsidy for adopting water-saving drip and sprinkler systems under Per Drop More Crop initiative.',
    eligibility: 'Farmers having assured source of irrigation water.',
    benefits: '55% subsidy for small and marginal farmers, 45% for other farmers.',
    category: 'equipment',
    targetFarmers: 'Small, marginal & commercial growers',
    state: 'All India',
    applicationUrl: 'https://pmksy.gov.in',
  },
  {
    name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
    description: 'Promotes certified organic farming through participatory guarantee systems (PGS) in 50-acre farmer clusters.',
    eligibility: 'Groups of 50 or more farmers forming 50-acre contiguous clusters.',
    benefits: '₹50,000 per hectare financial support for 3 years towards organic inputs and certification.',
    category: 'subsidy',
    targetFarmers: 'Organic farming groups',
    state: 'All India',
    applicationUrl: 'https://pgsindia-ncof.gov.in',
  },
  {
    name: 'Soil Health Card Scheme',
    description: 'Biennial soil sample analysis providing macro/micro nutrient status and crop-wise fertilizer dosage recommendations.',
    eligibility: 'All landholding farmers across India.',
    benefits: 'Free soil health card every 2 years with custom nutrient management advice.',
    category: 'subsidy',
    targetFarmers: 'All farmers',
    state: 'All India',
    applicationUrl: 'https://soilhealth.dac.gov.in',
  },
  {
    name: 'eNAM (National Agriculture Market)',
    description: 'Pan-India electronic trading portal networking existing APMC mandis to create a unified national market for commodities.',
    eligibility: 'Farmers, traders, commission agents registered with APMCs.',
    benefits: 'Transparent electronic price bidding, weighment, and direct digital payments.',
    category: 'market',
    targetFarmers: 'All farmers',
    state: 'All India',
    applicationUrl: 'https://enam.gov.in',
  },
];

const GovernmentSchemes = () => {
  const [schemes, setSchemes] = useState(DEFAULT_SCHEMES);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSchemes = async () => {
      setLoading(true);
      try {
        const res = await schemesApi.getSchemes();
        if (res?.schemes && res.schemes.length > 0) {
          setSchemes(res.schemes);
        }
      } catch (e) {}
      setLoading(false);
    };
    fetchSchemes();
  }, []);

  const categories = [
    { id: 'all', label: 'All Schemes' },
    { id: 'subsidy', label: 'Direct Subsidy' },
    { id: 'insurance', label: 'Crop Insurance' },
    { id: 'loan', label: 'Credit & Loans' },
    { id: 'equipment', label: 'Equipment Subsidy' },
    { id: 'market', label: 'Market Access' },
  ];

  const filteredSchemes = schemes.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.benefits.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Government <span className="gradient-text">Agricultural Schemes</span>
          </h1>
          <p className="page-subtitle">
            Verify eligibility, subsidy amounts, and official application portals for Central & State farmer welfare programs.
          </p>
        </div>

        <span className="badge badge-success">
          Updated for Financial Year 2026-27
        </span>
      </div>

      {/* Category Pills & Search */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor:
                  selectedCategory === cat.id
                    ? 'var(--primary)'
                    : 'var(--border-subtle)',
                background:
                  selectedCategory === cat.id
                    ? 'var(--primary)'
                    : 'rgba(255, 255, 255, 0.02)',
                color: selectedCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ minWidth: 260, position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search scheme name, subsidy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Scheme Cards Grid */}
      <div className="grid-2">
        {filteredSchemes.map((scheme, idx) => (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                  {scheme.category || 'Welfare'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {scheme.state || 'All India'}
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.6rem', color: '#ffffff' }}>
                {scheme.name}
              </h3>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                {scheme.description}
              </p>

              {/* Financial Benefits Box */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Financial Benefits & Assistance
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {scheme.benefits}
                </div>
              </div>

              {/* Eligibility */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                <strong>Eligibility:</strong> {scheme.eligibility}
              </div>
            </div>

            {/* Application link */}
            <div>
              {scheme.applicationUrl ? (
                <a
                  href={scheme.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  Apply on Official Portal <ExternalLink size={14} />
                </a>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Apply through your local Block Agriculture Office / CSC Centre
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GovernmentSchemes;

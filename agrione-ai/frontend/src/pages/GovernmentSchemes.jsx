import { useCallback, useEffect, useState } from 'react';
import { schemesApi } from '../api/schemesApi';
import {
  Search,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

const optionalText = (value) => (typeof value === 'string' ? value : '');

const normalizeSchemes = (response) => {
  if (response?.success !== true || !Array.isArray(response.schemes)) {
    throw new Error(response?.message || 'The schemes service returned an unexpected response.');
  }

  if (!response.schemes.every((scheme) => (
    scheme &&
    typeof scheme === 'object' &&
    !Array.isArray(scheme) &&
    typeof scheme.name === 'string' &&
    scheme.name.trim().length > 0
  ))) {
    throw new Error('The schemes service returned invalid scheme records.');
  }

  return response.schemes.map((scheme) => ({
    ...scheme,
    name: scheme.name.trim(),
    description: optionalText(scheme.description),
    benefits: optionalText(scheme.benefits),
    eligibility: optionalText(scheme.eligibility),
    category: optionalText(scheme.category),
    state: optionalText(scheme.state),
    applicationUrl: optionalText(scheme.applicationUrl),
  }));
};

const getSafeApplicationUrl = (value) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};

const GovernmentSchemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestSchemes = useCallback(async () => {
    const response = await schemesApi.getSchemes();
    return normalizeSchemes(response);
  }, []);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSchemes(await requestSchemes());
    } catch (requestError) {
      setSchemes([]);
      setError(requestError.message || 'Unable to load government schemes.');
    } finally {
      setLoading(false);
    }
  }, [requestSchemes]);

  useEffect(() => {
    let cancelled = false;
    const loadInitialSchemes = async () => {
      try {
        const nextSchemes = await requestSchemes();
        if (cancelled) return;
        setSchemes(nextSchemes);
        setError('');
      } catch (requestError) {
        if (cancelled) return;
        setSchemes([]);
        setError(requestError.message || 'Unable to load government schemes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitialSchemes();
    return () => {
      cancelled = true;
    };
  }, [requestSchemes]);

  const categories = [
    { id: 'all', label: 'All Schemes' },
    { id: 'subsidy', label: 'Direct Subsidy' },
    { id: 'insurance', label: 'Crop Insurance' },
    { id: 'loan', label: 'Credit & Loans' },
    { id: 'equipment', label: 'Equipment Subsidy' },
    { id: 'market', label: 'Market Access' },
  ];

  const filteredSchemes = schemes.filter((s) => {
    const normalizedSearch = search.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(normalizedSearch) ||
      s.description.toLowerCase().includes(normalizedSearch) ||
      s.benefits.toLowerCase().includes(normalizedSearch) ||
      s.eligibility.toLowerCase().includes(normalizedSearch) ||
      s.category.toLowerCase().includes(normalizedSearch) ||
      s.state.toLowerCase().includes(normalizedSearch);
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

      </div>

      <div className="alert" role="note" style={{ marginBottom: '1.25rem' }}>
        Scheme descriptions are general references. Eligibility, benefits, application availability, and conditions may change; verify current details with the official portal or your local agriculture office.
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

      {loading ? (
        <div className="glass-panel" role="status" style={{ padding: '1.5rem' }}>
          Loading government schemes...
        </div>
      ) : error ? (
        <div className="glass-panel" role="alert" style={{ padding: '1.5rem' }}>
          <p>Unable to load government schemes: {error}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchSchemes} disabled={loading}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : schemes.length === 0 ? (
        <div className="glass-panel" role="status" style={{ padding: '1.5rem' }}>
          No government schemes are currently available.
        </div>
      ) : filteredSchemes.length === 0 ? (
        <div className="glass-panel" role="status" style={{ padding: '1.5rem' }}>
          No matching schemes found. Try a different search or category.
        </div>
      ) : (
      <div className="grid-2">
        {filteredSchemes.map((scheme) => (
          <div
            key={scheme._id || `${scheme.name}-${scheme.state}`}
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

              {scheme.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  {scheme.description}
                </p>
              )}

              {scheme.benefits && <div
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
              </div>}

              {scheme.eligibility && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  <strong>Eligibility:</strong> {scheme.eligibility}
                </div>
              )}
            </div>

            {/* Application link */}
            <div>
              {getSafeApplicationUrl(scheme.applicationUrl) ? (
                <a
                  href={getSafeApplicationUrl(scheme.applicationUrl)}
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
      )}
    </div>
  );
};

export default GovernmentSchemes;

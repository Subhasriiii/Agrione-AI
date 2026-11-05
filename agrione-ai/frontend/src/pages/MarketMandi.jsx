import { useCallback, useState, useEffect } from 'react';
import { marketApi } from '../api/marketApi';
import {
  Search,
  MapPin,
  RefreshCw,
} from 'lucide-react';

const requestMarketData = async () => {
  const res = await marketApi.getMarketData();
  if (!Array.isArray(res?.marketData)) {
    throw new Error(res?.message || 'The market data service returned an unexpected response.');
  }

  return {
    data: res.marketData.filter((item) =>
      item &&
      typeof item.crop === 'string' &&
      typeof item.market === 'string' &&
      typeof item.price === 'number' &&
      Number.isFinite(item.price)
    ),
    note: typeof res.note === 'string' ? res.note : '',
  };
};

const MarketMandi = () => {
  const [data, setData] = useState([]);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMarket = useCallback(async () => {
    try {
      const result = await requestMarketData();
      setData(result.data);
      setNote(result.note);
      setError('');
    } catch (fetchError) {
      setData([]);
      setNote('');
      setError(fetchError.message || 'Unable to load market data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestMarketData().then((result) => {
      if (!active) return;
      setData(result.data);
      setNote(result.note);
      setError('');
      setLoading(false);
    }).catch((fetchError) => {
      if (!active) return;
      setData([]);
      setNote('');
      setError(fetchError.message || 'Unable to load market data.');
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.crop.toLowerCase().includes(search.toLowerCase()) ||
      item.market.toLowerCase().includes(search.toLowerCase()) ||
      item.location?.toLowerCase().includes(search.toLowerCase());
    const matchesState =
      selectedState === 'all' || item.state === selectedState;
    return matchesSearch && matchesState;
  });

  const states = ['all', ...new Set(data.map((d) => d.state).filter(Boolean))];
  const allRecordsVerified = data.length > 0 && data.every((item) => item.status === 'VERIFIED' && item.source);
  const someRecordsVerified = data.some((item) => item.status === 'VERIFIED' && item.source);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            APMC Mandi <span className="gradient-text">Commodity Prices</span>
          </h1>
          <p className="page-subtitle">
            Market records and indicative fallback rates. Verification status, source, and available dates are shown for each record.
          </p>
        </div>

        <span className={`badge ${allRecordsVerified ? 'badge-success' : 'badge-warning'}`}>
          {loading ? 'Loading market data' : error || data.length === 0 ? 'NOT AVAILABLE' : allRecordsVerified ? 'VERIFIED' : someRecordsVerified ? 'MIXED DATA' : 'INDICATIVE'}
        </span>
      </div>

      {note && (
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          {note}
        </div>
      )}

      {error && (
        <div className="alert" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <span>Unable to load market prices: {error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setLoading(true);
              setError('');
              setData([]);
              setNote('');
              fetchMarket();
            }}
            disabled={loading}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search crop or mandi (e.g. Cotton, Guntur, Onion)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 200 }}>
          <select
            className="form-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="all">All States & Territories</option>
            {states
              .filter((s) => s !== 'all')
              .map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Commodity Cards Grid */}
      {loading ? (
        <div className="glass-panel" role="status" style={{ padding: '2rem', textAlign: 'center' }}>Loading market prices...</div>
      ) : !error && filteredData.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {data.length ? 'No market prices match these filters.' : 'No market data is currently available.'}
        </div>
      ) : null}
      <div className="grid-3">
        {filteredData.map((item, idx) => {
          const minPrice = Number(item.minPrice);
          const maxPrice = Number(item.maxPrice);
          const price = Number(item.price);
          const hasPriceRange = Number.isFinite(minPrice) && minPrice > 0 && Number.isFinite(maxPrice) && maxPrice > minPrice;
          const spread = hasPriceRange ? maxPrice - minPrice : 0;
          const pos =
            spread > 0
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(((price - minPrice) / spread) * 100)
                  )
                )
              : 50;
          const verified = item.status === 'VERIFIED' && Boolean(item.source);
          const priceDate = verified && item.priceDate && Number.isFinite(Date.parse(item.priceDate))
            ? new Date(item.priceDate).toLocaleDateString()
            : 'Not available';

          return (
            <div key={item._id || `${item.crop}-${item.market}-${idx}`} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>
                    {item.crop}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <MapPin size={13} />
                    {item.market}{item.state ? ` • ${item.state}` : ''}
                  </div>
                  <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: '0.5rem' }}>
                    {verified ? 'VERIFIED' : 'INDICATIVE'}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                    ₹{price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {item.unit || 'Unit not provided'}
                  </div>
                </div>
              </div>

              {hasPriceRange && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    <span>Min: ₹{minPrice.toLocaleString()}</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>Modal: ₹{price.toLocaleString()}</span>
                    <span>Max: ₹{maxPrice.toLocaleString()}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pos}%`,
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              )}
              <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <div>Date: {priceDate}</div>
                <div>{item.source ? `Source: ${item.source}` : note || 'Source not provided'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketMandi;

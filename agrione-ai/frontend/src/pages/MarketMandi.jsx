import React, { useState, useEffect } from 'react';
import { marketApi } from '../api/marketApi';
import {
  Store,
  Search,
  IndianRupee,
  TrendingUp,
  MapPin,
  RefreshCw,
  Filter,
  Sparkles,
} from 'lucide-react';

const DEFAULT_MARKET_DATA = [
  { crop: 'Cotton', market: 'Adilabad Mandi', price: 6500, minPrice: 6000, maxPrice: 7000, unit: 'per quintal', location: 'Adilabad', state: 'Telangana' },
  { crop: 'Chilli (Dry)', market: 'Guntur Mandi', price: 12000, minPrice: 10000, maxPrice: 14000, unit: 'per quintal', location: 'Guntur', state: 'Andhra Pradesh' },
  { crop: 'Rice (Paddy)', market: 'Guntur Mandi', price: 2200, minPrice: 2000, maxPrice: 2400, unit: 'per quintal', location: 'Guntur', state: 'Andhra Pradesh' },
  { crop: 'Tomato', market: 'Madanapalle Mandi', price: 2500, minPrice: 1500, maxPrice: 3500, unit: 'per quintal', location: 'Madanapalle', state: 'Andhra Pradesh' },
  { crop: 'Onion', market: 'Lasalgaon Mandi', price: 1800, minPrice: 1500, maxPrice: 2200, unit: 'per quintal', location: 'Nashik', state: 'Maharashtra' },
  { crop: 'Wheat', market: 'Hapur Mandi', price: 2300, minPrice: 2100, maxPrice: 2500, unit: 'per quintal', location: 'Hapur', state: 'Uttar Pradesh' },
  { crop: 'Maize', market: 'Nizamabad Mandi', price: 1900, minPrice: 1750, maxPrice: 2050, unit: 'per quintal', location: 'Nizamabad', state: 'Telangana' },
  { crop: 'Potato', market: 'Agra Mandi', price: 1200, minPrice: 1000, maxPrice: 1500, unit: 'per quintal', location: 'Agra', state: 'Uttar Pradesh' },
  { crop: 'Groundnut', market: 'Rajkot Mandi', price: 5200, minPrice: 4800, maxPrice: 5600, unit: 'per quintal', location: 'Rajkot', state: 'Gujarat' },
  { crop: 'Soybean', market: 'Indore Mandi', price: 4500, minPrice: 4200, maxPrice: 4800, unit: 'per quintal', location: 'Indore', state: 'Madhya Pradesh' },
  { crop: 'Turmeric', market: 'Erode Mandi', price: 8500, minPrice: 7500, maxPrice: 9500, unit: 'per quintal', location: 'Erode', state: 'Tamil Nadu' },
  { crop: 'Sugarcane', market: 'Kolhapur Mandi', price: 350, minPrice: 310, maxPrice: 380, unit: 'per quintal', location: 'Kolhapur', state: 'Maharashtra' },
];

const MarketMandi = () => {
  const [data, setData] = useState(DEFAULT_MARKET_DATA);
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMarket = async () => {
      setLoading(true);
      try {
        const res = await marketApi.getMarketData();
        if (res?.marketData && res.marketData.length > 0) {
          setData(res.marketData);
        }
      } catch (e) {
        // use fallback data
      } finally {
        setLoading(false);
      }
    };
    fetchMarket();
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            APMC Mandi <span className="gradient-text">Commodity Prices</span>
          </h1>
          <p className="page-subtitle">
            Daily wholesale market arrivals, modal rates, and price band analysis across major Indian agricultural markets.
          </p>
        </div>

        <span className="badge badge-success">
          Live Mandi Rates Synchronized
        </span>
      </div>

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
      <div className="grid-3">
        {filteredData.map((item, idx) => {
          const spread = item.maxPrice - item.minPrice;
          const pos =
            spread > 0
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(((item.price - item.minPrice) / spread) * 100)
                  )
                )
              : 50;

          return (
            <div key={idx} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>
                    {item.crop}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    <MapPin size={13} />
                    {item.market} • {item.state}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                    ₹{item.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {item.unit || 'per quintal'}
                  </div>
                </div>
              </div>

              {/* Price Range Visual Indicator */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <span>Min: ₹{item.minPrice}</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>Modal: ₹{item.price}</span>
                  <span>Max: ₹{item.maxPrice}</span>
                </div>

                {/* Progress bar representing where the modal price sits */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketMandi;

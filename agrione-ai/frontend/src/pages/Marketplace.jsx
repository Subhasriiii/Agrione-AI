import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { marketApi } from '../api/marketApi';
import {
  ShoppingBag,
  Plus,
  Phone,
  MapPin,
  Calendar,
  X,
  Sparkles,
  CheckCircle2,
  Tag,
  ShieldCheck,
  Search,
} from 'lucide-react';

const DEFAULT_LISTINGS = [
  {
    _id: 'listing-1',
    title: 'Premium Shankar-6 Raw Cotton (Bt)',
    crop: 'Cotton',
    quantity: 65,
    unit: 'Quintals',
    pricePerUnit: 6700,
    isOrganic: false,
    qualityGrade: 'Grade A',
    location: { district: 'Guntur', state: 'Andhra Pradesh', village: 'Pedavadlapudi' },
    contactPhone: '+91 98765 43210',
    farmerName: 'Ramesh Patel',
    harvestDate: '2026-10-15',
    status: 'available',
    description: 'High staple length 29mm, moisture under 8%. Ready for direct ginning pickup.',
  },
  {
    _id: 'listing-2',
    title: 'Guntur Teja S17 Red Chilli (Sun Dried)',
    crop: 'Chilli',
    quantity: 30,
    unit: 'Quintals',
    pricePerUnit: 12500,
    isOrganic: true,
    qualityGrade: 'Export Quality',
    location: { district: 'Guntur', state: 'Andhra Pradesh', village: 'Tenali' },
    contactPhone: '+91 94401 23456',
    farmerName: 'Suresh Rao',
    harvestDate: '2026-09-20',
    status: 'available',
    description: 'Bright red color, pungency >60,000 SHU. Naturally dried on tarpaulins.',
  },
  {
    _id: 'listing-3',
    title: 'Organic Sona Masoori Paddy (Single Polish)',
    crop: 'Rice',
    quantity: 120,
    unit: 'Quintals',
    pricePerUnit: 2450,
    isOrganic: true,
    qualityGrade: 'Grade A',
    location: { district: 'Krishna', state: 'Andhra Pradesh', village: 'Kankipadu' },
    contactPhone: '+91 91234 56789',
    farmerName: 'Venkatesh K.',
    harvestDate: '2026-10-01',
    status: 'available',
    description: 'Grown with vermicompost and jeevamrutha without synthetic pesticides.',
  },
  {
    _id: 'listing-4',
    title: 'Hybrid High-Yield Maize Grains',
    crop: 'Maize',
    quantity: 85,
    unit: 'Quintals',
    pricePerUnit: 1950,
    isOrganic: false,
    qualityGrade: 'Fair Average Quality',
    location: { district: 'Nizamabad', state: 'Telangana', village: 'Armoor' },
    contactPhone: '+91 98480 11223',
    farmerName: 'Anil Reddy',
    harvestDate: '2026-09-28',
    status: 'available',
    description: 'Low moisture (11%), optimal for poultry and animal feed millers.',
  },
];

const Marketplace = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'my'
  const [listings, setListings] = useState(DEFAULT_LISTINGS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    crop: activeFarm?.primaryCrop || 'Cotton',
    quantity: 50,
    unit: 'Quintals',
    pricePerUnit: 6500,
    isOrganic: false,
    qualityGrade: 'Grade A',
    contactPhone: user?.phone || '+91 98765 43210',
    description: '',
  });

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await marketApi.getListings();
        if (res?.listings && res.listings.length > 0) {
          setListings(res.listings);
        }
      } catch (e) {}
    };
    fetchListings();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const newListing = {
      _id: 'listing-' + Date.now(),
      title: formData.title || `${formData.crop} - ${formData.quantity} ${formData.unit}`,
      crop: formData.crop,
      quantity: Number(formData.quantity),
      unit: formData.unit,
      pricePerUnit: Number(formData.pricePerUnit),
      isOrganic: formData.isOrganic,
      qualityGrade: formData.qualityGrade,
      location: {
        district: activeFarm?.location?.district || 'Guntur',
        state: activeFarm?.location?.state || 'Andhra Pradesh',
      },
      contactPhone: formData.contactPhone,
      farmerName: user?.name || 'Ramesh Patel',
      harvestDate: new Date().toISOString().split('T')[0],
      status: 'available',
      description: formData.description,
    };

    setListings([newListing, ...listings]);
    setShowCreateModal(false);
    setFormData({
      title: '',
      crop: activeFarm?.primaryCrop || 'Cotton',
      quantity: 50,
      unit: 'Quintals',
      pricePerUnit: 6500,
      isOrganic: false,
      qualityGrade: 'Grade A',
      contactPhone: user?.phone || '+91 98765 43210',
      description: '',
    });
  };

  const filteredListings = listings.filter((l) => {
    const matchesSearch =
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.crop?.toLowerCase().includes(search.toLowerCase()) ||
      l.location?.district?.toLowerCase().includes(search.toLowerCase());
    const matchesCrop = selectedCrop === 'all' || l.crop === selectedCrop;
    const matchesTab = activeTab === 'browse' || l.farmerName === user?.name;
    return matchesSearch && matchesCrop && matchesTab;
  });

  const crops = ['all', ...new Set(listings.map((l) => l.crop))];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Direct Farm-to-Buyer <span className="gradient-text">Marketplace</span>
          </h1>
          <p className="page-subtitle">
            Eliminate commission middle-men. List your harvested produce directly for millers, traders, and bulk buyers.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          List Your Produce
        </button>
      </div>

      {/* Tabs & Search */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="tab-container" style={{ margin: 0 }}>
          <button
            onClick={() => setActiveTab('browse')}
            className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
          >
            <ShoppingBag size={15} />
            All Produce Listings ({listings.length})
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          >
            My Active Listings
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: 500 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Filter by crop, variety, or town..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 140 }}
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
          >
            {crops.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Crops' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid-2">
        {filteredListings.map((listing) => (
          <div
            key={listing._id}
            className="glass-panel"
            style={{
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <span className="badge badge-success">{listing.crop}</span>
                    {listing.isOrganic && (
                      <span className="badge badge-purple">Organic Certified</span>
                    )}
                    <span className="badge badge-info">{listing.qualityGrade}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>
                    {listing.title}
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                    ₹{listing.pricePerUnit?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    per {listing.unit?.slice(0, -1) || 'quintal'}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {listing.description || 'Harvested under monitored conditions. Sample inspection available upon request.'}
              </p>

              {/* Quantity & Location Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  padding: '0.75rem 0',
                  borderTop: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Stock Available</div>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {listing.quantity} {listing.unit}
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Mandi / Location</div>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {listing.location?.district || 'Guntur'}, {listing.location?.state || 'AP'}
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Farmer Contact</div>
                  <strong style={{ color: '#38bdf8' }}>
                    {listing.farmerName}
                  </strong>
                </div>
              </div>
            </div>

            {/* Seller Contact Button */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <a
                href={`tel:${listing.contactPhone}`}
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
              >
                <Phone size={15} />
                Call Seller ({listing.contactPhone})
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Post Produce Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>List Your Produce for Direct Sale</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-group">
                <label className="form-label">Produce Headline / Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Shankar-6 Raw Cotton (Grade A)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Commodity</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Available Quantity</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Asking Price (₹ / Quintal)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quality Grade</label>
                  <select
                    className="form-select"
                    value={formData.qualityGrade}
                    onChange={(e) => setFormData({ ...formData, qualityGrade: e.target.value })}
                  >
                    <option value="Grade A">Grade A (Premium)</option>
                    <option value="Export Quality">Export Quality</option>
                    <option value="Standard FAQ">Standard FAQ</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Phone Number</label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description & Quality Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Mention moisture content, variety name, pickup location..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="organicCheck"
                  checked={formData.isOrganic}
                  onChange={(e) => setFormData({ ...formData, isOrganic: e.target.checked })}
                />
                <label htmlFor="organicCheck" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  This lot is Organically Certified / Residue-Free
                </label>
              </div>

              <div className="modal-footer" style={{ padding: '1rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish to Marketplace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;

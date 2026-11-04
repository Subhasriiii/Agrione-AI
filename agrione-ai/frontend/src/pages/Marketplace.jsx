import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { marketApi } from '../api/marketApi';
import {
  ShoppingBag,
  Plus,
  Phone,
  X,
  Search,
  Pencil,
  Trash2,
  Mail,
} from 'lucide-react';

const Marketplace = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'my'
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [formError, setFormError] = useState('');
  const [savingListing, setSavingListing] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('all');

  const [formData, setFormData] = useState({
    cropName: activeFarm?.primaryCrop || 'Cotton',
    quantity: '50',
    quantityUnit: 'Quintals',
    expectedPrice: '6500',
    priceUnit: 'per quintal',
    location: activeFarm?.location?.district || user?.district || '',
    description: '',
    contactMethod: 'phone',
  });

  const loadListings = useCallback(async (tab = activeTab) => {
    setListingsLoading(true);
    setListingsError('');
    try {
      const res = user?.role === 'farmer' && tab === 'my'
        ? await marketApi.getMyListings()
        : await marketApi.getListings();
      if (!Array.isArray(res?.listings)) {
        throw new Error('The marketplace returned an unexpected response.');
      }
      setListings(res.listings);
    } catch (error) {
      setListings([]);
      setListingsError(error.message || 'Unable to load crop listings. Please try again.');
    } finally {
      setListingsLoading(false);
    }
  }, [activeTab, user?._id, user?.role]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    if (user?.role !== 'farmer' && activeTab !== 'browse') {
      setActiveTab('browse');
    }
  }, [activeTab, user?.role]);

  const openCreateForm = () => {
    if (user?.role !== 'farmer') return;
    setEditingListing(null);
    setImageFile(null);
    setFormError('');
    setFormData({
      cropName: activeFarm?.primaryCrop || 'Cotton',
      quantity: '50',
      quantityUnit: 'Quintals',
      expectedPrice: '6500',
      priceUnit: 'per quintal',
      location: activeFarm?.location?.district || user?.district || '',
      description: '',
      contactMethod: 'phone',
    });
    setShowCreateModal(true);
  };

  const openEditForm = (listing) => {
    if (user?.role !== 'farmer') return;
    setEditingListing(listing);
    setImageFile(null);
    setFormError('');
    setFormData({
      cropName: listing.cropName || '',
      quantity: String(listing.quantity ?? ''),
      quantityUnit: listing.quantityUnit || 'kg',
      expectedPrice: String(listing.expectedPrice ?? ''),
      priceUnit: listing.priceUnit || 'per kg',
      location: listing.location || '',
      description: listing.description || '',
      contactMethod: listing.contactMethod || 'phone',
    });
    setShowCreateModal(true);
  };

  const handleSaveListing = async (e) => {
    e.preventDefault();
    if (user?.role !== 'farmer') return;
    setFormError('');
    setSavingListing(true);

    const listingData = {
      cropName: formData.cropName.trim(),
      quantity: Number(formData.quantity),
      quantityUnit: formData.quantityUnit,
      expectedPrice: Number(formData.expectedPrice),
      priceUnit: formData.priceUnit,
      location: formData.location.trim(),
      description: formData.description.trim(),
      contactMethod: formData.contactMethod,
    };

    try {
      if (editingListing) {
        await marketApi.updateListing(editingListing._id, listingData);
      } else {
        const multipartData = new FormData();
        Object.entries(listingData).forEach(([key, value]) => {
          multipartData.append(key, String(value));
        });
        if (imageFile) multipartData.append('image', imageFile);
        await marketApi.createListing(multipartData);
      }

      setShowCreateModal(false);
      await loadListings();
    } catch (error) {
      setFormError(error.message || 'Unable to save the listing. Please try again.');
    } finally {
      setSavingListing(false);
    }
  };

  const handleDeleteListing = async (listing) => {
    if (user?.role !== 'farmer' || !window.confirm(`Delete the listing for ${listing.cropName}?`)) return;
    setListingsError('');
    try {
      await marketApi.deleteListing(listing._id);
      await loadListings('my');
    } catch (error) {
      setListingsError(error.message || 'Unable to delete the listing. Please try again.');
    }
  };

  const filteredListings = listings.filter((l) => {
    const matchesSearch =
      l.cropName?.toLowerCase().includes(search.toLowerCase()) ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.location?.toLowerCase().includes(search.toLowerCase());
    const matchesCrop = selectedCrop === 'all' || l.cropName === selectedCrop;
    return matchesSearch && matchesCrop;
  });

  const crops = ['all', ...new Set(listings.map((l) => l.cropName).filter(Boolean))];

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

        {user?.role === 'farmer' && (
          <button onClick={openCreateForm} className="btn btn-primary">
            <Plus size={18} />
            List Your Produce
          </button>
        )}
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
            Available Crop Listings ({listings.length})
          </button>
          {user?.role === 'farmer' && (
            <button
              onClick={() => setActiveTab('my')}
              className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
            >
              My Listings
            </button>
          )}
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
      {listingsError && (
        <div className="glass-panel" role="alert" style={{ padding: '1rem', marginBottom: '1rem', color: '#f87171' }}>
          {listingsError}
        </div>
      )}

      {listingsLoading ? (
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          Loading crop listings...
        </div>
      ) : !listingsError && filteredListings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          {activeTab === 'my' ? 'You have not listed any crops yet.' : 'No crop listings available yet.'}
        </div>
      ) : (
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
                    <span className="badge badge-success">{listing.cropName}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: '#ffffff' }}>
                    {listing.cropName}
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                    ₹{Number(listing.expectedPrice).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {listing.priceUnit || 'per unit'}
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
                    {listing.quantity} {listing.quantityUnit}
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Mandi / Location</div>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {listing.location || 'Location not specified'}
                  </strong>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Farmer Contact</div>
                  <strong style={{ color: '#38bdf8' }}>
                    {listing.seller?.name || 'Farmer'}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {listing.seller?.phone && (
                <a href={`tel:${listing.seller.phone}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                  <Phone size={15} />
                  Call Seller
                </a>
              )}
              {listing.seller?.email && (
                <a href={`mailto:${listing.seller.email}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                  <Mail size={15} />
                  Email Seller
                </a>
              )}
              {user?.role === 'farmer' && activeTab === 'my' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditForm(listing)} aria-label={`Edit ${listing.cropName} listing`}>
                    <Pencil size={15} />
                    Edit
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDeleteListing(listing)} aria-label={`Delete ${listing.cropName} listing`}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Post Produce Modal */}
      {showCreateModal && user?.role === 'farmer' && (
        <div className="modal-overlay" onClick={() => !savingListing && setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingListing ? 'Edit Crop Listing' : 'List Your Produce for Direct Sale'}</h3>
              <button
                onClick={() => !savingListing && setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                disabled={savingListing}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveListing} className="modal-body">
              {formError && (
                <div role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>
                {formError}
                </div>
              )}

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                <label className="form-label">Commodity</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.cropName}
                  onChange={(e) => setFormData({ ...formData, cropName: e.target.value })}
                />
                </div>
                <div className="form-group">
                <label className="form-label">Available Quantity</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  className="form-input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                <label className="form-label">Quantity Unit</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.quantityUnit}
                  onChange={(e) => setFormData({ ...formData, quantityUnit: e.target.value })}
                />
                </div>
                <div className="form-group">
                <label className="form-label">Asking Price (₹)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  className="form-input"
                  value={formData.expectedPrice}
                  onChange={(e) => setFormData({ ...formData, expectedPrice: e.target.value })}
                />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                <label className="form-label">Price Unit</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.priceUnit}
                  onChange={(e) => setFormData({ ...formData, priceUnit: e.target.value })}
                />
                </div>
                <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Preference</label>
                <select
                className="form-select"
                value={formData.contactMethod}
                onChange={(e) => setFormData({ ...formData, contactMethod: e.target.value })}
                >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="both">Phone and email</option>
                </select>
              </div>

              {!editingListing && (
                <div className="form-group">
                <label className="form-label">Crop Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                </div>
              )}

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

              <div className="modal-footer" style={{ padding: '1rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={savingListing}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingListing}>
                  {savingListing ? 'Saving...' : editingListing ? 'Save Changes' : 'Publish to Marketplace'}
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

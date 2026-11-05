import { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import {
  MapPin,
  Plus,
  Edit,
  CheckCircle2,
  X,
  Sparkles,
  Trash2,
} from 'lucide-react';

const isRecordedMeasurement = (soilData, field) => {
  const provenance = soilData?.measurementProvenance?.[field];
  return provenance?.source === 'farmer-entered' &&
    Boolean(provenance.recordedAt) &&
    Number.isFinite(Date.parse(provenance.recordedAt));
};

const getRecordedValue = (farm, field) => {
  const value = farm?.soilData?.[field];
  return isRecordedMeasurement(farm?.soilData, field) && value !== null && Number.isFinite(Number(value))
    ? value
    : '';
};

const FarmManagement = () => {
  const { farms, activeFarm, setActiveFarm, addFarm, updateFarm, updateSoil, deleteFarm } = useFarm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSoilModal, setShowSoilModal] = useState(false);
  const [selectedFarmForEdit, setSelectedFarmForEdit] = useState(null);
  const [selectedFarmForSoil, setSelectedFarmForSoil] = useState(null);
  const [createError, setCreateError] = useState('');
  const [soilSaveError, setSoilSaveError] = useState('');
  const [deletingFarmId, setDeletingFarmId] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    name: '',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    village: '',
    totalArea: 4,
    soilType: 'black',
    irrigationSource: 'other',
    primaryCrop: 'Cotton',
  });

  const [soilFormData, setSoilFormData] = useState({
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    ph: '',
    organicCarbon: '',
    moisture: '',
  });

  const [editFormData, setEditFormData] = useState({
    farmName: '',
    location: '',
    area: '',
    soilType: 'black',
    currentCrop: '',
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    const result = await addFarm({
      farmName: formData.name.trim(),
      location: [formData.village, formData.district, formData.state].map((part) => part.trim()).filter(Boolean).join(', '),
      area: Number(formData.totalArea),
      soilType: formData.soilType,
      irrigationType: formData.irrigationSource,
      currentCrop: formData.primaryCrop.trim(),
    });

    if (!result.success) {
      setCreateError(result.message || 'Unable to create farm. Please try again.');
      return;
    }

    setStatusMessage({ type: 'success', message: 'Farm registered successfully.' });
    setShowAddModal(false);
    setFormData({
      name: '',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: '',
      totalArea: 4,
      soilType: 'black',
      irrigationSource: 'other',
      primaryCrop: 'Cotton',
    });
  };

  const handleOpenEditFarm = (farm) => {
    setSelectedFarmForEdit(farm);
    setEditFormData({
      farmName: farm.farmName || farm.name || '',
      location: typeof farm.location === 'string' ? farm.location : farm.location?.village || farm.location?.district || '',
      area: farm.area || farm.totalArea || '',
      soilType: farm.soilType || 'black',
      currentCrop: farm.currentCrop || farm.primaryCrop || '',
    });
    setShowEditModal(true);
  };

  const handleSaveFarm = async (e) => {
    e.preventDefault();

    if (!selectedFarmForEdit) {
      return;
    }

    const payload = {
      farmName: editFormData.farmName.trim(),
      location: editFormData.location.trim(),
      area: Number(editFormData.area),
      soilType: editFormData.soilType,
      currentCrop: editFormData.currentCrop.trim(),
    };

    const result = await updateFarm(selectedFarmForEdit._id, payload);

    if (result.success) {
      setStatusMessage({ type: 'success', message: 'Farm details updated successfully.' });
      setShowEditModal(false);
      setSelectedFarmForEdit(null);
      setActiveFarm(result.farm);
    } else {
      setStatusMessage({ type: 'error', message: result.message || 'Unable to update farm details.' });
    }
  };

  const handleOpenSoil = (farm) => {
    setSelectedFarmForSoil(farm);
    setSoilSaveError('');
    setStatusMessage({ type: '', message: '' });
    setSoilFormData({
      nitrogen: getRecordedValue(farm, 'nitrogen'),
      phosphorus: getRecordedValue(farm, 'phosphorus'),
      potassium: getRecordedValue(farm, 'potassium'),
      ph: getRecordedValue(farm, 'pH'),
      organicCarbon: getRecordedValue(farm, 'organicCarbon'),
      moisture: getRecordedValue(farm, 'moisture'),
    });
    setShowSoilModal(true);
  };

  const handleSaveSoil = async (e) => {
    e.preventDefault();
    setSoilSaveError('');
    if (selectedFarmForSoil) {
      const soilMeasurements = {
        nitrogen: soilFormData.nitrogen,
        phosphorus: soilFormData.phosphorus,
        potassium: soilFormData.potassium,
        pH: soilFormData.ph,
        organicCarbon: soilFormData.organicCarbon,
        moisture: soilFormData.moisture,
      };
      const payload = Object.fromEntries(
        Object.entries(soilMeasurements)
          .filter(([, value]) => value !== '' && value !== null && value !== undefined)
          .map(([field, value]) => [field, Number(value)])
      );

      if (Object.keys(payload).length === 0) {
        setSoilSaveError('Enter at least one soil measurement before saving.');
        return;
      }

      const result = await updateSoil(selectedFarmForSoil._id, payload);
      if (!result.success) {
        setSoilSaveError(result.message || 'Unable to save soil measurements.');
        return;
      }

      setStatusMessage({ type: 'success', message: 'Soil measurements saved as farmer-entered values.' });
      setShowSoilModal(false);
    }
  };

  const handleDeleteFarm = async (farm) => {
    if (!window.confirm(`Permanently delete "${farm.farmName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingFarmId(farm._id);
    setStatusMessage({ type: '', message: '' });
    try {
      const result = await deleteFarm(farm._id);
      setStatusMessage(result.success
        ? { type: 'success', message: `${farm.farmName} was deleted.` }
        : { type: 'error', message: result.message || 'Unable to delete farm.' });
    } catch (error) {
      setStatusMessage({ type: 'error', message: error.message || 'Unable to delete farm.' });
    } finally {
      setDeletingFarmId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            My Registered <span className="gradient-text">Farm Plots</span>
          </h1>
          <p className="page-subtitle">
            Manage your land parcels, GPS locations, irrigation facilities, and soil test parameters.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError('');
            setStatusMessage({ type: '', message: '' });
            setShowAddModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Register New Farm
        </button>
      </div>

      {statusMessage.message && (
        <div
          className="alert"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: statusMessage.type === 'success' ? '#34d399' : '#fca5a5',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          }}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Farm Cards Grid */}
      <div className="grid-2">
        {farms.map((farm) => {
          const isActive = activeFarm?._id === farm._id;
          const recordedNitrogen = getRecordedValue(farm, 'nitrogen');
          const recordedPhosphorus = getRecordedValue(farm, 'phosphorus');
          const recordedPotassium = getRecordedValue(farm, 'potassium');
          const recordedPh = getRecordedValue(farm, 'pH');
          const recordedMoisture = getRecordedValue(farm, 'moisture');
          return (
            <div
              key={farm._id}
              className="glass-panel"
              style={{
                padding: '1.75rem',
                border: isActive
                  ? '2px solid var(--primary)'
                  : '1px solid var(--border-subtle)',
                boxShadow: isActive ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
                position: 'relative',
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: '#34d399',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={16} />
                  ACTIVE PLOT
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>
                  {farm.farmName}
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                  }}
                >
                  <MapPin size={14} />
                  {farm.location || 'Location not set'}
                </div>
              </div>

              {/* Attributes Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  padding: '1rem 0',
                  borderTop: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  margin: '1rem 0',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Area</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {farm.area ?? 'N/A'} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Acres</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Soil Type</div>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize', color: '#fbbf24' }}>
                    {farm.soilType || 'Black'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Irrigation</div>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize', color: '#38bdf8' }}>
                    {farm.irrigationType || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Soil Data Summary Pill */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.4rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>Soil Parameters</span>
                  <button
                    onClick={() => handleOpenSoil(farm)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary-light)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Edit size={12} /> Edit Test Values
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    textAlign: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>N:</span>{' '}
                    <strong>{recordedNitrogen !== '' ? recordedNitrogen : 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>P:</span>{' '}
                    <strong>{recordedPhosphorus !== '' ? recordedPhosphorus : 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>K:</span>{' '}
                    <strong>{recordedPotassium !== '' ? recordedPotassium : 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>pH:</span>{' '}
                    <strong>{recordedPh !== '' ? recordedPh : 'Not recorded'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Moist:</span>{' '}
                    <strong>
                      {recordedMoisture !== '' ? `${recordedMoisture}%` : 'Not recorded'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!isActive && (
                  <button
                    onClick={() => setActiveFarm(farm)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Set as Active Plot
                  </button>
                )}
                <button
                  onClick={() => handleOpenEditFarm(farm)}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  <Edit size={14} />
                  Edit Farm
                </button>
                <button
                  onClick={() => handleOpenSoil(farm)}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  <Sparkles size={14} />
                  Update Soil Metrics
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFarm(farm)}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, color: '#fca5a5' }}
                  disabled={deletingFarmId !== null}
                  aria-label={`Delete ${farm.farmName}`}
                >
                  <Trash2 size={14} />
                  {deletingFarmId === farm._id ? 'Deleting...' : 'Delete Farm'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Farm Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Farm Parcel</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-group">
                <label className="form-label">Farm / Plot Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. North Canal Plot B"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Total Acreage</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="form-input"
                    value={formData.totalArea}
                    onChange={(e) => setFormData({ ...formData, totalArea: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Area Unit</label>
                  <div className="form-input">Acres</div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Soil Type</label>
                  <select
                    className="form-select"
                    value={formData.soilType}
                    onChange={(e) => setFormData({ ...formData, soilType: e.target.value })}
                  >
                    <option value="black">Black Soil (Regur)</option>
                    <option value="alluvial">Alluvial Soil</option>
                    <option value="red">Red Soil</option>
                    <option value="laterite">Laterite Soil</option>
                    <option value="sandy">Sandy Loam</option>
                    <option value="clay">Clayey Soil</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Irrigation Source</label>
                  <select
                    className="form-select"
                    value={formData.irrigationSource}
                    onChange={(e) => setFormData({ ...formData, irrigationSource: e.target.value })}
                  >
                    <option value="other">Borewell</option>
                    <option value="canal">Canal Irrigation</option>
                    <option value="drip">Drip Irrigation</option>
                    <option value="sprinkler">Sprinkler System</option>
                    <option value="other">River Lift</option>
                    <option value="rainfed">Rainfed (No artificial)</option>
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Primary Crop</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.primaryCrop}
                    onChange={(e) => setFormData({ ...formData, primaryCrop: e.target.value })}
                    placeholder="e.g. Cotton, Rice, Maize"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Village / Taluk</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    placeholder="e.g. Pedavadlapudi"
                  />
                </div>
              </div>

              {createError && (
                <div className="alert" role="alert" style={{ color: '#fca5a5', marginTop: '0.75rem' }}>
                  {createError}
                </div>
              )}

              <div className="modal-footer" style={{ padding: '1rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Farm Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Edit Farm Details</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedFarmForEdit?.farmName || selectedFarmForEdit?.name}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFarm} className="modal-body">
              <div className="form-group">
                <label className="form-label">Farm Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editFormData.farmName}
                  onChange={(e) => setEditFormData({ ...editFormData, farmName: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Area (acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="form-input"
                    value={editFormData.area}
                    onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Soil Type</label>
                  <select
                    className="form-select"
                    value={editFormData.soilType}
                    onChange={(e) => setEditFormData({ ...editFormData, soilType: e.target.value })}
                  >
                    <option value="black">Black Soil</option>
                    <option value="alluvial">Alluvial Soil</option>
                    <option value="red">Red Soil</option>
                    <option value="laterite">Laterite Soil</option>
                    <option value="sandy">Sandy Loam</option>
                    <option value="clay">Clay Soil</option>
                    <option value="loamy">Loamy Soil</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Crop</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.currentCrop}
                    onChange={(e) => setEditFormData({ ...editFormData, currentCrop: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Soil Parameters Modal */}
      {showSoilModal && (
        <div className="modal-overlay" onClick={() => setShowSoilModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Update Soil Test Values</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Farm: {selectedFarmForSoil?.farmName || selectedFarmForSoil?.name}
                </p>
              </div>
              <button
                onClick={() => setShowSoilModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSoil} className="modal-body">
              {soilSaveError && (
                <div className="alert" role="alert">
                  {soilSaveError}
                </div>
              )}
              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nitrogen (N) - kg/ha</label>
                  <input
                    type="number"
                    className="form-input"
                    value={soilFormData.nitrogen}
                    onChange={(e) => setSoilFormData({ ...soilFormData, nitrogen: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phosphorus (P) - kg/ha</label>
                  <input
                    type="number"
                    className="form-input"
                    value={soilFormData.phosphorus}
                    onChange={(e) => setSoilFormData({ ...soilFormData, phosphorus: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Potassium (K) - kg/ha</label>
                  <input
                    type="number"
                    className="form-input"
                    value={soilFormData.potassium}
                    onChange={(e) => setSoilFormData({ ...soilFormData, potassium: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Soil pH (0 - 14)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={soilFormData.ph}
                    onChange={(e) => setSoilFormData({ ...soilFormData, ph: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Organic Carbon (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={soilFormData.organicCarbon}
                    onChange={(e) => setSoilFormData({ ...soilFormData, organicCarbon: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Soil Moisture (%)</label>
                  <input
                    type="number"
                    step="1"
                    className="form-input"
                    value={soilFormData.moisture}
                    onChange={(e) => setSoilFormData({ ...soilFormData, moisture: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setShowSoilModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Soil Values
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmManagement;

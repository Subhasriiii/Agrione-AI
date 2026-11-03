import React, { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { advisoryApi } from '../api/advisoryApi';
import {
  Bug,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Droplets,
  Layers,
  Thermometer,
} from 'lucide-react';

const DiseaseDetection = () => {
  const { activeFarm } = useFarm();
  const [activeTab, setActiveTab] = useState('vision'); // 'vision' | 'risk'

  // Vision State
  const [cropName, setCropName] = useState(activeFarm?.primaryCrop || 'Cotton');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState('');

  // Early Risk State
  const [riskInputs, setRiskInputs] = useState({
    cropName: activeFarm?.primaryCrop || 'Cotton',
    temperature: 28,
    humidity: 84,
    rainfall: 120,
    daysOfContinuousRain: 3,
  });

  const [riskResult, setRiskResult] = useState({
    riskLevel: 'High',
    riskScore: 78,
    potentialDiseases: [
      'Fungal Anthracnose & Leaf Spot',
      'Rhizoctonia Root Rot / Wet Foot',
    ],
    weatherFactors: 'Sustained humidity >80% with 3 consecutive rain days creates optimal spore germination conditions.',
    preventiveMeasures: [
      'Ensure proper drainage channels in field furrows immediately.',
      'Prophylactic spray of Mancozeb 75 WP @ 2 g/L before next rain event.',
      'Avoid high dose nitrogenous top-dressing until weather clears.',
    ],
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDiagnosisResult(null);
      setDiagnosisError('');
    }
  };

  const handleDiagnose = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setDiagnosisError('Please upload a plant leaf image to begin disease analysis.');
      return;
    }

    setDiagnosing(true);
    setDiagnosisError('');
    setDiagnosisResult(null);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('cropName', cropName);
      if (activeFarm?._id) formData.append('farmId', activeFarm._id);

      const res = await advisoryApi.detectDisease(formData);
      if (res?.analysis && typeof res.analysis === 'object') {
        setDiagnosisResult(res.analysis);
      } else {
        setDiagnosisError('Disease analysis returned no result. Please try again.');
      }
    } catch (err) {
      setDiagnosisError(err.message || 'Unable to analyze this image right now. Please try again.');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleCalculateRisk = async (e) => {
    e.preventDefault();
    try {
      const res = await advisoryApi.getDiseaseRisk(riskInputs);
      if (res?.riskAnalysis) {
        setRiskResult(res.riskAnalysis);
      }
    } catch (err) {
      console.warn('Using baseline risk assessment');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Crop Health & <span className="gradient-text">Disease Diagnosis</span>
          </h1>
          <p className="page-subtitle">
            Instant leaf pathology scanning with AI Vision + proactive early disease outbreak forecasting.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="tab-container">
          <button
            onClick={() => setActiveTab('vision')}
            className={`tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
          >
            <Bug size={15} />
            Leaf Photo Scan
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`tab-btn ${activeTab === 'risk' ? 'active' : ''}`}
          >
            <ShieldAlert size={15} />
            Early Weather Risk Forecast
          </button>
        </div>
      </div>

      {activeTab === 'vision' ? (
        <div className="grid-split-2-1">
          {/* Uploader Card */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div className="card-title-bar">
              <div className="card-title">
                <Upload size={20} style={{ color: '#34d399' }} />
                Upload Affected Leaf Photo
              </div>
              <span className="badge badge-purple">AI Computer Vision</span>
            </div>

            <form onSubmit={handleDiagnose}>
              <div className="form-group">
                <label className="form-label">Crop Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder="e.g. Cotton, Tomato, Rice, Chilli"
                />
              </div>

              <div
                style={{
                  border: '2px dashed var(--border-accent)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.02)',
                  cursor: 'pointer',
                  marginBottom: '1.5rem',
                }}
                onClick={() => document.getElementById('leafImageInput').click()}
              >
                <input
                  id="leafImageInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
                <Bug size={40} style={{ color: '#f87171', margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  {imageFile ? imageFile.name : 'Click or Drop Leaf Image Here'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Take a clear, close-up photo in daylight for 90%+ accuracy
                </div>
              </div>

              {previewUrl && (
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <img
                    src={previewUrl}
                    alt="Leaf preview"
                    style={{
                      maxHeight: 220,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={diagnosing}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Sparkles size={16} />
                {diagnosing ? 'Scanning Leaf Patterns...' : 'Diagnose Plant Health'}
              </button>
            </form>
          </div>

          {/* Diagnosis Result Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              {diagnosisError ? (
                <div role="alert" style={{ color: '#f87171' }}>
                  {diagnosisError}
                </div>
              ) : !diagnosisResult ? (
                <div style={{ color: 'var(--text-secondary)' }}>
                  Upload a plant leaf image to begin disease analysis.
                </div>
              ) : diagnosisResult.modelStatus === 'not_deployed' ? (
                <div role="status" style={{ color: 'var(--text-secondary)' }}>
                  Disease detection model is not yet deployed.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Pathology Report
                      </div>
                      <h3 style={{ fontSize: '1.4rem', color: diagnosisResult.isHealthy ? '#34d399' : '#f87171', marginTop: '0.2rem' }}>
                        {diagnosisResult.isHealthy ? 'Healthy Plant Foliage' : diagnosisResult.diseaseName}
                      </h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {diagnosisResult.confidence != null && (
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
                          {diagnosisResult.confidence}%
                        </div>
                      )}
                      {diagnosisResult.riskLevel && (
                        <span className={`badge ${diagnosisResult.riskLevel === 'High' ? 'badge-danger' : 'badge-warning'}`}>
                          {diagnosisResult.riskLevel} Risk
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Symptoms */}
                  {Array.isArray(diagnosisResult.symptoms) && diagnosisResult.symptoms.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        OBSERVED SYMPTOMS
                      </div>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {diagnosisResult.symptoms.map((s, idx) => (
                          <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 3 }} />
                            <span>{typeof s === 'string' ? s : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {Array.isArray(diagnosisResult.recommendations) && diagnosisResult.recommendations.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                        TREATMENT & MITIGATION PROTOCOL
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {diagnosisResult.recommendations.map((rec, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.75rem',
                              borderRadius: 'var(--radius-md)',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {typeof rec === 'object' && rec?.type && (
                              <span className="badge badge-info" style={{ fontSize: '0.65rem', marginBottom: '0.25rem' }}>
                                {rec.type}
                              </span>
                            )}
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                              {typeof rec === 'string' ? rec : rec?.action}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Early Disease Risk Warning Tab */
        <div className="grid-split-2-1">
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div className="card-title-bar">
              <div className="card-title">
                <ShieldAlert size={20} style={{ color: '#f59e0b' }} />
                Weather & Microclimate Vulnerability
              </div>
            </div>

            <form onSubmit={handleCalculateRisk}>
              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Active Crop</label>
                  <input
                    type="text"
                    className="form-input"
                    value={riskInputs.cropName}
                    onChange={(e) => setRiskInputs({ ...riskInputs, cropName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Temp (°C)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={riskInputs.temperature}
                    onChange={(e) => setRiskInputs({ ...riskInputs, temperature: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid-3" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Humidity (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={riskInputs.humidity}
                    onChange={(e) => setRiskInputs({ ...riskInputs, humidity: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Recent Rain (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={riskInputs.rainfall}
                    onChange={(e) => setRiskInputs({ ...riskInputs, rainfall: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consecutive Wet Days</label>
                  <input
                    type="number"
                    className="form-input"
                    value={riskInputs.daysOfContinuousRain}
                    onChange={(e) => setRiskInputs({ ...riskInputs, daysOfContinuousRain: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '0.5rem' }}>
                <Sparkles size={16} />
                Recalculate Early Outbreak Risk
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Disease Outbreak Probability
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#f87171', fontFamily: 'var(--font-heading)' }}>
                {riskResult.riskScore}%
              </div>
              <span className="badge badge-danger">{riskResult.riskLevel} Outbreak Risk</span>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 8 }}>
              {riskResult.weatherFactors}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                PROPHYLACTIC PREVENTIONS
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {riskResult.preventiveMeasures.map((m, idx) => (
                  <li key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseDetection;

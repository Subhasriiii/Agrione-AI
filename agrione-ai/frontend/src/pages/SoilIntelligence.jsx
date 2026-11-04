import React, { useEffect, useRef, useState } from 'react';
import { useFarm } from '../context/FarmContext';
import { soilApi } from '../api/soilApi';
import {
  FlaskConical,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  Leaf,
} from 'lucide-react';

const SoilIntelligence = () => {
  const { activeFarm, updateSoil } = useFarm();

  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'ocr'
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [ocrError, setOcrError] = useState('');

  const [soilInputs, setSoilInputs] = useState({
    nitrogen: activeFarm?.soilData?.nitrogen ?? '',
    phosphorus: activeFarm?.soilData?.phosphorus ?? '',
    potassium: activeFarm?.soilData?.potassium ?? '',
    ph: activeFarm?.soilData?.ph ?? '',
    organicCarbon: activeFarm?.soilData?.organicCarbon ?? '',
    moisture: activeFarm?.soilData?.moisture ?? '',
    soilType: activeFarm?.soilType || 'other',
  });
  const editedFields = useRef(new Set());
  const previousFarmId = useRef(null);

  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    if (!activeFarm?._id) return;

    if (previousFarmId.current !== activeFarm._id) {
      if (previousFarmId.current !== null) {
        editedFields.current.clear();
      }
      previousFarmId.current = activeFarm._id;
    }

    const farmInputs = {
      nitrogen: activeFarm.soilData?.nitrogen ?? '',
      phosphorus: activeFarm.soilData?.phosphorus ?? '',
      potassium: activeFarm.soilData?.potassium ?? '',
      ph: activeFarm.soilData?.ph ?? '',
      organicCarbon: activeFarm.soilData?.organicCarbon ?? '',
      moisture: activeFarm.soilData?.moisture ?? '',
      soilType: activeFarm.soilType || 'other',
    };

    setSoilInputs((current) => {
      let changed = false;
      const next = { ...current };
      Object.entries(farmInputs).forEach(([field, value]) => {
        if (!editedFields.current.has(field) && current[field] !== value) {
          next[field] = value;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [activeFarm]);

  const handleInputChange = (field, value) => {
    editedFields.current.add(field);
    setSoilInputs((current) => ({ ...current, [field]: value }));
    setAnalysisResult(null);
    setAnalysisError('');
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setAnalysisError('');
    setAnalysisResult(null);
    setLoading(true);
    try {
      const res = await soilApi.analyzeSoil({
        farmId: activeFarm?._id,
        ...soilInputs,
        pH: soilInputs.ph,
      });
      if (
        !res?.analysis ||
        !Number.isFinite(res.analysis.healthScore) ||
        typeof res.analysis.healthStatus !== 'string' ||
        !Array.isArray(res.analysis.nutrients) ||
        !Array.isArray(res.analysis.suitableCrops) ||
        !Array.isArray(res.analysis.recommendations) ||
        !Array.isArray(res.analysis.irrigationNotes)
      ) {
        throw new Error(res?.message || 'The soil analysis service returned an unexpected response.');
      }
      setAnalysisResult(res.analysis);
      // Update farm state
      if (activeFarm?._id) {
        try {
          const saveResult = await updateSoil(activeFarm._id, { ...soilInputs, ph: Number(soilInputs.ph) });
          if (!saveResult?.success) {
            setAnalysisError(`Analysis completed, but soil values could not be saved to this farm: ${saveResult?.message || 'Please try again.'}`);
          }
        } catch (saveError) {
          setAnalysisError(`Analysis completed, but soil values could not be saved to this farm: ${saveError.message || 'Please try again.'}`);
        }
      }
    } catch (error) {
      setAnalysisResult(null);
      setAnalysisError(error.message || 'Soil analysis failed. Check the values and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleOcrExtract = async () => {
    if (!selectedFile) return;
    setOcrError('');
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('soilReport', selectedFile);

      const res = await soilApi.extractOCR(formData);
      if (res?.extractedData) {
        const ext = res.extractedData;
        const extracted = {
          nitrogen: ext.nitrogen,
          phosphorus: ext.phosphorus,
          potassium: ext.potassium,
          ph: ext.ph ?? ext.pH,
          organicCarbon: ext.organicCarbon,
        };
        if (!Object.values(extracted).some((value) => value !== undefined && value !== null && value !== '')) {
          setOcrError('No soil values could be read from this image.');
          return;
        }
        setSoilInputs((prev) => ({
          ...prev,
          nitrogen: extracted.nitrogen ?? prev.nitrogen,
          phosphorus: extracted.phosphorus ?? prev.phosphorus,
          potassium: extracted.potassium ?? prev.potassium,
          ph: extracted.ph ?? prev.ph,
          organicCarbon: extracted.organicCarbon ?? prev.organicCarbon,
        }));
        setAnalysisResult(null);
        setActiveTab('manual');
      } else {
        setOcrError(res?.message || 'No soil values could be read from this image.');
      }
    } catch (error) {
      setOcrError(error.message || 'Unable to read the soil card. Please check the image and try again.');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            Soil Health & <span className="gradient-text">OCR Intelligence</span>
          </h1>
          <p className="page-subtitle">
            Review soil-test values and receive general, educational soil guidance.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="tab-container">
          <button
            onClick={() => setActiveTab('manual')}
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          >
            <FlaskConical size={15} />
            Test Parameters
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`tab-btn ${activeTab === 'ocr' ? 'active' : ''}`}
          >
            <Upload size={15} />
            Scan Soil Card (OCR)
          </button>
        </div>
      </div>

      <div className="grid-split-2-1">
        {/* Left: Input Form or OCR Uploader */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          {analysisError && (
            <div role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>
              <AlertTriangle size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
              {analysisError}
            </div>
          )}
          {ocrError && activeTab === 'ocr' && (
            <div role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>
              <AlertTriangle size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
              {ocrError}
            </div>
          )}
          {activeTab === 'manual' ? (
            <form onSubmit={handleAnalyze}>
              <div className="card-title-bar">
                <div className="card-title">
                  <Layers size={20} style={{ color: '#34d399' }} />
                  Soil Test Inputs for {activeFarm?.name}
                </div>
                <span className="badge badge-success">Rule-based screening</span>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Nitrogen (N, kg/ha)
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use your soil report value</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="5000"
                    required
                    value={soilInputs.nitrogen}
                    onChange={(e) => handleInputChange('nitrogen', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Phosphorus (P, kg/ha)
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use your soil report value</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="5000"
                    required
                    value={soilInputs.phosphorus}
                    onChange={(e) => handleInputChange('phosphorus', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Potassium (K, kg/ha)
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use your soil report value</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="5000"
                    required
                    value={soilInputs.potassium}
                    onChange={(e) => handleInputChange('potassium', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Soil pH Level
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valid range: 0 - 14</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    min="0"
                    max="14"
                    required
                    value={soilInputs.ph}
                    onChange={(e) => handleInputChange('ph', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 0, gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Organic Carbon (%) - optional
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not included in this analysis</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    min="0"
                    value={soilInputs.organicCarbon}
                    onChange={(e) => handleInputChange('organicCarbon', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Soil Moisture (%)
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required: 0 - 100%</span>
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="100"
                    required
                    value={soilInputs.moisture}
                    onChange={(e) => handleInputChange('moisture', e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <Sparkles size={16} />
                  {loading ? 'Evaluating Fertility...' : 'Run Soil Health Diagnostics'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="card-title-bar">
                <div className="card-title">
                  <FileText size={20} style={{ color: '#38bdf8' }} />
                  Scan Soil Health Card (OCR Extractor)
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Upload a photo or scan of a soil-test report. The OCR service will attempt to extract values it can recognize.
              </p>

              <div
                style={{
                  border: '2px dashed var(--border-accent)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.03)',
                  cursor: 'pointer',
                  marginBottom: '1.5rem',
                }}
                onClick={() => document.getElementById('soilCardInput').click()}
              >
                <input
                  id="soilCardInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Upload size={38} style={{ color: '#34d399', margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  {selectedFile ? selectedFile.name : 'Click to select Soil Card Image'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Supports PNG, JPG, JPEG up to 10MB
                </div>
              </div>

              {previewUrl && (
                <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Soil card preview"
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
                type="button"
                disabled={!selectedFile || ocrLoading}
                onClick={handleOcrExtract}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Sparkles size={16} />
                {ocrLoading ? 'Scanning with Tesseract OCR...' : 'Extract & Populate Soil Values'}
              </button>
            </div>
          )}
        </div>

        {/* Right: results from the soil analysis API */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {analysisResult ? (
            <>
              <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Overall Soil Health Score
                </div>
                <div
                  style={{
                    fontSize: '3.5rem',
                    fontWeight: 800,
                    color: '#34d399',
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1,
                    marginBottom: '0.5rem',
                  }}
                >
                  {analysisResult.healthScore}
                  <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/100</span>
                </div>
                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                  {analysisResult.healthStatus}
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div className="card-title-bar">
                  <div className="card-title">
                    <Layers size={18} style={{ color: '#10b981' }} />
                    Nutrient and Soil Indicators
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {analysisResult.nutrients.map((nutrient, index) => (
                    <div
                      key={`${nutrient.name}-${index}`}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <strong>{nutrient.name}</strong>
                        <span>{nutrient.value} - {nutrient.status}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        {nutrient.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div className="card-title-bar">
                  <div className="card-title">
                    <Leaf size={18} style={{ color: '#10b981' }} />
                    Suitable Crops
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {analysisResult.suitableCrops.map((crop, index) => (
                    <span className="badge badge-success" key={`${crop}-${index}`}>{crop}</span>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div className="card-title-bar">
                  <div className="card-title">
                    <Sparkles size={18} style={{ color: '#38bdf8' }} />
                    General Recommendations
                  </div>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: 0 }}>
                  {analysisResult.recommendations.map((recommendation, index) => (
                    <li
                      key={index}
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
                {analysisResult.irrigationNotes.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Irrigation notes</strong>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: 0 }}>
                      {analysisResult.irrigationNotes.map((note, index) => (
                        <li key={index} style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {analysisResult.disclaimer || 'This is general educational guidance, not a trained ML prediction or a substitute for professional soil-test advice.'}
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FlaskConical size={32} style={{ color: '#34d399', marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>No soil analysis yet</div>
              <div style={{ fontSize: '0.9rem' }}>
                Enter soil test measurements and run the analysis to see results here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoilIntelligence;

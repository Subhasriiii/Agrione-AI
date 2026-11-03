const { analyzeImage, calculateDiseaseRisk } = require('../ml/disease_detection/service');
const DiseaseAnalysis = require('../models/DiseaseAnalysis');
const Farm = require('../models/Farm');
const mongoose = require('mongoose');

function isHealthyPrediction(predictedClass) {
  const normalizedClass = predictedClass.replace(/[_-]+/g, ' ');
  return /\bhealthy\b/i.test(normalizedClass);
}

// Image-based disease detection
exports.detectDisease = async (req, res) => {
  const cropName = req.body.cropName || '';
  const imagePath = req.file ? req.file.path : '';

  if (!imagePath) {
    return res.status(400).json({ success: false, message: 'Please upload a crop/leaf image.' });
  }

  const farmId = req.body.farmId;
  if (farmId) {
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      return res.status(400).json({ success: false, message: 'Invalid farm ID.' });
    }

    try {
      const farm = await Farm.findOne({ _id: farmId, owner: req.user._id });
      if (!farm) {
        return res.status(404).json({ success: false, message: 'Farm not found.' });
      }
    } catch (error) {
      console.error('Farm ownership check failed during disease analysis:', error);
      return res.status(500).json({ success: false, message: 'Disease analysis failed.' });
    }
  }

  let result;
  try {
    result = await analyzeImage(cropName, req.file);
  } catch (error) {
    console.error('Disease inference service failed:', error);
    if (error instanceof RangeError) {
      return res.status(413).json({ success: false, message: error.message });
    }
    if (error instanceof TypeError) {
      return res.status(415).json({ success: false, message: error.message });
    }
    if (error.message.includes('timed out')) {
      return res.status(504).json({ success: false, message: 'Disease inference service timed out.' });
    }
    return res.status(502).json({ success: false, message: 'Disease inference service failed.' });
  }

  if (
    !result ||
    !['predicted', 'uncertain'].includes(result.model_status) ||
    typeof result.confidence !== 'number' ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 1 ||
    !Array.isArray(result.top_predictions) ||
    typeof result.disclaimer !== 'string' ||
    (result.model_status === 'predicted' &&
      (typeof result.predicted_class !== 'string' || typeof result.disease_name !== 'string'))
  ) {
    console.error('Disease inference service returned an invalid prediction result.');
    return res.status(502).json({ success: false, message: 'Disease inference service returned an invalid result.' });
  }

  const isPredicted = result.model_status === 'predicted';
  const analysis = {
    isHealthy: isPredicted ? isHealthyPrediction(result.predicted_class) : null,
    diseaseName: isPredicted ? result.disease_name : 'Uncertain prediction',
    confidence: result.confidence * 100,
    riskLevel: null,
    symptoms: null,
    recommendations: [],
    availableDiseases: [],
    modelStatus: result.model_status,
    disclaimer: result.disclaimer,
    modelVersion: result.model_version,
    topPredictions: result.top_predictions,
  };

  try {
    await DiseaseAnalysis.create({
      user: req.user._id,
      farm: farmId || undefined,
      imagePath,
      cropName: cropName || result.crop || '',
      isHealthy: analysis.isHealthy,
      diseaseName: analysis.diseaseName,
      confidence: analysis.confidence,
      riskLevel: null,
      recommendations: [],
      isBaseline: false,
      modelStatus: analysis.modelStatus,
    });

    return res.json({ success: true, analysis });
  } catch (error) {
    console.error('Failed to save disease analysis:', error);
    res.status(500).json({ success: false, message: 'Disease analysis failed.' });
  }
};

// Early warning disease risk
exports.getDiseaseRisk = async (req, res) => {
  try {
    const result = calculateDiseaseRisk(req.body);
    res.json({ success: true, riskAnalysis: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Disease risk calculation failed.' });
  }
};

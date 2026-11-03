const mongoose = require('mongoose');

const diseaseAnalysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  imagePath: { type: String, default: '' },
  cropName: { type: String, default: '' },
  isHealthy: { type: Boolean, default: true },
  diseaseName: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'none'], default: 'none' },
  recommendations: [{ type: String }],
  isBaseline: { type: Boolean, default: true },
  modelStatus: { type: String, default: 'not_configured' },
}, { timestamps: true });

module.exports = mongoose.model('DiseaseAnalysis', diseaseAnalysisSchema);

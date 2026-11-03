const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  type: {
    type: String,
    enum: ['crop_recommendation', 'yield_prediction', 'risk_assessment', 'irrigation', 'profit_estimation', 'disease_risk', 'simulation'],
    required: true,
  },
  inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  result: { type: mongoose.Schema.Types.Mixed, default: {} },
  confidence: { type: Number, default: 0 },
  isBaseline: { type: Boolean, default: true }, // true = rule-based, false = trained model
  modelStatus: { type: String, default: 'not_configured' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Prediction', predictionSchema);

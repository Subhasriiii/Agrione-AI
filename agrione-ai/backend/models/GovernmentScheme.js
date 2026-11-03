const mongoose = require('mongoose');

const governmentSchemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  eligibility: { type: String, default: '' },
  benefits: { type: String, default: '' },
  category: { type: String, enum: ['subsidy', 'insurance', 'loan', 'training', 'market', 'equipment', 'other'], default: 'other' },
  targetFarmers: { type: String, default: 'All farmers' },
  state: { type: String, default: 'All India' },
  applicationUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('GovernmentScheme', governmentSchemeSchema);

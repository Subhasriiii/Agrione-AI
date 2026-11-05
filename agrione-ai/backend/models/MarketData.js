const mongoose = require('mongoose');

const marketDataSchema = new mongoose.Schema({
  crop: { type: String, required: true },
  market: { type: String, required: true },
  price: { type: Number, required: true },
  unit: { type: String, default: 'per quintal' },
  source: { type: String, trim: true },
  location: { type: String, default: '' },
  state: { type: String, default: '' },
  priceDate: { type: Date },
  minPrice: { type: Number, default: 0 },
  maxPrice: { type: Number, default: 0 },
  isIndicative: { type: Boolean, default: true }, // Clearly marks as indicative, not live
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('MarketData', marketDataSchema);

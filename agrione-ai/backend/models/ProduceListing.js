const mongoose = require('mongoose');

const produceListingSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cropName: { type: String, required: true },
  quantity: { type: Number, required: true },
  quantityUnit: { type: String, default: 'kg' },
  expectedPrice: { type: Number, required: true },
  priceUnit: { type: String, default: 'per kg' },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  contactMethod: { type: String, enum: ['phone', 'email', 'both'], default: 'phone' },
  imagePath: { type: String, default: '' },
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ProduceListing', produceListingSchema);

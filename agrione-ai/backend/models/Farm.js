const mongoose = require('mongoose');

const soilDataSchema = new mongoose.Schema({
  nitrogen: { type: Number, default: 0 },
  phosphorus: { type: Number, default: 0 },
  potassium: { type: Number, default: 0 },
  pH: { type: Number, default: 7.0 },
  moisture: { type: Number, default: 0 },
  organicCarbon: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const farmSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmName: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  area: { type: Number, default: 0 }, // in acres
  soilType: { type: String, enum: ['alluvial', 'black', 'red', 'laterite', 'sandy', 'clay', 'loamy', 'other'], default: 'loamy' },
  currentCrop: { type: String, default: '' },
  cropSeason: { type: String, enum: ['kharif', 'rabi', 'zaid', 'whole_year', ''], default: '' },
  irrigationType: { type: String, enum: ['drip', 'sprinkler', 'flood', 'rainfed', 'canal', 'other', ''], default: '' },
  soilData: { type: soilDataSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Farm', farmSchema);

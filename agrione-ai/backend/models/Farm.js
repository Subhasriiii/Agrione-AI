const mongoose = require('mongoose');

const measurementProvenanceSchema = new mongoose.Schema({
  recordedAt: { type: Date, required: true },
  source: { type: String, enum: ['farmer-entered'], required: true },
}, { _id: false });

const soilDataSchema = new mongoose.Schema({
  nitrogen: { type: Number, default: undefined },
  phosphorus: { type: Number, default: undefined },
  potassium: { type: Number, default: undefined },
  pH: { type: Number, default: undefined },
  moisture: { type: Number, default: undefined },
  organicCarbon: { type: Number, default: undefined },
  measurementProvenance: {
    nitrogen: { type: measurementProvenanceSchema, default: undefined },
    phosphorus: { type: measurementProvenanceSchema, default: undefined },
    potassium: { type: measurementProvenanceSchema, default: undefined },
    pH: { type: measurementProvenanceSchema, default: undefined },
    moisture: { type: measurementProvenanceSchema, default: undefined },
    organicCarbon: { type: measurementProvenanceSchema, default: undefined },
  },
  updatedAt: { type: Date, default: undefined },
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

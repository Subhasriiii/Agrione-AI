const Farm = require('../models/Farm');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const DiseaseAnalysis = require('../models/DiseaseAnalysis');
const Notification = require('../models/Notification');

const editableFarmFields = [
  'farmName',
  'location',
  'area',
  'soilType',
  'currentCrop',
  'cropSeason',
  'irrigationType',
];
const soilMeasurementFields = ['nitrogen', 'phosphorus', 'potassium', 'pH', 'moisture', 'organicCarbon'];

const pickFields = (source, fields) => {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  return Object.fromEntries(
    fields.filter((field) => Object.prototype.hasOwnProperty.call(input, field))
      .map((field) => [field, input[field]])
  );
};

// Create Farm
exports.createFarm = async (req, res) => {
  try {
    const farmData = { ...pickFields(req.body, editableFarmFields), owner: req.user._id };
    const farm = await Farm.create(farmData);

    // Add farm to user's farms list
    await User.findByIdAndUpdate(req.user._id, { $push: { farms: farm._id } });

    res.status(201).json({ success: true, message: 'Farm created successfully!', farm });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create farm.' });
  }
};

// Get all farms for user
exports.getFarms = async (req, res) => {
  try {
    const farms = await Farm.find({ owner: req.user._id }).sort('-createdAt');
    res.json({ success: true, farms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch farms.' });
  }
};

// Get single farm
exports.getFarm = async (req, res) => {
  try {
    const farm = await Farm.findOne({ _id: req.params.id, owner: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    res.json({ success: true, farm });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch farm.' });
  }
};

// Update Farm
exports.updateFarm = async (req, res) => {
  try {
    const farm = await Farm.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      pickFields(req.body, editableFarmFields),
      { new: true, runValidators: true }
    );
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });
    res.json({ success: true, message: 'Farm updated!', farm });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update farm.' });
  }
};

// Update Soil Data
exports.updateSoilData = async (req, res) => {
  try {
    const input = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body
      : {};
    const unexpectedFields = Object.keys(input).filter((field) => !soilMeasurementFields.includes(field));
    if (unexpectedFields.length > 0) {
      return res.status(400).json({ success: false, message: 'Unexpected soil measurement field.' });
    }

    const measurements = {};
    for (const field of soilMeasurementFields) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
      const rawValue = input[field];
      if ((typeof rawValue !== 'number' && typeof rawValue !== 'string') ||
        (typeof rawValue === 'string' && rawValue.trim() === '')) {
        return res.status(400).json({ success: false, message: `Invalid ${field} soil measurement.` });
      }
      const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(value) || (field === 'pH' && (value < 0 || value > 14)) ||
        (field === 'moisture' && (value < 0 || value > 100)) ||
        (['nitrogen', 'phosphorus', 'potassium', 'organicCarbon'].includes(field) && value < 0)) {
        return res.status(400).json({ success: false, message: `Invalid ${field} soil measurement.` });
      }
      measurements[field] = value;
    }
    if (Object.keys(measurements).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one soil measurement is required.' });
    }

    const farm = await Farm.findOne({ _id: req.params.id, owner: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });

    const soilData = farm.soilData.toObject();
    const measurementProvenance = soilData.measurementProvenance || {};
    const recordedAt = new Date();
    for (const [field, value] of Object.entries(measurements)) {
      soilData[field] = value;
      measurementProvenance[field] = { recordedAt, source: 'farmer-entered' };
    }
    soilData.measurementProvenance = measurementProvenance;
    soilData.updatedAt = recordedAt;
    farm.soilData = soilData;
    await farm.save();
    res.json({ success: true, message: 'Soil data updated!', farm });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update soil data.' });
  }
};

// Delete Farm
exports.deleteFarm = async (req, res) => {
  try {
    const farmFilter = { _id: req.params.id, owner: req.user._id };
    const farm = await Farm.findOne(farmFilter);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });

    const [predictionCount, diseaseAnalysisCount, notificationCount] = await Promise.all([
      Prediction.countDocuments({ farm: farm._id }),
      DiseaseAnalysis.countDocuments({ farm: farm._id }),
      Notification.countDocuments({ farm: farm._id }),
    ]);

    if (predictionCount + diseaseAnalysisCount + notificationCount > 0) {
      return res.status(409).json({
        success: false,
        message: `This farm cannot be deleted because it is referenced by ${predictionCount} prediction(s), ${diseaseAnalysisCount} disease analysis record(s), and ${notificationCount} notification(s).`,
      });
    }

    const deletedFarm = await Farm.findOneAndDelete(farmFilter);
    if (!deletedFarm) return res.status(404).json({ success: false, message: 'Farm not found.' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { farms: deletedFarm._id } });
    res.json({ success: true, message: 'Farm deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete farm.' });
  }
};

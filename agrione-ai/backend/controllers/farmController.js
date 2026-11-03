const Farm = require('../models/Farm');
const User = require('../models/User');

// Create Farm
exports.createFarm = async (req, res) => {
  try {
    const farmData = { ...req.body, owner: req.user._id };
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
      req.body,
      { new: true }
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
    const farm = await Farm.findOne({ _id: req.params.id, owner: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });

    farm.soilData = { ...farm.soilData.toObject(), ...req.body, updatedAt: new Date() };
    await farm.save();
    res.json({ success: true, message: 'Soil data updated!', farm });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update soil data.' });
  }
};

// Delete Farm
exports.deleteFarm = async (req, res) => {
  try {
    const farm = await Farm.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found.' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { farms: farm._id } });
    res.json({ success: true, message: 'Farm deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete farm.' });
  }
};

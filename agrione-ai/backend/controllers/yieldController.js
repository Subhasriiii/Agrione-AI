const { predictYield } = require('../ml/yield_prediction/service');
const { CROP_DATABASE } = require('../ml/crop_recommendation/service');
const Prediction = require('../models/Prediction');

exports.predict = async (req, res) => {
  const body = req.body || {};
  const crop = typeof body.crop === 'string' ? body.crop.trim().toLowerCase() : '';

  if (!crop) {
    return res.status(400).json({ success: false, message: 'Crop is required.' });
  }
  if (!Object.hasOwn(CROP_DATABASE, crop)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported crop. Choose one of: ${Object.keys(CROP_DATABASE).join(', ')}.`,
    });
  }

  const farmAreaValue = typeof body.farmArea === 'string' ? body.farmArea.trim() : body.farmArea;
  const farmArea = Number(farmAreaValue);
  if (
    (typeof farmAreaValue !== 'number' && typeof farmAreaValue !== 'string')
    || farmAreaValue === ''
    || !Number.isFinite(farmArea)
    || farmArea <= 0
    || farmArea > 1000000
  ) {
    return res.status(400).json({
      success: false,
      message: 'Farm area must be a positive number no greater than 1,000,000 acres.',
    });
  }

  const numericInputs = [
    { field: 'nitrogen', min: 0, max: 300 },
    { field: 'phosphorus', min: 0, max: 200 },
    { field: 'potassium', min: 0, max: 300 },
    { field: 'pH', min: 0, max: 14 },
    { field: 'rainfall', min: 0, max: 10000 },
    { field: 'temperature', min: -50, max: 60 },
  ];
  const inputs = { ...body, crop, farmArea };
  delete inputs.cropName;
  delete inputs.area;

  for (const { field, min, max } of numericInputs) {
    const rawValue = body[field];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      delete inputs[field];
      continue;
    }

    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    const numericValue = Number(value);
    if (
      (typeof value !== 'number' && typeof value !== 'string')
      || value === ''
      || !Number.isFinite(numericValue)
      || numericValue < min
      || numericValue > max
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} must be a finite number between ${min} and ${max}.`,
      });
    }
    inputs[field] = numericValue;
  }

  if (inputs.irrigationType !== undefined && typeof inputs.irrigationType !== 'string') {
    return res.status(400).json({ success: false, message: 'Irrigation type must be text.' });
  }

  let result;
  try {
    result = predictYield(inputs);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Yield estimate could not be calculated.' });
  }

  try {
    await Prediction.create({
      user: req.user._id,
      farm: inputs.farmId || undefined,
      type: 'yield_prediction',
      inputs,
      result,
      confidence: null,
      isBaseline: true,
      modelStatus: 'rule_based',
    });

    res.json({ success: true, prediction: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Yield estimate could not be saved to history.' });
  }
};

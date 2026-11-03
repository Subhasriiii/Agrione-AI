const { getIrrigationAdvice } = require('../ml/irrigation/service');
const Prediction = require('../models/Prediction');

exports.getAdvice = async (req, res) => {
  const body = req.body || {};
  const crop = typeof body.crop === 'string' ? body.crop.trim().toLowerCase() : '';

  if (!crop) {
    return res.status(400).json({ success: false, message: 'Crop is required for irrigation advice.' });
  }

  const numericInputs = [
    { field: 'soilMoisture', required: true, min: 0, max: 100 },
    { field: 'temperature', required: false, min: -50, max: 60 },
    { field: 'humidity', required: false, min: 0, max: 100 },
    { field: 'rainfall', required: false, min: 0, max: Number.POSITIVE_INFINITY },
  ];
  const inputs = { ...body, crop };

  for (const { field, required, min, max } of numericInputs) {
    const rawValue = body[field];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (required) {
        return res.status(400).json({
          success: false,
          message: `A soil moisture reading is required to calculate irrigation advice.`,
        });
      }
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
        message: `${field} must be ${Number.isFinite(max) ? `a finite number between ${min} and ${max}` : `a finite number ${min} or greater`}.`,
      });
    }
    inputs[field] = numericValue;
  }

  if (inputs.growthStage !== undefined && typeof inputs.growthStage !== 'string') {
    return res.status(400).json({ success: false, message: 'Growth stage must be text.' });
  }

  let result;
  try {
    result = getIrrigationAdvice(inputs);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Irrigation advice could not be calculated.' });
  }

  try {
    await Prediction.create({
      user: req.user._id,
      farm: inputs.farmId || undefined,
      type: 'irrigation',
      inputs,
      result,
      isBaseline: true,
      modelStatus: 'rule_based',
    });

    res.json({ success: true, irrigation: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Irrigation advice was calculated but could not be saved to history.' });
  }
};

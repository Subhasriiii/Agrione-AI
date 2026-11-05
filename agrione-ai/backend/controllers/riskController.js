const { assessRisk } = require('../ml/risk_assessment/service');

const numericFields = {
  temperature: { min: -50, max: 60, required: true },
  humidity: { min: 0, max: 100, required: true },
  rainfall: { min: 0, max: 10000, required: true },
  soilMoisture: { min: 0, max: 100 },
  pH: { min: 0, max: 14 },
  nitrogen: { min: 0, max: 300 },
  phosphorus: { min: 0, max: 200 },
  potassium: { min: 0, max: 300 },
};
const irrigationTypes = ['rainfed', 'drip', 'sprinkler', 'flood', 'canal', 'other'];
const diseaseRiskLevels = ['low', 'medium', 'high'];

exports.assess = async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const allowedFields = [...Object.keys(numericFields), 'irrigationType', 'diseaseRisk'];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ success: false, message: 'Unexpected risk assessment input.' });
  }

  const inputs = {};
  for (const [field, { min, max, required }] of Object.entries(numericFields)) {
    const rawValue = body[field];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (required) {
        return res.status(400).json({ success: false, message: `${field} is required.` });
      }
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

  if (body.irrigationType !== undefined && body.irrigationType !== '') {
    if (typeof body.irrigationType !== 'string' || !irrigationTypes.includes(body.irrigationType)) {
      return res.status(400).json({ success: false, message: 'Invalid irrigation type.' });
    }
    inputs.irrigationType = body.irrigationType;
  }

  if (body.diseaseRisk !== undefined && body.diseaseRisk !== '') {
    if (typeof body.diseaseRisk !== 'string' || !diseaseRiskLevels.includes(body.diseaseRisk)) {
      return res.status(400).json({ success: false, message: 'Disease risk must be low, medium, or high.' });
    }
    inputs.diseaseRisk = body.diseaseRisk;
  }

  try {
    const result = assessRisk(inputs);
    res.json({ success: true, risk: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Risk assessment failed.' });
  }
};

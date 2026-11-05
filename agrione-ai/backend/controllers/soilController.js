const validateNumber = (value, field, min, max) => {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return `${field} is required.`;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    return `${field} must be a valid number.`;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return `${field} must be a valid number.`;
  if (number < min || number > max) {
    return `${field} must be between ${min} and ${max}.`;
  }
  return null;
};

exports.analyzeSoil = async (req, res) => {
  const { pH: pHInput, ph: phInput, nitrogen, phosphorus, potassium, moisture, soilType } = req.body || {};
  const pH = pHInput !== undefined && pHInput !== null && pHInput !== ''
    ? pHInput
    : phInput;
  const validationErrors = [
    validateNumber(pH, 'pH', 0, 14),
    validateNumber(nitrogen, 'Nitrogen', 0, 5000),
    validateNumber(phosphorus, 'Phosphorus', 0, 5000),
    validateNumber(potassium, 'Potassium', 0, 5000),
    validateNumber(moisture, 'Moisture', 0, 100),
  ].filter(Boolean);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: validationErrors.join(' '),
    });
  }

  const values = {
    pH: Number(pH),
    nitrogen: Number(nitrogen),
    phosphorus: Number(phosphorus),
    potassium: Number(potassium),
    moisture: Number(moisture),
  };
  const validSoilTypes = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'clay', 'loamy', 'other'];
  const normalizedSoilType = typeof soilType === 'string' && validSoilTypes.includes(soilType)
    ? soilType
    : 'other';

  try {
    const factors = [];
  try {
    const { soilType } = req.body;
    const fields = ['pH', 'nitrogen', 'phosphorus', 'potassium', 'moisture'];
    const invalidField = fields.find((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '' || !Number.isFinite(Number(value));
    });
    if (invalidField) {
      return res.status(400).json({
        success: false,
        message: `A valid numeric value is required for ${invalidField}.`,
      });
    }

    const { pH, nitrogen, phosphorus, potassium, moisture } = Object.fromEntries(
      fields.map((field) => [field, Number(req.body[field])])
    );

    // Soil health analysis
    const health = { score: 0, maxScore: 100, factors: [] };
    let totalScore = 0;

    if (values.pH >= 6.0 && values.pH <= 7.5) {
      totalScore += 25;
      factors.push({ name: 'pH', status: 'Good', value: values.pH, detail: 'Within a commonly suitable range for many crops.' });
    } else if (values.pH >= 5.5 && values.pH <= 8.0) {
      totalScore += 15;
      factors.push({ name: 'pH', status: 'Fair', value: values.pH, detail: 'Some crops may be affected; suitability depends on crop and local soil conditions.' });
    } else {
      totalScore += 5;
      factors.push({ name: 'pH', status: 'Needs attention', value: values.pH, detail: 'Check crop-specific guidance and consult a soil specialist about possible amendments.' });
    }

    if (values.nitrogen >= 50) {
      totalScore += 20;
      factors.push({ name: 'Nitrogen', status: 'Good', value: values.nitrogen, detail: 'The entered value is within the higher range used by this general screening rule.' });
    } else if (values.nitrogen >= 25) {
      totalScore += 12;
      factors.push({ name: 'Nitrogen', status: 'Medium', value: values.nitrogen, detail: 'Consider crop needs and the units and method used in the soil test.' });
    } else {
      totalScore += 5;
      factors.push({ name: 'Nitrogen', status: 'Low', value: values.nitrogen, detail: 'Review nitrogen needs with crop-specific guidance or a soil professional.' });
    }

    if (values.phosphorus >= 30) {
      totalScore += 20;
      factors.push({ name: 'Phosphorus', status: 'Good', value: values.phosphorus, detail: 'The entered value is within the higher range used by this general screening rule.' });
    } else if (values.phosphorus >= 15) {
      totalScore += 12;
      factors.push({ name: 'Phosphorus', status: 'Medium', value: values.phosphorus, detail: 'Consider crop needs and the units and method used in the soil test.' });
    } else {
      totalScore += 5;
      factors.push({ name: 'Phosphorus', status: 'Low', value: values.phosphorus, detail: 'Review phosphorus needs with crop-specific guidance or a soil professional.' });
    }

    if (values.potassium >= 30) {
      totalScore += 20;
      factors.push({ name: 'Potassium', status: 'Good', value: values.potassium, detail: 'The entered value is within the higher range used by this general screening rule.' });
    } else if (values.potassium >= 15) {
      totalScore += 12;
      factors.push({ name: 'Potassium', status: 'Medium', value: values.potassium, detail: 'Consider crop needs and the units and method used in the soil test.' });
    } else {
      totalScore += 5;
      factors.push({ name: 'Potassium', status: 'Low', value: values.potassium, detail: 'Review potassium needs with crop-specific guidance or a soil professional.' });
    }

    if (values.moisture >= 40 && values.moisture <= 70) {
      totalScore += 15;
      factors.push({ name: 'Moisture', status: 'Good', value: values.moisture, detail: 'Within the broad moisture range used by this general screening rule.' });
    } else if (values.moisture > 70) {
      totalScore += 8;
      factors.push({ name: 'Moisture', status: 'High', value: values.moisture, detail: 'Check field drainage and crop-specific moisture requirements.' });
    } else {
      totalScore += 8;
      factors.push({ name: 'Moisture', status: 'Low', value: values.moisture, detail: 'Compare with crop needs and local irrigation guidance.' });
    }

    let healthStatus = 'Needs attention';
    if (totalScore >= 80) healthStatus = 'Excellent';
    else if (totalScore >= 60) healthStatus = 'Good';
    else if (totalScore >= 40) healthStatus = 'Fair';

    const suitableCrops = getSuitableCrops(
      values.pH,
      values.nitrogen,
      values.phosphorus,
      values.potassium,
      normalizedSoilType
    );

    const recommendations = [];
    if (values.pH < 6.0 || values.pH > 8.0) {
      recommendations.push('Review pH management options with a soil-testing professional before applying amendments.');
    }
    if (values.nitrogen < 30) {
      recommendations.push("Compare the soil test with the selected crop's nitrogen needs and local extension guidance.");
    }
    if (values.phosphorus < 20) {
      recommendations.push('Review phosphorus availability and crop requirements with local soil-test guidance.');
    }
    if (values.potassium < 20) {
      recommendations.push('Review potassium availability and crop requirements with local soil-test guidance.');
    }
    if (values.moisture < 30) {
      recommendations.push('Check crop water needs and local irrigation guidance; consider soil-cover practices that may reduce evaporation.');
    }
    if (values.moisture > 80) {
      recommendations.push('Check field drainage and recent irrigation or rainfall conditions.');
    }
    recommendations.push('Use current soil-test methods, crop needs, and local agricultural advice when making nutrient decisions.');

    const irrigationNotes = [];
    if (normalizedSoilType === 'sandy') irrigationNotes.push('Sandy soils often drain quickly; check field moisture more frequently.');
    if (normalizedSoilType === 'clay') irrigationNotes.push('Clay soils often retain water longer; check moisture and drainage before irrigating.');
    if (normalizedSoilType === 'loamy') irrigationNotes.push('Loamy soils vary; base irrigation timing on crop needs and field moisture.');
    if (values.moisture < 40) irrigationNotes.push("The entered moisture is below this screening rule's broad reference range.");
    if (values.moisture > 70) irrigationNotes.push("The entered moisture is above this screening rule's broad reference range.");

    return res.json({
      success: true,
      analysis: {
        healthScore: totalScore,
        healthStatus,
        nutrients: factors,
        suitableCrops,
        recommendations,
        irrigationNotes,
        analysisType: 'rule-based screening',
        disclaimer: 'This general rule-based screening is educational and is not a trained ML prediction or a substitute for crop-specific soil-test advice.',
      },
    });
  } catch (error) {
    console.error(`Soil analysis failed: ${error.message}`);
    console.error('Soil analysis failed:', error);
    return res.status(500).json({ success: false, message: 'Soil analysis failed. Please try again.' });
  }
};

function getSuitableCrops(pH, nitrogen, phosphorus, potassium, soilType) {
  const crops = [];
  if (pH >= 5.5 && pH <= 7.0 && nitrogen >= 60) crops.push('Rice');
  if (pH >= 6.0 && pH <= 7.5) crops.push('Wheat');
  if (soilType === 'loamy' || soilType === 'alluvial') crops.push('Maize');
  if (soilType === 'black') crops.push('Cotton');
  if (nitrogen >= 40 && pH >= 6.0) crops.push('Tomato');
  if (pH >= 5.5 && pH <= 6.5) crops.push('Potato');
  if (soilType === 'sandy' || soilType === 'loamy') crops.push('Groundnut');
  if (pH >= 6.0 && pH <= 7.5) crops.push('Onion');
  if (crops.length === 0) crops.push('No crop match in this general rule set');
  return crops.slice(0, 6);
}

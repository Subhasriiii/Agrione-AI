/**
 * Smart Irrigation Service
 * 
 * Recommends irrigation based on soil moisture, crop needs, and weather.
 */

const CROP_WATER_NEEDS = {
  rice: { optimal: [70, 90], critical: 60, type: 'high' },
  wheat: { optimal: [45, 65], critical: 35, type: 'medium' },
  maize: { optimal: [50, 70], critical: 40, type: 'medium' },
  cotton: { optimal: [45, 65], critical: 35, type: 'medium' },
  sugarcane: { optimal: [65, 85], critical: 55, type: 'high' },
  groundnut: { optimal: [40, 60], critical: 30, type: 'low' },
  tomato: { optimal: [55, 75], critical: 45, type: 'medium' },
  potato: { optimal: [60, 80], critical: 50, type: 'medium' },
  onion: { optimal: [50, 70], critical: 40, type: 'medium' },
  chickpea: { optimal: [30, 50], critical: 20, type: 'low' },
  soybean: { optimal: [45, 65], critical: 35, type: 'medium' },
  default: { optimal: [50, 70], critical: 40, type: 'medium' },
};

function getIrrigationAdvice(inputs) {
  const { soilMoisture, crop, temperature, humidity, rainfall, growthStage } = inputs;

  const cropKey = crop?.toLowerCase() || 'default';
  const hasCropSpecificNeeds = Object.hasOwn(CROP_WATER_NEEDS, cropKey) && cropKey !== 'default';
  const waterNeeds = hasCropSpecificNeeds ? CROP_WATER_NEEDS[cropKey] : CROP_WATER_NEEDS.default;
  const moisture = soilMoisture;

  let irrigationRequired = false;
  let priority = 'none';
  const reasons = [];
  const recommendations = [];

  if (!hasCropSpecificNeeds) {
    reasons.push('No crop-specific threshold is configured; the service default moisture range is being used.');
  }

  // Check soil moisture vs crop needs
  if (moisture < waterNeeds.critical) {
    irrigationRequired = true;
    priority = 'high';
    reasons.push(`Soil moisture (${moisture}%) is below critical level (${waterNeeds.critical}%) for ${crop || 'crop'}`);
  } else if (moisture < waterNeeds.optimal[0]) {
    irrigationRequired = true;
    priority = 'medium';
    reasons.push(`Soil moisture (${moisture}%) is below optimal range (${waterNeeds.optimal[0]}-${waterNeeds.optimal[1]}%)`);
  } else if (moisture >= waterNeeds.optimal[0] && moisture <= waterNeeds.optimal[1]) {
    reasons.push('Soil moisture is within optimal range');
  } else {
    reasons.push('Soil moisture is adequate or high — avoid overwatering');
  }

  // Weather factors
  if (rainfall !== undefined && rainfall > 20) {
    if (irrigationRequired && priority !== 'high') {
      irrigationRequired = false;
      priority = 'low';
      reasons.push('Significant rainfall expected — irrigation may not be needed');
    }
  } else if (rainfall === undefined) {
    reasons.push('Rainfall forecast was not provided; the moisture recommendation was not adjusted for rain.');
  }

  if (temperature !== undefined && temperature > 35) {
    if (irrigationRequired) priority = 'high';
    reasons.push('High temperature increases water evaporation');
    recommendations.push('Consider irrigating during early morning or late evening to reduce evaporation');
  } else if (temperature === undefined) {
    reasons.push('Temperature was not provided; no temperature adjustment was applied.');
  }

  if (humidity !== undefined && humidity < 30) {
    reasons.push('Low humidity increases crop water stress');
  } else if (humidity === undefined) {
    reasons.push('Humidity was not provided; no humidity adjustment was applied.');
  }

  // Growth stage
  if (growthStage === 'flowering' || growthStage === 'fruiting') {
    if (irrigationRequired) priority = 'high';
    reasons.push(`${growthStage} stage requires consistent moisture`);
  }

  // Water-saving recommendations
  recommendations.push('Use mulching to reduce soil moisture evaporation');
  if (waterNeeds.type !== 'high') {
    recommendations.push('Consider drip irrigation for water efficiency');
  }
  if (moisture > waterNeeds.optimal[1]) {
    recommendations.push('Reduce irrigation — excess water can cause root rot');
  }

  return {
    irrigationRequired,
    priority,
    currentMoisture: moisture,
    optimalRange: waterNeeds.optimal,
    criticalLevel: waterNeeds.critical,
    reasons,
    recommendations,
    cropWaterType: waterNeeds.type,
    modelStatus: 'rule_based',
    assumptions: [
      hasCropSpecificNeeds
        ? 'Crop moisture thresholds are fixed values in this rule-based service, not a trained model output.'
        : 'No crop-specific threshold is configured; the service default moisture range was used.',
      'Rainfall above 20 mm is treated as significant by the existing rule; the forecast time period is not specified.',
      'No irrigation volume or next-irrigation date is calculated.',
    ],
    disclaimer: 'Verify this rule-based advisory against current field measurements, local soil conditions, crop guidance, and the actual rainfall forecast.',
  };
}

module.exports = { getIrrigationAdvice };

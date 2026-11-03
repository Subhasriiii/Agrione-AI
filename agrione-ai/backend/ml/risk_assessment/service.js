/**
 * Risk Assessment Service
 * 
 * Multi-factor risk analysis for farming operations.
 * Evaluates weather, soil, disease, water, and yield risks.
 */

function assessRisk(inputs) {
  const { temperature, humidity, rainfall, soilMoisture, pH, nitrogen, phosphorus, potassium, crop, irrigationType, diseaseRisk } = inputs;

  const risks = {};

  // Weather Risk
  let weatherScore = 0;
  const weatherFactors = [];
  if (temperature > 40) { weatherScore += 40; weatherFactors.push('Extreme heat stress'); }
  else if (temperature > 35) { weatherScore += 20; weatherFactors.push('High temperature'); }
  else if (temperature < 5) { weatherScore += 35; weatherFactors.push('Frost risk'); }

  if (rainfall > 200) { weatherScore += 30; weatherFactors.push('Flood risk from heavy rainfall'); }
  else if (rainfall < 20) { weatherScore += 25; weatherFactors.push('Drought conditions'); }

  if (humidity > 90) { weatherScore += 15; weatherFactors.push('Very high humidity'); }
  risks.weather = { score: Math.min(weatherScore, 100), level: riskLevel(weatherScore), factors: weatherFactors };

  // Soil Risk
  let soilScore = 0;
  const soilFactors = [];
  if (pH !== undefined && (pH < 5.0 || pH > 8.5)) { soilScore += 30; soilFactors.push('Extreme soil pH'); }
  else if (pH !== undefined && (pH < 5.5 || pH > 8.0)) { soilScore += 15; soilFactors.push('Sub-optimal soil pH'); }

  if (nitrogen !== undefined && nitrogen < 20) { soilScore += 15; soilFactors.push('Low nitrogen'); }
  if (phosphorus !== undefined && phosphorus < 10) { soilScore += 15; soilFactors.push('Low phosphorus'); }
  if (potassium !== undefined && potassium < 10) { soilScore += 15; soilFactors.push('Low potassium'); }
  risks.soil = { score: Math.min(soilScore, 100), level: riskLevel(soilScore), factors: soilFactors };

  // Disease Risk
  let diseaseScore = 0;
  const diseaseFactors = [];
  if (humidity > 80 && temperature > 25) { diseaseScore += 30; diseaseFactors.push('Conditions favor fungal diseases'); }
  if (rainfall > 100) { diseaseScore += 20; diseaseFactors.push('Excess moisture promotes disease'); }
  if (diseaseRisk === 'high') { diseaseScore += 30; diseaseFactors.push('Previously identified high disease risk'); }
  risks.disease = { score: Math.min(diseaseScore, 100), level: riskLevel(diseaseScore), factors: diseaseFactors };

  // Water Risk
  let waterScore = 0;
  const waterFactors = [];
  if (soilMoisture !== undefined && soilMoisture < 20) { waterScore += 35; waterFactors.push('Very low soil moisture'); }
  else if (soilMoisture !== undefined && soilMoisture < 40) { waterScore += 15; waterFactors.push('Below-average soil moisture'); }
  if (irrigationType === 'rainfed' && rainfall < 50) { waterScore += 25; waterFactors.push('Rainfed with low rainfall'); }
  if (soilMoisture !== undefined && soilMoisture > 90) { waterScore += 20; waterFactors.push('Waterlogging risk'); }
  risks.water = { score: Math.min(waterScore, 100), level: riskLevel(waterScore), factors: waterFactors };

  // Yield Risk (derived from other risks)
  const yieldScore = Math.round((risks.weather.score * 0.3 + risks.soil.score * 0.25 + risks.disease.score * 0.25 + risks.water.score * 0.2));
  const yieldFactors = [];
  if (yieldScore > 40) yieldFactors.push('Multiple risk factors may reduce yield');
  else if (yieldScore > 20) yieldFactors.push('Some risk factors present');
  else yieldFactors.push('Overall conditions favorable for expected yield');
  risks.yield = { score: Math.min(yieldScore, 100), level: riskLevel(yieldScore), factors: yieldFactors };

  // Overall Risk
  const overallScore = Math.round((risks.weather.score + risks.soil.score + risks.disease.score + risks.water.score + risks.yield.score) / 5);
  risks.overall = { score: overallScore, level: riskLevel(overallScore) };

  return risks;
}

function riskLevel(score) {
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

module.exports = { assessRisk };

/**
 * Yield Prediction Service (Baseline / Prototype)
 * 
 * Estimates crop yield based on soil, climate, and farming inputs.
 * Uses lookup-based baseline with adjustment factors.
 * 
 * Replace with a trained regression model for production accuracy.
 */

const { CROP_DATABASE } = require('../crop_recommendation/service');

function predictYield(inputs) {
  const { crop, farmArea, nitrogen, pH, rainfall, temperature, irrigationType } = inputs;

  const cropData = CROP_DATABASE[crop.toLowerCase()];
  const baseYield = cropData.yieldPerAcre;
  const cropName = cropData.name;
  
  let adjustmentFactor = 1.0;
  const factors = [];

  // Nitrogen effect
  if (nitrogen !== undefined) {
    if (cropData && nitrogen >= cropData.N[0] && nitrogen <= cropData.N[1]) {
      adjustmentFactor *= 1.05;
      factors.push({ factor: 'Nitrogen', impact: 'positive', detail: 'Nitrogen within optimal range' });
    } else if (nitrogen < 30) {
      adjustmentFactor *= 0.8;
      factors.push({ factor: 'Nitrogen', impact: 'negative', detail: 'Low nitrogen may reduce yield' });
    }
  }

  // pH effect
  if (pH !== undefined) {
    if (pH >= 6.0 && pH <= 7.5) {
      adjustmentFactor *= 1.03;
      factors.push({ factor: 'Soil pH', impact: 'positive', detail: 'pH in favorable range' });
    } else if (pH < 5.0 || pH > 8.5) {
      adjustmentFactor *= 0.75;
      factors.push({ factor: 'Soil pH', impact: 'negative', detail: 'Extreme pH may significantly reduce yield' });
    }
  }

  // Rainfall effect
  if (rainfall !== undefined) {
    if (cropData && rainfall >= cropData.rainfall[0] && rainfall <= cropData.rainfall[1]) {
      adjustmentFactor *= 1.05;
      factors.push({ factor: 'Rainfall', impact: 'positive', detail: 'Adequate rainfall for crop' });
    } else if (rainfall < 30) {
      adjustmentFactor *= 0.7;
      factors.push({ factor: 'Rainfall', impact: 'negative', detail: 'Low rainfall may stress crop' });
    } else if (rainfall > 250) {
      adjustmentFactor *= 0.8;
      factors.push({ factor: 'Rainfall', impact: 'negative', detail: 'Excess rainfall may cause waterlogging' });
    }
  }

  // Irrigation boost
  if (irrigationType && irrigationType !== 'rainfed') {
    adjustmentFactor *= 1.1;
    factors.push({ factor: 'Irrigation', impact: 'positive', detail: `${irrigationType} irrigation improves water availability` });
  }

  // Temperature effect
  if (temperature !== undefined && cropData) {
    if (temperature >= cropData.temp[0] && temperature <= cropData.temp[1]) {
      adjustmentFactor *= 1.03;
      factors.push({ factor: 'Temperature', impact: 'positive', detail: 'Temperature in optimal range' });
    } else {
      adjustmentFactor *= 0.85;
      factors.push({ factor: 'Temperature', impact: 'negative', detail: 'Temperature outside optimal range for crop' });
    }
  }

  const yieldPerAcre = Math.round(baseYield * adjustmentFactor * 10) / 10;
  const totalExpectedYield = Math.round(yieldPerAcre * farmArea * 10) / 10;

  return {
    crop: cropName,
    predictedYieldPerAcre: yieldPerAcre,
    totalExpectedYield,
    unit: 'quintals',
    farmArea,
    factors,
    adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
    modelStatus: 'rule_based',
    disclaimer: 'This is a rule-based estimate using fixed crop-yield lookup values and adjustment heuristics, not a trained ML prediction. Verify it against local historical yields and field conditions.',
  };
}

module.exports = { predictYield };

/**
 * Disease Detection Service
 *
 * This module provides a clear integration point for a real vision model.
 * At the moment, no trained classifier is deployed in this repository,
 * so predictions are intentionally withheld rather than fabricated.
 */

const DISEASE_DATABASE = {
  rice: [
    { name: 'Rice Blast', symptoms: 'Diamond-shaped lesions on leaves', risk: 'high', prevention: ['Use resistant varieties', 'Avoid excess nitrogen', 'Maintain proper drainage'] },
    { name: 'Brown Spot', symptoms: 'Brown oval spots on leaves', risk: 'medium', prevention: ['Balanced fertilization', 'Seed treatment', 'Proper spacing'] },
    { name: 'Bacterial Leaf Blight', symptoms: 'Yellow to white lesions along leaf veins', risk: 'high', prevention: ['Use resistant varieties', 'Avoid injury to plants', 'Proper water management'] },
  ],
  wheat: [
    { name: 'Wheat Rust', symptoms: 'Orange-brown pustules on leaves', risk: 'high', prevention: ['Use resistant varieties', 'Timely sowing', 'Fungicide application'] },
    { name: 'Powdery Mildew', symptoms: 'White powdery coating on leaves', risk: 'medium', prevention: ['Adequate spacing', 'Avoid excess nitrogen', 'Fungicide spray'] },
  ],
  tomato: [
    { name: 'Early Blight', symptoms: 'Dark concentric rings on lower leaves', risk: 'medium', prevention: ['Crop rotation', 'Remove infected leaves', 'Mulching'] },
    { name: 'Late Blight', symptoms: 'Water-soaked lesions, white mold under leaves', risk: 'high', prevention: ['Avoid overhead watering', 'Fungicide application', 'Proper spacing'] },
    { name: 'Leaf Curl', symptoms: 'Upward curling and yellowing of leaves', risk: 'medium', prevention: ['Control whitefly', 'Use resistant varieties', 'Neem oil spray'] },
  ],
  potato: [
    { name: 'Late Blight', symptoms: 'Dark water-soaked patches on leaves', risk: 'high', prevention: ['Fungicide spray', 'Destroy infected tubers', 'Use certified seeds'] },
    { name: 'Early Blight', symptoms: 'Dark brown spots with concentric rings', risk: 'medium', prevention: ['Crop rotation', 'Balanced fertilization', 'Fungicide'] },
  ],
  cotton: [
    { name: 'Cotton Leaf Curl', symptoms: 'Upward curling, thickening of leaves', risk: 'high', prevention: ['Control whitefly', 'Resistant varieties', 'Timely sowing'] },
    { name: 'Boll Rot', symptoms: 'Discolored, rotting bolls', risk: 'medium', prevention: ['Proper drainage', 'Balanced fertilizer', 'Spacing'] },
  ],
  maize: [
    { name: 'Fall Armyworm', symptoms: 'Irregular holes in leaves, frass in whorl', risk: 'high', prevention: ['Early detection', 'Biological control', 'Neem-based pesticide'] },
    { name: 'Northern Leaf Blight', symptoms: 'Long grayish-green lesions on leaves', risk: 'medium', prevention: ['Resistant varieties', 'Crop rotation', 'Tillage'] },
  ],
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const INFERENCE_TIMEOUT_MS = 15000;
const DEFAULT_INFERENCE_URL = 'http://127.0.0.1:8001/predict';
const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function isPredictionResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (
    value.success !== true ||
    (value.predicted_class !== null && typeof value.predicted_class !== 'string') ||
    (value.disease_name !== null && typeof value.disease_name !== 'string') ||
    (value.crop !== null && typeof value.crop !== 'string') ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    typeof value.model_version !== 'string' ||
    typeof value.model_status !== 'string' ||
    !Array.isArray(value.top_predictions) ||
    value.top_predictions.length < 1 ||
    value.top_predictions.length > 3 ||
    typeof value.disclaimer !== 'string'
  ) {
    return false;
  }
  return value.top_predictions.every((prediction) => (
    prediction &&
    typeof prediction === 'object' &&
    typeof prediction.class === 'string' &&
    typeof prediction.disease_name === 'string' &&
    typeof prediction.crop === 'string' &&
    typeof prediction.confidence === 'number' &&
    Number.isFinite(prediction.confidence) &&
    prediction.confidence >= 0 &&
    prediction.confidence <= 1
  ));
}

async function analyzeImage(cropName, uploadedFile) {
  if (!uploadedFile || typeof uploadedFile.path !== 'string' || !uploadedFile.path) {
    throw new TypeError('An uploaded image file with a disk path is required.');
  }

  const { stat, readFile } = require('fs/promises');
  const path = require('path');
  let fileInfo;
  try {
    fileInfo = await stat(uploadedFile.path);
  } catch (error) {
    throw new Error(`Could not access uploaded image: ${error.message}`, { cause: error });
  }
  if (!fileInfo.isFile()) {
    throw new TypeError('Uploaded image path does not reference a file.');
  }
  if (fileInfo.size === 0) {
    throw new TypeError('Uploaded image is empty.');
  }
  if (fileInfo.size > MAX_IMAGE_BYTES) {
    throw new RangeError('Uploaded image exceeds the 5 MB limit.');
  }

  const contentType = typeof uploadedFile.mimetype === 'string'
    ? uploadedFile.mimetype.toLowerCase()
    : '';
  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new TypeError('Unsupported image type. Use JPEG, PNG, GIF, or WebP.');
  }

  let image;
  try {
    image = await readFile(uploadedFile.path);
  } catch (error) {
    throw new Error(`Could not read uploaded image: ${error.message}`, { cause: error });
  }
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES) {
    throw new RangeError(
      image.length === 0
        ? 'Uploaded image is empty.'
        : 'Uploaded image exceeds the 5 MB limit.'
    );
  }

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([image], { type: contentType }),
    path.basename(uploadedFile.originalname || uploadedFile.path)
  );

  const inferenceUrl = process.env.DISEASE_INFERENCE_URL || DEFAULT_INFERENCE_URL;
  let response;
  try {
    response = await fetch(inferenceUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`Disease inference request timed out after ${INFERENCE_TIMEOUT_MS} ms.`, { cause: error });
    }
    throw new Error(`Could not reach the disease inference API: ${error.message}`, { cause: error });
  }

  let responseBody;
  try {
    responseBody = await response.text();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(`Disease inference request timed out after ${INFERENCE_TIMEOUT_MS} ms.`, { cause: error });
    }
    throw new Error(`Could not read the disease inference response: ${error.message}`, { cause: error });
  }
  let result;
  try {
    result = JSON.parse(responseBody);
  } catch (error) {
    if (!response.ok) {
      const detail = responseBody ? `: ${responseBody.slice(0, 500)}` : '';
      throw new Error(`Disease inference API returned HTTP ${response.status}${detail}`);
    }
    throw new Error('Disease inference API returned invalid JSON.', { cause: error });
  }

  if (!response.ok) {
    const detail = typeof result?.detail === 'string' ? `: ${result.detail}` : '';
    throw new Error(`Disease inference API returned HTTP ${response.status}${detail}`);
  }
  if (!isPredictionResponse(result)) {
    throw new Error('Disease inference API returned an invalid prediction response.');
  }

  return {
    success: result.success,
    predicted_class: result.predicted_class,
    disease_name: result.disease_name,
    crop: result.crop,
    confidence: result.confidence,
    model_version: result.model_version,
    model_status: result.model_status,
    top_predictions: result.top_predictions,
    disclaimer: result.disclaimer,
  };
}

/**
 * Calculate early warning disease risk based on environmental factors.
 * This is separate from image-based detection.
 */
function calculateDiseaseRisk(inputs) {
  const { crop, temperature, humidity, rainfall, soilMoisture, growthStage } = inputs;
  let riskScore = 0;
  const factors = [];

  // High humidity increases fungal disease risk
  if (humidity > 80) { riskScore += 25; factors.push('High humidity (>80%) increases fungal disease risk'); }
  else if (humidity > 65) { riskScore += 10; factors.push('Moderate humidity may support disease spread'); }

  // High temperature with high humidity
  if (temperature > 30 && humidity > 70) { riskScore += 20; factors.push('Warm and humid conditions favor disease development'); }

  // Excessive rainfall
  if (rainfall > 100) { riskScore += 20; factors.push('Heavy rainfall may cause waterlogging and root diseases'); }
  else if (rainfall > 60) { riskScore += 10; factors.push('Moderate rainfall may contribute to moisture-related diseases'); }

  // High soil moisture
  if (soilMoisture > 80) { riskScore += 15; factors.push('Saturated soil increases root rot risk'); }

  // Growth stage risk
  if (growthStage === 'flowering' || growthStage === 'fruiting') {
    riskScore += 10;
    factors.push(`${growthStage} stage is more susceptible to disease`);
  }

  let riskLevel = 'low';
  if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'medium';

  const suggestions = [];
  if (riskLevel === 'high') {
    suggestions.push('Inspect crops daily for disease symptoms');
    suggestions.push('Consider preventive fungicide application');
    suggestions.push('Ensure proper drainage to reduce waterlogging');
  } else if (riskLevel === 'medium') {
    suggestions.push('Monitor crops regularly for early symptoms');
    suggestions.push('Maintain proper spacing between plants');
    suggestions.push('Avoid excessive irrigation');
  } else {
    suggestions.push('Continue routine crop monitoring');
    suggestions.push('Maintain balanced fertilization');
  }

  const cropDiseases = DISEASE_DATABASE[crop?.toLowerCase()] || [];
  const commonThreats = cropDiseases.map(d => d.name);

  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    factors,
    suggestions,
    commonThreats,
    disclaimer: 'This is a disease RISK ESTIMATE based on environmental conditions, not a confirmed diagnosis.',
  };
}

module.exports = { analyzeImage, calculateDiseaseRisk, DISEASE_DATABASE };

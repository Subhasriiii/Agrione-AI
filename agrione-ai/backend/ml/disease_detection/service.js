
/**
 * Disease Detection Service
 *
 * Connects AgriOne AI to the trained MobileNetV3-Small
 * disease detection model hosted on Hugging Face Spaces.
 *
 * Environmental disease risk estimation remains separate
 * from image-based disease detection.
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
const HF_SPACE_ID = 'Subhasri999/agrione-disease-api';
const INFERENCE_TIMEOUT_MS = 120000;
const MIN_CONFIDENCE = 0.70;

const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

let gradioModulePromise;
let gradioClientPromise;

/**
 * Connect to the Hugging Face Gradio Space.
 * Reuse the client instead of reconnecting for every image.
 */
async function getGradioClient() {
  if (!gradioModulePromise) {
    gradioModulePromise = import('@gradio/client');
  }

  const gradio = await gradioModulePromise;

  if (!gradioClientPromise) {
    gradioClientPromise = gradio.Client.connect(HF_SPACE_ID).catch((error) => {
      gradioClientPromise = null;
      throw error;
    });
  }

  return {
    client: await gradioClientPromise,
    handle_file: gradio.handle_file,
  };
}

/**
 * Convert Gradio label output into a consistent prediction array.
 */
function extractPredictions(labelOutput, cropName) {
  let entries = [];

  if (Array.isArray(labelOutput?.confidences)) {
    entries = labelOutput.confidences;
  } else if (Array.isArray(labelOutput)) {
    entries = labelOutput;
  } else if (
    labelOutput &&
    typeof labelOutput === 'object' &&
    typeof labelOutput.label === 'string'
  ) {
    entries = labelOutput.confidences || [
      {
        label: labelOutput.label,
        confidence: labelOutput.confidence,
      },
    ];
  } else if (
    labelOutput &&
    typeof labelOutput === 'object'
  ) {
    entries = Object.entries(labelOutput).map(([label, confidence]) => ({
      label,
      confidence,
    }));
  }

  return entries
    .map((item) => {
      const label = typeof item.label === 'string' ? item.label : '';
      const confidence = Number(item.confidence);

      const match = label.match(/^(.*?)\s+\((.*?)\)$/);

      return {
        class: match ? match[1].trim() : label,
        disease_name: match ? match[1].trim() : label,
        crop: match ? match[2].trim() : (cropName || 'Unknown'),
        confidence,
      };
    })
    .filter((item) => (
      item.class &&
      Number.isFinite(item.confidence) &&
      item.confidence >= 0 &&
      item.confidence <= 1
    ))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Analyze an uploaded plant image using the Hugging Face model.
 */
async function analyzeImage(cropName, uploadedFile) {
  if (
    !uploadedFile ||
    typeof uploadedFile.path !== 'string' ||
    !uploadedFile.path
  ) {
    throw new TypeError('An uploaded image file with a disk path is required.');
  }

  const { stat, readFile } = require('fs/promises');

  let fileInfo;

  try {
    fileInfo = await stat(uploadedFile.path);
  } catch (error) {
    throw new Error(
      `Could not access uploaded image: ${error.message}`,
      { cause: error }
    );
  }

  if (!fileInfo.isFile() || fileInfo.size === 0) {
    throw new TypeError('Uploaded image is empty or invalid.');
  }

  if (fileInfo.size > MAX_IMAGE_BYTES) {
    throw new RangeError('Uploaded image exceeds the 5 MB limit.');
  }

  const contentType = typeof uploadedFile.mimetype === 'string'
    ? uploadedFile.mimetype.toLowerCase()
    : '';

  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new TypeError(
      'Unsupported image type. Use JPEG, PNG, GIF, or WebP.'
    );
  }

  let image;

  try {
    image = await readFile(uploadedFile.path);
  } catch (error) {
    throw new Error(
      `Could not read uploaded image: ${error.message}`,
      { cause: error }
    );
  }

  if (!image.length || image.length > MAX_IMAGE_BYTES) {
    throw new RangeError('Uploaded image is empty or exceeds the 5 MB limit.');
  }

  let result;

  try {
    const { client, handle_file } = await getGradioClient();

    const imageBlob = new Blob([image], {
  type: contentType,
});

const predictionPromise = client.predict('/predict', {
  image: handle_file(imageBlob),
});

    let timeoutId;

    try {
      result = await Promise.race([
        predictionPromise,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Disease inference timed out after ${INFERENCE_TIMEOUT_MS} ms.`
              )
            );
          }, INFERENCE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    throw new Error(
      `Could not get a prediction from Hugging Face: ${error.message}`,
      { cause: error }
    );
  }

  if (!Array.isArray(result?.data) || result.data.length < 3) {
    throw new Error('Hugging Face returned an unexpected response.');
  }

  const topPredictions = extractPredictions(
    result.data[1],
    cropName
  );

  if (topPredictions.length === 0) {
    throw new Error(
      'Hugging Face returned no valid disease predictions.'
    );
  }

  const best = topPredictions[0];
  const accepted = best.confidence >= MIN_CONFIDENCE;

  return {
    success: true,
    predicted_class: accepted ? best.class : null,
    disease_name: accepted ? best.disease_name : null,
    crop: accepted ? best.crop : null,
    confidence: best.confidence,
    model_version: 'V1',
    model_status: accepted ? 'predicted' : 'uncertain',
    top_predictions: topPredictions,
    disclaimer: typeof result.data[2] === 'string'
      ? result.data[2]
      : 'This is an AI prediction, not a confirmed plant disease diagnosis. The confidence score is not a guarantee of accuracy.',
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
  if (humidity > 80) {
    riskScore += 25;
    factors.push('High humidity (>80%) increases fungal disease risk');
  } else if (humidity > 65) {
    riskScore += 10;
    factors.push('Moderate humidity may support disease spread');
  }

  // High temperature with high humidity
  if (temperature > 30 && humidity > 70) {
    riskScore += 20;
    factors.push('Warm and humid conditions favor disease development');
  }

  // Excessive rainfall
  if (rainfall > 100) {
    riskScore += 20;
    factors.push('Heavy rainfall may cause waterlogging and root diseases');
  } else if (rainfall > 60) {
    riskScore += 10;
    factors.push('Moderate rainfall may contribute to moisture-related diseases');
  }

  // High soil moisture
  if (soilMoisture > 80) {
    riskScore += 15;
    factors.push('Saturated soil increases root rot risk');
  }

  // Growth stage risk
  if (growthStage === 'flowering' || growthStage === 'fruiting') {
    riskScore += 10;
    factors.push(`${growthStage} stage is more susceptible to disease`);
  }

  let riskLevel = 'low';

  if (riskScore >= 50) {
    riskLevel = 'high';
  } else if (riskScore >= 25) {
    riskLevel = 'medium';
  }

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
  const commonThreats = cropDiseases.map((d) => d.name);

  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    factors,
    suggestions,
    commonThreats,
    disclaimer: 'This is a disease RISK ESTIMATE based on environmental conditions, not a confirmed diagnosis.',
  };
}

module.exports = {
  analyzeImage,
  calculateDiseaseRisk,
  DISEASE_DATABASE,
};

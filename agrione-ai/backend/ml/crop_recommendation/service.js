/**
 * Crop Recommendation Service (Baseline / Prototype)
 * 
 * This uses a rule-based scoring system based on soil parameters,
 * climate conditions, and known crop requirements.
 * 
 * NOTE: This is a BASELINE implementation. Replace with a trained ML model
 * (e.g., Random Forest, XGBoost) for production accuracy.
 */

// Crop requirement database — based on general agricultural knowledge
const CROP_DATABASE = {
  rice: {
    name: 'Rice', season: ['kharif'], soilTypes: ['alluvial', 'clay', 'loamy'],
    N: [60, 120], P: [20, 60], K: [20, 60], pH: [5.5, 7.0],
    temp: [20, 35], humidity: [60, 95], rainfall: [100, 300],
    yieldPerAcre: 20, // quintals
    description: 'Staple cereal crop, requires standing water during growth.',
  },
  wheat: {
    name: 'Wheat', season: ['rabi'], soilTypes: ['alluvial', 'loamy', 'clay'],
    N: [80, 140], P: [30, 60], K: [20, 50], pH: [6.0, 7.5],
    temp: [10, 25], humidity: [40, 70], rainfall: [50, 100],
    yieldPerAcre: 18,
    description: 'Major rabi season cereal, prefers cool and dry climate.',
  },
  maize: {
    name: 'Maize', season: ['kharif', 'rabi'], soilTypes: ['loamy', 'alluvial', 'sandy'],
    N: [60, 120], P: [20, 50], K: [20, 50], pH: [5.5, 7.5],
    temp: [18, 32], humidity: [50, 80], rainfall: [60, 120],
    yieldPerAcre: 22,
    description: 'Versatile cereal crop grown in multiple seasons.',
  },
  cotton: {
    name: 'Cotton', season: ['kharif'], soilTypes: ['black', 'alluvial', 'loamy'],
    N: [40, 80], P: [20, 40], K: [20, 40], pH: [6.0, 8.0],
    temp: [25, 38], humidity: [40, 70], rainfall: [60, 120],
    yieldPerAcre: 8,
    description: 'Cash crop, needs warm climate and black soil.',
  },
  sugarcane: {
    name: 'Sugarcane', season: ['whole_year'], soilTypes: ['alluvial', 'loamy', 'clay'],
    N: [100, 200], P: [30, 60], K: [40, 80], pH: [6.0, 8.0],
    temp: [20, 38], humidity: [60, 90], rainfall: [100, 200],
    yieldPerAcre: 350,
    description: 'Perennial crop requiring ample water and nutrients.',
  },
  groundnut: {
    name: 'Groundnut', season: ['kharif', 'rabi'], soilTypes: ['sandy', 'loamy', 'red'],
    N: [10, 40], P: [20, 50], K: [20, 40], pH: [6.0, 7.5],
    temp: [22, 35], humidity: [40, 70], rainfall: [50, 100],
    yieldPerAcre: 8,
    description: 'Oilseed crop, prefers sandy and well-drained soil.',
  },
  soybean: {
    name: 'Soybean', season: ['kharif'], soilTypes: ['black', 'loamy', 'alluvial'],
    N: [10, 30], P: [30, 60], K: [20, 50], pH: [6.0, 7.5],
    temp: [20, 32], humidity: [50, 80], rainfall: [60, 120],
    yieldPerAcre: 10,
    description: 'High-protein oilseed, fixes nitrogen naturally.',
  },
  tomato: {
    name: 'Tomato', season: ['rabi', 'kharif'], soilTypes: ['loamy', 'sandy', 'red'],
    N: [80, 150], P: [40, 80], K: [40, 80], pH: [6.0, 7.0],
    temp: [18, 30], humidity: [50, 75], rainfall: [40, 80],
    yieldPerAcre: 80,
    description: 'High-value vegetable crop, needs moderate climate.',
  },
  potato: {
    name: 'Potato', season: ['rabi'], soilTypes: ['loamy', 'sandy', 'alluvial'],
    N: [80, 150], P: [40, 80], K: [60, 120], pH: [5.5, 6.5],
    temp: [12, 22], humidity: [60, 80], rainfall: [40, 80],
    yieldPerAcre: 80,
    description: 'Root vegetable, prefers cool climate and loose soil.',
  },
  onion: {
    name: 'Onion', season: ['rabi', 'kharif'], soilTypes: ['loamy', 'alluvial', 'red'],
    N: [60, 120], P: [30, 60], K: [40, 80], pH: [6.0, 7.5],
    temp: [15, 28], humidity: [50, 70], rainfall: [30, 70],
    yieldPerAcre: 60,
    description: 'Popular vegetable, grows well in fertile loamy soil.',
  },
  chickpea: {
    name: 'Chickpea (Chana)', season: ['rabi'], soilTypes: ['loamy', 'black', 'sandy'],
    N: [10, 30], P: [30, 60], K: [20, 40], pH: [6.0, 8.0],
    temp: [10, 25], humidity: [30, 60], rainfall: [30, 60],
    yieldPerAcre: 8,
    description: 'Pulse crop, drought-tolerant, fixes nitrogen.',
  },
  turmeric: {
    name: 'Turmeric', season: ['kharif'], soilTypes: ['loamy', 'alluvial', 'clay'],
    N: [60, 120], P: [20, 50], K: [40, 80], pH: [5.5, 7.5],
    temp: [20, 35], humidity: [60, 90], rainfall: [100, 200],
    yieldPerAcre: 25,
    description: 'Spice crop, needs warm and humid conditions.',
  },
  chilli: {
    name: 'Chilli', season: ['kharif', 'rabi'], soilTypes: ['loamy', 'sandy', 'black'],
    N: [60, 120], P: [30, 60], K: [30, 60], pH: [6.0, 7.5],
    temp: [20, 35], humidity: [50, 80], rainfall: [50, 100],
    yieldPerAcre: 15,
    description: 'Spice crop, widely grown across India.',
  },
  sunflower: {
    name: 'Sunflower', season: ['kharif', 'rabi'], soilTypes: ['black', 'loamy', 'alluvial'],
    N: [40, 80], P: [30, 60], K: [20, 40], pH: [6.0, 7.5],
    temp: [18, 30], humidity: [40, 70], rainfall: [40, 80],
    yieldPerAcre: 6,
    description: 'Oilseed crop, adapts to various soil types.',
  },
  mustard: {
    name: 'Mustard', season: ['rabi'], soilTypes: ['loamy', 'sandy', 'alluvial'],
    N: [40, 80], P: [20, 40], K: [10, 30], pH: [6.0, 7.5],
    temp: [10, 25], humidity: [40, 65], rainfall: [30, 60],
    yieldPerAcre: 6,
    description: 'Rabi oilseed crop, grows well in cool weather.',
  },
};

function scoreRange(value, [min, max]) {
  if (value >= min && value <= max) return 1.0;
  const mid = (min + max) / 2;
  const range = (max - min) / 2;
  const distance = Math.abs(value - mid);
  return Math.max(0, 1 - (distance / (range * 2)));
}

function recommend(inputs) {
  const { nitrogen, phosphorus, potassium, pH, temperature, humidity, rainfall, soilType, season } = inputs;
  
  const results = [];

  for (const [key, crop] of Object.entries(CROP_DATABASE)) {
    let score = 0;
    let maxScore = 0;
    const reasons = [];

    // Soil nutrient scoring
    if (nitrogen !== undefined) { score += scoreRange(nitrogen, crop.N) * 15; maxScore += 15; }
    if (phosphorus !== undefined) { score += scoreRange(phosphorus, crop.P) * 15; maxScore += 15; }
    if (potassium !== undefined) { score += scoreRange(potassium, crop.K) * 15; maxScore += 15; }
    if (pH !== undefined) { score += scoreRange(pH, crop.pH) * 10; maxScore += 10; }

    // Climate scoring
    if (temperature !== undefined) { score += scoreRange(temperature, crop.temp) * 15; maxScore += 15; }
    if (humidity !== undefined) { score += scoreRange(humidity, crop.humidity) * 10; maxScore += 10; }
    if (rainfall !== undefined) { score += scoreRange(rainfall, crop.rainfall) * 10; maxScore += 10; }

    // Soil type match
    if (soilType) {
      maxScore += 10;
      if (crop.soilTypes.includes(soilType)) {
        score += 10;
        reasons.push(`Well-suited for ${soilType} soil`);
      }
    }

    // Season match
    if (season) {
      maxScore += 10;
      if (crop.season.includes(season) || crop.season.includes('whole_year')) {
        score += 10;
        reasons.push(`Grows well in ${season} season`);
      }
    }

    const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Add reasons based on parameter fits
    if (nitrogen !== undefined && scoreRange(nitrogen, crop.N) > 0.7) reasons.push('Good nitrogen levels');
    if (pH !== undefined && scoreRange(pH, crop.pH) > 0.7) reasons.push('Suitable soil pH');
    if (temperature !== undefined && scoreRange(temperature, crop.temp) > 0.7) reasons.push('Favorable temperature');
    if (rainfall !== undefined && scoreRange(rainfall, crop.rainfall) > 0.7) reasons.push('Adequate rainfall');

    results.push({
      crop: crop.name,
      cropKey: key,
      confidence,
      season: crop.season,
      description: crop.description,
      yieldPerAcre: crop.yieldPerAcre,
      reasons: reasons.length > 0 ? reasons : ['Based on overall parameter matching'],
      requirements: {
        N: `${crop.N[0]}-${crop.N[1]} kg/ha`,
        P: `${crop.P[0]}-${crop.P[1]} kg/ha`,
        K: `${crop.K[0]}-${crop.K[1]} kg/ha`,
        pH: `${crop.pH[0]}-${crop.pH[1]}`,
        temperature: `${crop.temp[0]}-${crop.temp[1]}°C`,
        rainfall: `${crop.rainfall[0]}-${crop.rainfall[1]} mm/month`,
      },
    });
  }

  // Sort by confidence, return top 5
  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, 5);
}

module.exports = { recommend, CROP_DATABASE };

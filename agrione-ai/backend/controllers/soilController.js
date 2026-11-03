exports.analyzeSoil = async (req, res) => {
  try {
    const { pH, nitrogen, phosphorus, potassium, moisture, soilType } = req.body;

    // Soil health analysis
    const health = { score: 0, maxScore: 100, factors: [] };
    let totalScore = 0;

    // pH analysis
    if (pH >= 6.0 && pH <= 7.5) { totalScore += 25; health.factors.push({ name: 'pH', status: 'Good', value: pH, detail: 'Optimal range for most crops' }); }
    else if (pH >= 5.5 && pH <= 8.0) { totalScore += 15; health.factors.push({ name: 'pH', status: 'Fair', value: pH, detail: 'Slightly outside optimal range' }); }
    else { totalScore += 5; health.factors.push({ name: 'pH', status: 'Poor', value: pH, detail: 'Needs amendment. Consider liming for acidic or gypsum for alkaline soil.' }); }

    // Nitrogen
    if (nitrogen >= 50) { totalScore += 20; health.factors.push({ name: 'Nitrogen', status: 'Good', value: nitrogen, detail: 'Adequate for most crops' }); }
    else if (nitrogen >= 25) { totalScore += 12; health.factors.push({ name: 'Nitrogen', status: 'Medium', value: nitrogen, detail: 'May need supplementation for high-demand crops' }); }
    else { totalScore += 5; health.factors.push({ name: 'Nitrogen', status: 'Low', value: nitrogen, detail: 'Apply nitrogen-rich fertilizers or green manure' }); }

    // Phosphorus
    if (phosphorus >= 30) { totalScore += 20; health.factors.push({ name: 'Phosphorus', status: 'Good', value: phosphorus, detail: 'Supports root development' }); }
    else if (phosphorus >= 15) { totalScore += 12; health.factors.push({ name: 'Phosphorus', status: 'Medium', value: phosphorus, detail: 'Consider phosphorus supplementation' }); }
    else { totalScore += 5; health.factors.push({ name: 'Phosphorus', status: 'Low', value: phosphorus, detail: 'Apply DAP or bone meal' }); }

    // Potassium
    if (potassium >= 30) { totalScore += 20; health.factors.push({ name: 'Potassium', status: 'Good', value: potassium, detail: 'Supports flowering and fruit quality' }); }
    else if (potassium >= 15) { totalScore += 12; health.factors.push({ name: 'Potassium', status: 'Medium', value: potassium, detail: 'May benefit from potash application' }); }
    else { totalScore += 5; health.factors.push({ name: 'Potassium', status: 'Low', value: potassium, detail: 'Apply muriate of potash (MOP)' }); }

    // Moisture
    if (moisture >= 40 && moisture <= 70) { totalScore += 15; health.factors.push({ name: 'Moisture', status: 'Good', value: moisture, detail: 'Optimal soil moisture' }); }
    else if (moisture > 70) { totalScore += 8; health.factors.push({ name: 'Moisture', status: 'High', value: moisture, detail: 'Risk of waterlogging. Improve drainage.' }); }
    else { totalScore += 8; health.factors.push({ name: 'Moisture', status: 'Low', value: moisture, detail: 'Consider irrigation or mulching' }); }

    health.score = totalScore;
    let healthStatus = 'Poor';
    if (totalScore >= 80) healthStatus = 'Excellent';
    else if (totalScore >= 60) healthStatus = 'Good';
    else if (totalScore >= 40) healthStatus = 'Fair';

    // Suitable crops based on soil
    const suitableCrops = getSuitableCrops(pH, nitrogen, phosphorus, potassium, soilType);

    // Recommendations
    const recommendations = [];
    if (pH < 6.0) recommendations.push('Add agricultural lime to raise soil pH');
    if (pH > 8.0) recommendations.push('Add gypsum or sulfur to lower soil pH');
    if (nitrogen < 30) recommendations.push('Apply urea or ammonium sulfate for nitrogen');
    if (phosphorus < 20) recommendations.push('Apply DAP (Diammonium Phosphate) for phosphorus');
    if (potassium < 20) recommendations.push('Apply MOP (Muriate of Potash) for potassium');
    if (moisture < 30) recommendations.push('Increase irrigation or apply mulch to retain moisture');
    if (moisture > 80) recommendations.push('Improve field drainage to prevent waterlogging');
    recommendations.push('Consider annual soil testing for monitoring');

    // Irrigation considerations
    const irrigationNotes = [];
    if (soilType === 'sandy') irrigationNotes.push('Sandy soil drains quickly — frequent, lighter irrigation recommended');
    if (soilType === 'clay') irrigationNotes.push('Clay soil retains water — less frequent but deeper irrigation');
    if (soilType === 'loamy') irrigationNotes.push('Loamy soil has good water retention — standard irrigation schedule');
    if (moisture < 40) irrigationNotes.push('Current moisture is low — prioritize irrigation');

    res.json({
      success: true,
      analysis: {
        healthScore: totalScore,
        healthStatus,
        nutrients: health.factors,
        suitableCrops,
        recommendations,
        irrigationNotes,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Soil analysis failed.' });
  }
};

function getSuitableCrops(pH, n, p, k, soilType) {
  const crops = [];
  if (pH >= 5.5 && pH <= 7.0 && n >= 60) crops.push('Rice');
  if (pH >= 6.0 && pH <= 7.5) crops.push('Wheat');
  if (soilType === 'loamy' || soilType === 'alluvial') crops.push('Maize');
  if (soilType === 'black') crops.push('Cotton');
  if (n >= 40 && pH >= 6.0) crops.push('Tomato');
  if (pH >= 5.5 && pH <= 6.5) crops.push('Potato');
  if (soilType === 'sandy' || soilType === 'loamy') crops.push('Groundnut');
  if (pH >= 6.0 && pH <= 7.5) crops.push('Onion');
  if (crops.length === 0) crops.push('Most crops can grow with soil amendments');
  return crops.slice(0, 6);
}

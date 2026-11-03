const { predictYield } = require('../ml/yield_prediction/service');

exports.simulate = async (req, res) => {
  try {
    const { currentScenario, simulatedScenario } = req.body;

    if (!currentScenario || !simulatedScenario) {
      return res.status(400).json({ success: false, message: 'Both current and simulated scenarios are required.' });
    }

    // Calculate current scenario
    const currentYield = predictYield(currentScenario);
    const currentRevenue = (currentYield.totalYield || 0) * (currentScenario.sellingPrice || 0);
    const currentCost = (currentScenario.seedCost || 0) + (currentScenario.fertilizerCost || 0) +
      (currentScenario.labourCost || 0) + (currentScenario.irrigationCost || 0) + (currentScenario.otherCosts || 0);
    const currentProfit = currentRevenue - currentCost;

    // Calculate simulated scenario
    const simYield = predictYield(simulatedScenario);
    const simRevenue = (simYield.totalYield || 0) * (simulatedScenario.sellingPrice || 0);
    const simCost = (simulatedScenario.seedCost || 0) + (simulatedScenario.fertilizerCost || 0) +
      (simulatedScenario.labourCost || 0) + (simulatedScenario.irrigationCost || 0) + (simulatedScenario.otherCosts || 0);
    const simProfit = simRevenue - simCost;

    // Comparison
    const comparison = {
      yield: { current: currentYield.totalYield, simulated: simYield.totalYield, change: simYield.totalYield - currentYield.totalYield },
      revenue: { current: Math.round(currentRevenue), simulated: Math.round(simRevenue), change: Math.round(simRevenue - currentRevenue) },
      cost: { current: Math.round(currentCost), simulated: Math.round(simCost), change: Math.round(simCost - currentCost) },
      profit: { current: Math.round(currentProfit), simulated: Math.round(simProfit), change: Math.round(simProfit - currentProfit) },
    };

    res.json({
      success: true,
      simulation: {
        current: { yield: currentYield, revenue: Math.round(currentRevenue), cost: Math.round(currentCost), profit: Math.round(currentProfit) },
        simulated: { yield: simYield, revenue: Math.round(simRevenue), cost: Math.round(simCost), profit: Math.round(simProfit) },
        comparison,
        disclaimer: 'This simulation uses baseline estimates. Results are approximate and for planning purposes only.',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Simulation failed.' });
  }
};

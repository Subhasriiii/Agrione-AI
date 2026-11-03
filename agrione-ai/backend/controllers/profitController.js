exports.calculate = async (req, res) => {
  try {
    const { farmArea, crop, expectedYield, sellingPrice, seedCost, fertilizerCost, labourCost, irrigationCost, otherCosts } = req.body;

    const area = farmArea || 1;
    const yieldQty = expectedYield || 0;
    const price = sellingPrice || 0;

    const revenue = yieldQty * price;
    const totalCost = (seedCost || 0) + (fertilizerCost || 0) + (labourCost || 0) + (irrigationCost || 0) + (otherCosts || 0);
    const profit = revenue - totalCost;
    const profitPerAcre = area > 0 ? Math.round(profit / area) : 0;
    const breakEvenYield = price > 0 ? Math.round((totalCost / price) * 100) / 100 : 0;
    const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100 * 100) / 100 : 0;

    const costBreakdown = {
      seeds: seedCost || 0,
      fertilizer: fertilizerCost || 0,
      labour: labourCost || 0,
      irrigation: irrigationCost || 0,
      other: otherCosts || 0,
    };

    res.json({
      success: true,
      estimation: {
        crop: crop || 'Unknown',
        farmArea: area,
        expectedYield: yieldQty,
        sellingPrice: price,
        revenue: Math.round(revenue),
        totalCost: Math.round(totalCost),
        profit: Math.round(profit),
        profitPerAcre,
        breakEvenYield,
        roi,
        isProfitable: profit > 0,
        costBreakdown,
        disclaimer: 'This is an ESTIMATE based on the values you entered. Actual results may vary based on market conditions and other factors.',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Profit calculation failed.' });
  }
};

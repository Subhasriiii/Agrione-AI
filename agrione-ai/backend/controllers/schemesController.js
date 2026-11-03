const GovernmentScheme = require('../models/GovernmentScheme');

// Get all schemes with search/filter
exports.getSchemes = async (req, res) => {
  try {
    const { search, category, state } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (state) filter.state = { $in: [state, 'All India'] };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { benefits: { $regex: search, $options: 'i' } },
      ];
    }

    let schemes = await GovernmentScheme.find(filter).sort('name');

    // If no schemes in DB, return seed data
    if (schemes.length === 0 && !search && !category) {
      schemes = getDefaultSchemes();
    }

    res.json({ success: true, schemes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch schemes.' });
  }
};

// Seed default schemes
exports.seedSchemes = async (req, res) => {
  try {
    const count = await GovernmentScheme.countDocuments();
    if (count > 0) {
      return res.json({ success: true, message: 'Schemes already exist.', count });
    }

    const schemes = getDefaultSchemes();
    await GovernmentScheme.insertMany(schemes);
    res.json({ success: true, message: `${schemes.length} schemes added.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to seed schemes.' });
  }
};

function getDefaultSchemes() {
  return [
    {
      name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
      description: 'Direct income support of ₹6,000 per year to farmer families, paid in three equal installments.',
      eligibility: 'All land-holding farmer families with cultivable land.',
      benefits: '₹6,000 per year in 3 installments of ₹2,000 each.',
      category: 'subsidy',
      targetFarmers: 'Small and marginal farmers',
      state: 'All India',
      applicationUrl: 'https://pmkisan.gov.in',
    },
    {
      name: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
      description: 'Crop insurance scheme providing financial support to farmers suffering crop loss due to natural calamities, pests, and diseases.',
      eligibility: 'All farmers including sharecroppers and tenant farmers.',
      benefits: 'Insurance coverage for crop loss. Premium: 2% for Kharif, 1.5% for Rabi crops.',
      category: 'insurance',
      targetFarmers: 'All farmers',
      state: 'All India',
      applicationUrl: 'https://pmfby.gov.in',
    },
    {
      name: 'Soil Health Card Scheme',
      description: 'Provides soil health cards to farmers with information on nutrient status and recommended fertilizer doses.',
      eligibility: 'All farmers.',
      benefits: 'Free soil testing and health card with crop-wise fertilizer recommendations.',
      category: 'other',
      targetFarmers: 'All farmers',
      state: 'All India',
      applicationUrl: 'https://soilhealth.dac.gov.in',
    },
    {
      name: 'Kisan Credit Card (KCC)',
      description: 'Provides affordable credit to farmers for agricultural needs including crop production, post-harvest expenses, and allied activities.',
      eligibility: 'All farmers, fishermen, and animal husbandry farmers.',
      benefits: 'Credit up to ₹3 lakh at 4% interest rate (with interest subvention).',
      category: 'loan',
      targetFarmers: 'All farmers',
      state: 'All India',
      applicationUrl: 'https://www.pmkisan.gov.in/kcc',
    },
    {
      name: 'eNAM (National Agriculture Market)',
      description: 'Online trading platform for agricultural commodities connecting farmers to buyers across state mandis.',
      eligibility: 'All farmers and traders.',
      benefits: 'Better price discovery, transparent bidding, online payment.',
      category: 'market',
      targetFarmers: 'All farmers',
      state: 'All India',
      applicationUrl: 'https://enam.gov.in',
    },
    {
      name: 'Paramparagat Krishi Vikas Yojana (PKVY)',
      description: 'Promotes organic farming through adoption of organic village clusters and PGS certification.',
      eligibility: 'Groups of 50 or more farmers in a cluster.',
      benefits: '₹50,000 per hectare for 3 years for organic farming conversion.',
      category: 'subsidy',
      targetFarmers: 'Organic farming groups',
      state: 'All India',
    },
    {
      name: 'Micro Irrigation Fund',
      description: 'Provides financial support for micro irrigation (drip and sprinkler) systems.',
      eligibility: 'All farmers adopting micro irrigation.',
      benefits: 'Subsidy of 55% for small/marginal farmers and 45% for others on micro irrigation systems.',
      category: 'equipment',
      targetFarmers: 'All farmers',
      state: 'All India',
    },
    {
      name: 'Rashtriya Krishi Vikas Yojana (RKVY)',
      description: 'Provides flexible support for diverse agricultural development activities chosen by states.',
      eligibility: 'State-specific implementation.',
      benefits: 'Funding for agricultural infrastructure, value addition, and marketing.',
      category: 'subsidy',
      targetFarmers: 'All farmers',
      state: 'All India',
    },
  ];
}

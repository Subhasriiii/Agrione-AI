const MarketData = require('../models/MarketData');

exports.getMarketData = async (req, res) => {
  try {
    const { crop, location, market } = req.query;
    const filter = {};
    if (crop) filter.crop = { $regex: crop, $options: 'i' };
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (market) filter.market = { $regex: market, $options: 'i' };

    let data = await MarketData.find(filter).sort('-priceDate').limit(50);

    if (data.length === 0 && !crop && !location) {
      data = getDefaultMarketData();
    }

    res.json({ success: true, marketData: data, note: 'Prices are indicative and may not reflect real-time market rates.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch market data.' });
  }
};

exports.seedMarketData = async (req, res) => {
  try {
    const count = await MarketData.countDocuments();
    if (count > 0) return res.json({ success: true, message: 'Market data exists.', count });

    const data = getDefaultMarketData();
    await MarketData.insertMany(data);
    res.json({ success: true, message: `${data.length} records added.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to seed market data.' });
  }
};

function getDefaultMarketData() {
  const today = new Date();
  return [
    { crop: 'Rice', market: 'Guntur Mandi', price: 2200, unit: 'per quintal', location: 'Guntur', state: 'Andhra Pradesh', minPrice: 2000, maxPrice: 2400, priceDate: today, isIndicative: true },
    { crop: 'Wheat', market: 'Hapur Mandi', price: 2300, unit: 'per quintal', location: 'Hapur', state: 'Uttar Pradesh', minPrice: 2100, maxPrice: 2500, priceDate: today, isIndicative: true },
    { crop: 'Maize', market: 'Nizamabad Mandi', price: 1900, unit: 'per quintal', location: 'Nizamabad', state: 'Telangana', minPrice: 1750, maxPrice: 2050, priceDate: today, isIndicative: true },
    { crop: 'Cotton', market: 'Adilabad Mandi', price: 6500, unit: 'per quintal', location: 'Adilabad', state: 'Telangana', minPrice: 6000, maxPrice: 7000, priceDate: today, isIndicative: true },
    { crop: 'Tomato', market: 'Madanapalle Mandi', price: 2500, unit: 'per quintal', location: 'Madanapalle', state: 'Andhra Pradesh', minPrice: 1500, maxPrice: 3500, priceDate: today, isIndicative: true },
    { crop: 'Onion', market: 'Lasalgaon Mandi', price: 1800, unit: 'per quintal', location: 'Nashik', state: 'Maharashtra', minPrice: 1500, maxPrice: 2200, priceDate: today, isIndicative: true },
    { crop: 'Potato', market: 'Agra Mandi', price: 1200, unit: 'per quintal', location: 'Agra', state: 'Uttar Pradesh', minPrice: 1000, maxPrice: 1500, priceDate: today, isIndicative: true },
    { crop: 'Groundnut', market: 'Rajkot Mandi', price: 5200, unit: 'per quintal', location: 'Rajkot', state: 'Gujarat', minPrice: 4800, maxPrice: 5600, priceDate: today, isIndicative: true },
    { crop: 'Soybean', market: 'Indore Mandi', price: 4500, unit: 'per quintal', location: 'Indore', state: 'Madhya Pradesh', minPrice: 4200, maxPrice: 4800, priceDate: today, isIndicative: true },
    { crop: 'Chilli', market: 'Guntur Mandi', price: 12000, unit: 'per quintal', location: 'Guntur', state: 'Andhra Pradesh', minPrice: 10000, maxPrice: 14000, priceDate: today, isIndicative: true },
    { crop: 'Turmeric', market: 'Erode Mandi', price: 8500, unit: 'per quintal', location: 'Erode', state: 'Tamil Nadu', minPrice: 7500, maxPrice: 9500, priceDate: today, isIndicative: true },
    { crop: 'Sugarcane', market: 'Kolhapur Mandi', price: 350, unit: 'per quintal', location: 'Kolhapur', state: 'Maharashtra', minPrice: 310, maxPrice: 380, priceDate: today, isIndicative: true },
  ];
}

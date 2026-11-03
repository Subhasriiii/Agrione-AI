const ProduceListing = require('../models/ProduceListing');

// Create listing
exports.createListing = async (req, res) => {
  try {
    const listingData = { ...req.body, seller: req.user._id };
    if (req.file) listingData.imagePath = req.file.filename;
    const listing = await ProduceListing.create(listingData);
    res.status(201).json({ success: true, message: 'Produce listed!', listing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create listing.' });
  }
};

// Get all listings (public browse)
exports.getListings = async (req, res) => {
  try {
    const { crop, location, search } = req.query;
    const filter = { isAvailable: true };
    if (crop) filter.cropName = { $regex: crop, $options: 'i' };
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (search) {
      filter.$or = [
        { cropName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const listings = await ProduceListing.find(filter)
      .populate('seller', 'name location state district phone email')
      .sort('-createdAt')
      .limit(50);

    // Filter sensitive info based on contact preference
    const safeListings = listings.map(l => {
      const obj = l.toObject();
      if (obj.seller) {
        if (obj.contactMethod === 'phone') delete obj.seller.email;
        else if (obj.contactMethod === 'email') delete obj.seller.phone;
      }
      return obj;
    });

    res.json({ success: true, listings: safeListings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch listings.' });
  }
};

// Get user's own listings
exports.getMyListings = async (req, res) => {
  try {
    const listings = await ProduceListing.find({ seller: req.user._id }).sort('-createdAt');
    res.json({ success: true, listings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch your listings.' });
  }
};

// Update listing
exports.updateListing = async (req, res) => {
  try {
    const listing = await ProduceListing.findOneAndUpdate(
      { _id: req.params.id, seller: req.user._id },
      req.body,
      { new: true }
    );
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found.' });
    res.json({ success: true, message: 'Listing updated!', listing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update listing.' });
  }
};

// Delete listing
exports.deleteListing = async (req, res) => {
  try {
    const listing = await ProduceListing.findOneAndDelete({ _id: req.params.id, seller: req.user._id });
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found.' });
    res.json({ success: true, message: 'Listing removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete listing.' });
  }
};

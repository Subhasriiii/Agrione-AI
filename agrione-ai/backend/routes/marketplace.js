const router = require('express').Router();
const { createListing, getListings, getMyListings, updateListing, deleteListing } = require('../controllers/marketplaceController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const requireRole = auth.requireRole;

router.get('/', getListings); // Public browse
router.get('/my', auth, getMyListings);
router.post('/', auth, requireRole('farmer'), upload.single('image'), createListing);
router.put('/:id', auth, requireRole('farmer'), updateListing);
router.delete('/:id', auth, requireRole('farmer'), deleteListing);

module.exports = router;

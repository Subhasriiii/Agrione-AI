const router = require('express').Router();
const { createListing, getListings, getMyListings, updateListing, deleteListing } = require('../controllers/marketplaceController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', getListings); // Public browse
router.get('/my', auth, getMyListings);
router.post('/', auth, upload.single('image'), createListing);
router.put('/:id', auth, updateListing);
router.delete('/:id', auth, deleteListing);

module.exports = router;

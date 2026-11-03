const router = require('express').Router();
const { extractSoilReport } = require('../controllers/ocrController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/extract', auth, upload.single('soilReport'), extractSoilReport);

module.exports = router;

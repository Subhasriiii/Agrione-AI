const router = require('express').Router();
const { analyzeSoil } = require('../controllers/soilController');
const auth = require('../middleware/auth');
router.post('/analyze', auth, analyzeSoil);
module.exports = router;

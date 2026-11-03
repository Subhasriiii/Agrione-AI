const router = require('express').Router();
const { detectDisease, getDiseaseRisk } = require('../controllers/diseaseController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/detect', auth, upload.single('image'), detectDisease);
router.post('/risk', auth, getDiseaseRisk);

module.exports = router;

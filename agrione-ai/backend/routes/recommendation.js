const router = require('express').Router();
const { getRecommendation } = require('../controllers/recommendationController');
const auth = require('../middleware/auth');

router.post('/', auth, getRecommendation);

module.exports = router;

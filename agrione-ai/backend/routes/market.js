const router = require('express').Router();
const { getMarketData, seedMarketData } = require('../controllers/marketController');
router.get('/', getMarketData);
router.post('/seed', seedMarketData);
module.exports = router;

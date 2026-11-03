const router = require('express').Router();
const { calculate } = require('../controllers/profitController');
const auth = require('../middleware/auth');
router.post('/', auth, calculate);
module.exports = router;

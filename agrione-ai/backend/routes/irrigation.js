const router = require('express').Router();
const { getAdvice } = require('../controllers/irrigationController');
const auth = require('../middleware/auth');

router.post('/', auth, getAdvice);

module.exports = router;

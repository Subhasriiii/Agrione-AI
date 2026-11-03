const router = require('express').Router();
const { assess } = require('../controllers/riskController');
const auth = require('../middleware/auth');
router.post('/', auth, assess);
module.exports = router;

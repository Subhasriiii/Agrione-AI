const router = require('express').Router();
const { simulate } = require('../controllers/simulationController');
const auth = require('../middleware/auth');
router.post('/', auth, simulate);
module.exports = router;

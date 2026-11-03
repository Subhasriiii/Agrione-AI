const router = require('express').Router();
const { predict } = require('../controllers/yieldController');
const auth = require('../middleware/auth');
router.post('/', auth, predict);
module.exports = router;

const router = require('express').Router();
const { chat } = require('../controllers/assistantController');
const auth = require('../middleware/auth');
router.post('/', auth, chat);
module.exports = router;

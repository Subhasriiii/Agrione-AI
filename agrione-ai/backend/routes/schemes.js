const router = require('express').Router();
const { getSchemes, seedSchemes } = require('../controllers/schemesController');
router.get('/', getSchemes);
router.post('/seed', seedSchemes);
module.exports = router;

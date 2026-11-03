const router = require('express').Router();
const { createFarm, getFarms, getFarm, updateFarm, updateSoilData, deleteFarm } = require('../controllers/farmController');
const auth = require('../middleware/auth');

router.use(auth);
router.post('/', createFarm);
router.get('/', getFarms);
router.get('/:id', getFarm);
router.put('/:id', updateFarm);
router.put('/:id/soil', updateSoilData);
router.delete('/:id', deleteFarm);

module.exports = router;

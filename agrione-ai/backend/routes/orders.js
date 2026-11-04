const router = require('express').Router();
const {
  placeOrder,
  getMyOrders,
  getReceivedOrders,
  acceptOrder,
  rejectOrder,
  completeOrder,
} = require('../controllers/orderController');
const auth = require('../middleware/auth');
const requireRole = auth.requireRole;

router.post('/', auth, requireRole('buyer'), placeOrder);
router.get('/my', auth, requireRole('buyer'), getMyOrders);
router.get('/received', auth, requireRole('farmer'), getReceivedOrders);
router.patch('/:id/accept', auth, requireRole('farmer'), acceptOrder);
router.patch('/:id/reject', auth, requireRole('farmer'), rejectOrder);
router.patch('/:id/complete', auth, requireRole('farmer'), completeOrder);

module.exports = router;

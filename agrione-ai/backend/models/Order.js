const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'ProduceListing', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cropName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: Number.MIN_VALUE },
  quantityUnit: { type: String, required: true, trim: true },
  unitPrice: { type: Number, required: true, min: Number.MIN_VALUE },
  totalAmount: { type: Number, required: true, min: 0 },
  deliveryAddress: { type: String, required: true, trim: true, maxlength: 1000 },
  contactPhone: { type: String, required: true, trim: true, maxlength: 50 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed'],
    default: 'pending',
  },
  stockRestored: { type: Boolean, default: false },
}, { timestamps: true });

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ farmer: 1, status: 1, createdAt: -1 });
orderSchema.index({ listing: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);

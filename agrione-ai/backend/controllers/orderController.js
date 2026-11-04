const mongoose = require('mongoose');
const Order = require('../models/Order');
const ProduceListing = require('../models/ProduceListing');

class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let transactionSupportPromise;

const supportsTransactions = async () => {
  if (!transactionSupportPromise) {
    transactionSupportPromise = (async () => {
      await mongoose.connection.asPromise();
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      const supported = Boolean(hello.setName || hello.msg === 'isdbgrid');
      console.log(`MongoDB transactions ${supported ? 'available' : 'unavailable'} for order processing.`);
      return supported;
    })().catch((error) => {
      transactionSupportPromise = null;
      throw error;
    });
  }
  return transactionSupportPromise;
};

const runInTransaction = async (operation) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => operation(session));
  } finally {
    await session.endSession();
  }
};

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);

const getAvailableListing = async (listingId, buyerId, quantity, session) => {
  const queryOptions = session ? { session } : {};
  const initialListing = await ProduceListing.findById(listingId).session(session || null);
  if (!initialListing) throw new OrderError(404, 'Crop listing not found.');
  if (initialListing.seller.equals(buyerId)) {
    throw new OrderError(400, 'You cannot place an order for your own crop listing.');
  }
  if (!initialListing.isAvailable || initialListing.quantity <= 0) {
    throw new OrderError(409, 'This crop listing is unavailable.');
  }
  if (!Number.isFinite(initialListing.expectedPrice) || initialListing.expectedPrice <= 0) {
    throw new OrderError(409, 'This crop listing does not have a valid price.');
  }

  const listing = await ProduceListing.findOneAndUpdate(
    {
      _id: listingId,
      seller: initialListing.seller,
      isAvailable: true,
      quantity: { $gte: quantity },
    },
    { $inc: { quantity: -quantity } },
    { new: true, runValidators: true, ...queryOptions }
  );

  if (!listing) {
    const currentListing = await ProduceListing.findById(listingId).session(session || null);
    if (!currentListing) throw new OrderError(404, 'Crop listing not found.');
    if (!currentListing.isAvailable || currentListing.quantity <= 0) {
      throw new OrderError(409, 'This crop listing is unavailable.');
    }
    throw new OrderError(409, 'Requested quantity exceeds available stock.');
  }

  return listing;
};

const restoreStock = async (listingId, quantity) => {
  const result = await ProduceListing.updateOne(
    { _id: listingId },
    { $inc: { quantity }, $set: { isAvailable: true } }
  );
  if (result.matchedCount !== 1) {
    throw new Error(`Could not restore reserved stock for listing ${listingId}.`);
  }
};

const createOrderDocument = (listing, buyerId, quantity, deliveryAddress, contactPhone) => {
  const unitPrice = listing.expectedPrice;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new OrderError(409, 'This crop listing does not have a valid price.');
  }

  return {
    listing: listing._id,
    buyer: buyerId,
    farmer: listing.seller,
    cropName: listing.cropName,
    quantity,
    quantityUnit: listing.quantityUnit,
    unitPrice,
    totalAmount: Number((quantity * unitPrice).toFixed(2)),
    deliveryAddress,
    contactPhone,
    status: 'pending',
  };
};

exports.placeOrder = async (req, res) => {
  const { listingId, quantity, deliveryAddress, contactPhone } = req.body || {};
  const requestedQuantity = Number(quantity);
  const address = typeof deliveryAddress === 'string' ? deliveryAddress.trim() : '';
  const phone = typeof contactPhone === 'string' ? contactPhone.trim() : '';

  if (!validateObjectId(listingId)) {
    return res.status(400).json({ success: false, message: 'A valid listing ID is required.' });
  }
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive number.' });
  }
  if (!address || address.length > 1000) {
    return res.status(400).json({ success: false, message: 'A delivery address of up to 1000 characters is required.' });
  }
  if (!/^[+()\d\s.-]{7,50}$/.test(phone) || !/\d/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Enter a valid contact phone number.' });
  }

  try {
    const transactionCapable = await supportsTransactions();
    if (transactionCapable) {
      const order = await runInTransaction(async (session) => {
        const listing = await getAvailableListing(listingId, req.user._id, requestedQuantity, session);
        const orderData = createOrderDocument(listing, req.user._id, requestedQuantity, address, phone);
        const [createdOrder] = await Order.create([orderData], { session });
        return createdOrder;
      });
      return res.status(201).json({ success: true, message: 'Order placed successfully.', order });
    }

    const listing = await getAvailableListing(listingId, req.user._id, requestedQuantity);
    try {
      const order = await Order.create(
        createOrderDocument(listing, req.user._id, requestedQuantity, address, phone)
      );
      return res.status(201).json({ success: true, message: 'Order placed successfully.', order });
    } catch (error) {
      try {
        await restoreStock(listing._id, requestedQuantity);
      } catch (rollbackError) {
        console.error('Order creation failed and stock rollback also failed:', rollbackError);
        return res.status(500).json({
          success: false,
          message: 'Order creation failed and reserved stock could not be restored. Please contact support.',
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Failed to place order:', error);
    return res.status(500).json({ success: false, message: 'Failed to place order.' });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('listing', 'cropName location')
      .populate('farmer', 'name')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Failed to fetch buyer orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your orders.' });
  }
};

exports.getReceivedOrders = async (req, res) => {
  try {
    const orders = await Order.find({ farmer: req.user._id })
      .populate('listing', 'cropName location')
      .populate('buyer', 'name phone')
      .sort('-createdAt');
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Failed to fetch received orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch received orders.' });
  }
};

const updateOrderStatus = async (orderId, farmerId, expectedStatus, nextStatus, session) => {
  const options = session ? { new: true, session } : { new: true };
  const order = await Order.findOneAndUpdate(
    { _id: orderId, farmer: farmerId, status: expectedStatus },
    { $set: { status: nextStatus } },
    options
  );
  if (order) return order;

  const existingOrder = await Order.findOne({ _id: orderId, farmer: farmerId }).session(session || null);
  if (!existingOrder) throw new OrderError(404, 'Order not found.');
  throw new OrderError(409, `Order cannot be changed from ${existingOrder.status} to ${nextStatus}.`);
};

exports.acceptOrder = async (req, res) => {
  try {
    if (!validateObjectId(req.params.id)) throw new OrderError(400, 'A valid order ID is required.');
    const order = await updateOrderStatus(req.params.id, req.user._id, 'pending', 'accepted');
    res.json({ success: true, message: 'Order accepted.', order });
  } catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Failed to accept order:', error);
    res.status(500).json({ success: false, message: 'Failed to accept order.' });
  }
};

exports.rejectOrder = async (req, res) => {
  try {
    if (!validateObjectId(req.params.id)) throw new OrderError(400, 'A valid order ID is required.');

    if (await supportsTransactions()) {
      const order = await runInTransaction(async (session) => {
        const rejectedOrder = await updateOrderStatus(
          req.params.id, req.user._id, 'pending', 'rejected', session
        );
        const result = await ProduceListing.updateOne(
          { _id: rejectedOrder.listing },
          { $inc: { quantity: rejectedOrder.quantity }, $set: { isAvailable: true } },
          { session }
        );
        if (result.matchedCount !== 1) throw new Error('Could not restore stock for the rejected order.');
        const orderUpdate = await Order.updateOne(
          { _id: rejectedOrder._id, status: 'rejected' },
          { $set: { stockRestored: true } },
          { session }
        );
        if (orderUpdate.matchedCount !== 1) {
          throw new Error('Could not record stock restoration for the rejected order.');
        }
        rejectedOrder.stockRestored = true;
        return rejectedOrder;
      });
      return res.json({ success: true, message: 'Order rejected and stock restored.', order });
    }

    const rejectedOrder = await updateOrderStatus(
      req.params.id, req.user._id, 'pending', 'rejected'
    );
    try {
      await restoreStock(rejectedOrder.listing, rejectedOrder.quantity);
      const result = await Order.updateOne(
        { _id: rejectedOrder._id, status: 'rejected', stockRestored: false },
        { $set: { stockRestored: true } }
      );
      if (result.matchedCount !== 1) {
        throw new Error('Stock was restored but the order restoration state could not be recorded.');
      }
      rejectedOrder.stockRestored = true;
    } catch (stockError) {
      console.error('Order was rejected but its reserved stock could not be restored:', stockError);
      return res.status(500).json({
        success: false,
        message: 'The order was rejected, but stock restoration failed. Please contact support.',
      });
    }
    return res.json({ success: true, message: 'Order rejected and stock restored.', order: rejectedOrder });
  } catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Failed to reject order:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject order.' });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    if (!validateObjectId(req.params.id)) throw new OrderError(400, 'A valid order ID is required.');
    const order = await updateOrderStatus(req.params.id, req.user._id, 'accepted', 'completed');
    res.json({ success: true, message: 'Order marked as completed.', order });
  } catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Failed to complete order:', error);
    res.status(500).json({ success: false, message: 'Failed to complete order.' });
  }
};

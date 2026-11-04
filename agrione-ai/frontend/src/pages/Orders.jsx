import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Clock3, PackageCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { marketApi } from '../api/marketApi';

const STATUS_STYLES = {
  pending: { color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)', icon: Clock3 },
  accepted: { color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', icon: Check },
  rejected: { color: '#f87171', background: 'rgba(248, 113, 113, 0.12)', icon: X },
  completed: { color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', icon: PackageCheck },
};

const formatDate = (date) => {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? 'Date unavailable'
    : parsedDate.toLocaleString();
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState(null);

  const isBuyer = user?.role === 'buyer';
  const isFarmer = user?.role === 'farmer';

  const loadOrders = useCallback(async () => {
    if (!isBuyer && !isFarmer) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = isBuyer
        ? await marketApi.getMyOrders()
        : await marketApi.getReceivedOrders();
      if (!Array.isArray(response?.orders)) {
        throw new Error('The orders service returned an unexpected response.');
      }
      setOrders(response.orders);
    } catch (requestError) {
      setOrders([]);
      setError(requestError.message || 'Unable to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isBuyer, isFarmer]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleAction = async (order, action) => {
    if (processingOrderId) return;
    setProcessingOrderId(order._id);
    setActionError('');

    try {
      if (action === 'accept') await marketApi.acceptOrder(order._id);
      if (action === 'reject') await marketApi.rejectOrder(order._id);
      if (action === 'complete') await marketApi.completeOrder(order._id);
      await loadOrders();
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to update this order. Please try again.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  if (!isBuyer && !isFarmer) {
    return (
      <div className="page-container">
        <div className="glass-panel" role="alert" style={{ padding: '1.5rem' }}>
          Orders are available to buyer and farmer accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <h1>
            {isBuyer ? 'My ' : 'Received '}<span className="gradient-text">Orders</span>
          </h1>
          <p className="page-subtitle">
            {isBuyer
              ? 'Review your crop purchases and track each order status.'
              : 'Review orders for your crop listings and update their status.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-panel" role="alert" style={{ padding: '1rem', marginBottom: '1rem', color: '#f87171' }}>
          <AlertCircle size={17} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {error}
        </div>
      )}
      {actionError && (
        <div className="glass-panel" role="alert" style={{ padding: '1rem', marginBottom: '1rem', color: '#f87171' }}>
          <AlertCircle size={17} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          Loading orders...
        </div>
      ) : error ? null : orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {isBuyer ? 'You have not placed any orders yet.' : 'You have not received any orders yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
          {orders.map((order) => {
            const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
            const StatusIcon = statusStyle.icon;
            const isProcessing = processingOrderId === order._id;

            return (
              <article key={order._id} className="glass-panel" style={{ padding: '1.25rem', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <span className="badge badge-success">{order.cropName || order.listing?.cropName || 'Crop'}</span>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      Ordered {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <span
                    className="badge"
                    style={{ color: statusStyle.color, background: statusStyle.background, textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                  >
                    <StatusIcon size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    {order.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Quantity</div>
                    <strong>{order.quantity} {order.quantityUnit}</strong>
                  </div>
                  {isBuyer && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Farmer</div>
                      <strong>{order.farmer?.name || 'Farmer'}</strong>
                    </div>
                  )}
                  {isFarmer && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Buyer</div>
                      <strong>{order.buyer?.name || 'Buyer'}</strong>
                    </div>
                  )}
                  {isBuyer && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unit Price</div>
                      <strong>₹{Number(order.unitPrice).toLocaleString()}</strong>
                    </div>
                  )}
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total</div>
                    <strong style={{ color: '#34d399' }}>₹{Number(order.totalAmount).toLocaleString()}</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', overflowWrap: 'anywhere' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Delivery Address</div>
                  <div>{order.deliveryAddress}</div>
                  {isFarmer && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.6rem' }}>Buyer Phone</div>
                      <div>{order.contactPhone}</div>
                    </>
                  )}
                </div>

                {isFarmer && (
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    {order.status === 'pending' && (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(processingOrderId)} onClick={() => handleAction(order, 'accept')}>
                          {isProcessing ? 'Updating...' : 'Accept'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(processingOrderId)} onClick={() => handleAction(order, 'reject')}>
                          {isProcessing ? 'Updating...' : 'Reject'}
                        </button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(processingOrderId)} onClick={() => handleAction(order, 'complete')}>
                        {isProcessing ? 'Updating...' : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;

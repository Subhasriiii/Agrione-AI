import api from './client';

export const marketApi = {
  getMarketData: (params) => api.get('/market', { params }),
  seedMarketData: () => api.post('/market/seed'),
  
  // Marketplace listings
  getListings: (params) => api.get('/marketplace', { params }),
  getMyListings: () => api.get('/marketplace/my'),
  createListing: (formData) =>
    api.post('/marketplace', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateListing: (id, data) => api.put(`/marketplace/${id}`, data),
  deleteListing: (id) => api.delete(`/marketplace/${id}`),

  // Orders
  placeOrder: (data) => api.post('/orders', data),
  getMyOrders: () => api.get('/orders/my'),
  getReceivedOrders: () => api.get('/orders/received'),
  acceptOrder: (id) => api.patch(`/orders/${id}/accept`),
  rejectOrder: (id) => api.patch(`/orders/${id}/reject`),
  completeOrder: (id) => api.patch(`/orders/${id}/complete`),
};

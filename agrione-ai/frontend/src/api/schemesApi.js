import api from './client';

export const schemesApi = {
  getSchemes: (params) => api.get('/schemes', { params }),
  seedSchemes: () => api.post('/schemes/seed'),
  
  getWeather: (params) => api.get('/weather', { params }),
  
  getNotifications: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  generateAlerts: () => api.post('/notifications/generate'),
};

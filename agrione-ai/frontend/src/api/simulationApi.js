import api from './client';

export const simulationApi = {
  simulate: (data) => api.post('/simulation', data),
  calculateProfit: (data) => api.post('/profit', data),
};

import api from './client';

export const farmApi = {
  getFarms: () => api.get('/farms'),
  getFarm: (id) => api.get(`/farms/${id}`),
  createFarm: (data) => api.post('/farms', data),
  updateFarm: (id, data) => api.put(`/farms/${id}`, data),
  updateSoil: (id, soilData) => api.put(`/farms/${id}/soil`, soilData),
  deleteFarm: (id) => api.delete(`/farms/${id}`),
};

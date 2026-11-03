import api from './client';

export const advisoryApi = {
  getRecommendations: (data) => api.post('/recommendation', data),
  detectDisease: (formData) =>
    api.post('/disease/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getDiseaseRisk: (data) => api.post('/disease/risk', data),
  getIrrigationAdvice: (data) => api.post('/irrigation', data),
  predictYield: (data) => api.post('/yield', data),
  assessRisk: (data) => api.post('/risk', data),
  chatAssistant: (message, farmContext) =>
    api.post('/assistant/chat', { message, farmContext }),
};

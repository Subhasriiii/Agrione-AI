import api from './client';

export const soilApi = {
  analyzeSoil: (data) => api.post('/soil/analyze', data),
  extractOCR: (formData) =>
    api.post('/ocr/extract', formData, {
      timeout: 120000,
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

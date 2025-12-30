import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Créer une instance axios avec configuration par défaut
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API d'authentification
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
  logout: () => api.post('/auth/logout'),
  getUserPublicKey: (userId) => api.get(`/auth/user/${userId}/public`),
};

// API des rooms
export const roomsAPI = {
  create: (data) => api.post('/rooms', data),
  getPublic: () => api.get('/rooms/public'),
  getMyRooms: () => api.get('/rooms/my-rooms'),
  getById: (roomId) => api.get(`/rooms/${roomId}`),
  join: (roomId, password) => api.post(`/rooms/${roomId}/join`, { password }),
  leave: (roomId) => api.post(`/rooms/${roomId}/leave`),
  delete: (roomId) => api.delete(`/rooms/${roomId}`),
};

// API des messages
export const messagesAPI = {
  getByRoom: (roomId, params) => api.get(`/messages/room/${roomId}`, { params }),
  markAsRead: (messageId) => api.post(`/messages/${messageId}/read`),
  markMultipleAsRead: (messageIds) => api.post('/messages/read-multiple', { messageIds }),
};

// API des fichiers
export const filesAPI = {
  upload: (formData) => api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  download: (fileId) => api.get(`/files/${fileId}/download`, {
    responseType: 'blob',
  }),
  getByRoom: (roomId) => api.get(`/files/room/${roomId}`),
};

export default api;


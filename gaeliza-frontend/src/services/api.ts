import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token JWT a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
    }
    return response.data;
  },

  register: async (email: string, password: string, username: string) => {
    const response = await api.post('/auth/register', { email, password, username });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// ==================== MATCHES ====================
export const matchesAPI = {
  getAll: async () => {
    const response = await api.get('/matches');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/matches/${id}`);
    return response.data;
  },

  create: async (matchData: any) => {
    const response = await api.post('/matches', matchData);
    return response.data;
  },

  update: async (id: number, matchData: any) => {
    const response = await api.put(`/matches/${id}`, matchData);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/matches/${id}`);
    return response.data;
  },
};

// ==================== TEAMS ====================
export const teamsAPI = {
  getAll: async () => {
    const response = await api.get('/teams');
    return response.data;
  },

  create: async (teamData: any) => {
    const response = await api.post('/teams', teamData);
    return response.data;
  },
};

// ==================== PLAYERS ====================
export const playersAPI = {
  getAll: async () => {
    const response = await api.get('/players');
    return response.data;
  },

  create: async (playerData: any) => {
    const response = await api.post('/players', playerData);
    return response.data;
  },
};

export default api;
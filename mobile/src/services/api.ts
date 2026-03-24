/**
 * API Service
 * Adapted from web frontend for React Native
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { getToken, removeToken } from './storage';

// Use environment variable or default to local development
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// For Android emulator, use 10.0.2.2 instead of localhost
// const API_BASE_URL = 'http://10.0.2.2:5000/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await removeToken();
      // Navigation to login will be handled by AuthContext
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// Type definitions
interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: object;
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// Auth API
export const authAPI = {
  register: (userData: { email: string; password: string; name?: string }) =>
    api.post<any, AuthResponse>('/auth/register', userData),

  login: (credentials: { email: string; password: string }) =>
    api.post<any, AuthResponse>('/auth/login', credentials),

  getProfile: () =>
    api.get<any, ApiResponse>('/auth/profile'),

  updateProfile: (data: object) =>
    api.put<any, ApiResponse>('/auth/profile', data),

  updatePreferences: (preferences: object) =>
    api.put<any, ApiResponse>('/auth/preferences', preferences)
};

// Mood API
export const moodAPI = {
  create: (entry: {
    moodScore: number;
    energyLevel?: number;
    stressLevel?: number;
    anxietyLevel?: number;
    sleepHours?: number;
    sleepQuality?: number;
    socialInteraction?: number;
    notes?: string;
    activities?: string[];
    triggers?: string[];
  }) => api.post<any, ApiResponse>('/mood', entry),

  getAll: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get<any, ApiResponse>('/mood', { params }),

  getById: (entryId: string) =>
    api.get<any, ApiResponse>(`/mood/${entryId}`),

  update: (entryId: string, data: object) =>
    api.put<any, ApiResponse>(`/mood/${entryId}`, data),

  delete: (entryId: string) =>
    api.delete<any, ApiResponse>(`/mood/${entryId}`),

  getStatistics: (params?: { startDate?: string; endDate?: string }) =>
    api.get<any, ApiResponse>('/mood/statistics', { params }),

  getTrends: (params?: { startDate?: string; endDate?: string }) =>
    api.get<any, ApiResponse>('/mood/trends', { params })
};

// Insights API
export const insightsAPI = {
  generate: () =>
    api.post<any, ApiResponse>('/insights/generate'),

  getAll: (params?: { limit?: number }) =>
    api.get<any, ApiResponse>('/insights', { params }),

  getPatterns: (days?: number) =>
    api.get<any, ApiResponse>('/insights/patterns', { params: { days } }),

  markAsRead: (insightId: string) =>
    api.put<any, ApiResponse>(`/insights/${insightId}/read`),

  getSafetyAlerts: () =>
    api.get<any, ApiResponse>('/insights/safety-alerts'),

  acknowledgeSafetyAlert: (alertId: string, data: object) =>
    api.put<any, ApiResponse>(`/insights/safety-alerts/${alertId}/acknowledge`, data)
};

// Recommendations API
export const recommendationsAPI = {
  generate: () =>
    api.post<any, ApiResponse>('/recommendations/generate'),

  generateML: () =>
    api.post<any, ApiResponse>('/recommendations/ml/generate'),

  getAll: (params?: { activeOnly?: boolean; limit?: number }) =>
    api.get<any, ApiResponse>('/recommendations', { params }),

  complete: (recommendationId: string) =>
    api.put<any, ApiResponse>(`/recommendations/${recommendationId}/complete`),

  submitFeedback: (recommendationId: string, feedback: object) =>
    api.post<any, ApiResponse>(`/recommendations/${recommendationId}/feedback`, feedback),

  getCrisisResources: () =>
    api.get<any, ApiResponse>('/recommendations/crisis-resources'),

  getMLInsights: () =>
    api.get<any, ApiResponse>('/recommendations/ml/insights')
};

// Chatbot API (Luna)
export const chatbotAPI = {
  chat: (message: string) =>
    api.post<any, ApiResponse>('/chatbot/chat', { message }),

  getHistory: () =>
    api.get<any, ApiResponse>('/chatbot/history'),

  newConversation: () =>
    api.post<any, ApiResponse>('/chatbot/new'),

  getConversations: () =>
    api.get<any, ApiResponse>('/chatbot/conversations')
};

// Peer Support API
export const peerSupportAPI = {
  getGroups: (params?: { category?: string }) =>
    api.get<any, ApiResponse>('/peer-support/groups', { params }),

  getGroupById: (groupId: string) =>
    api.get<any, ApiResponse>(`/peer-support/groups/${groupId}`),

  joinGroup: (groupId: string, nickname: string) =>
    api.post<any, ApiResponse>(`/peer-support/groups/${groupId}/join`, { nickname }),

  leaveGroup: (groupId: string) =>
    api.post<any, ApiResponse>(`/peer-support/groups/${groupId}/leave`),

  getMyGroups: () =>
    api.get<any, ApiResponse>('/peer-support/my-groups'),

  getMessages: (groupId: string, params?: { limit?: number; before?: string }) =>
    api.get<any, ApiResponse>(`/peer-support/groups/${groupId}/messages`, { params }),

  sendMessage: (groupId: string, content: string) =>
    api.post<any, ApiResponse>(`/peer-support/groups/${groupId}/messages`, { content }),

  flagMessage: (messageId: string, reason: string) =>
    api.post<any, ApiResponse>(`/peer-support/messages/${messageId}/flag`, { reason })
};

export default api;

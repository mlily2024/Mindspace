import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
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

// Track whether a token refresh is already in progress
let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb) => {
  refreshSubscribers.push(cb);
};

// Response interceptor with silent token refresh on 401
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for login/register/refresh endpoints
      const skipUrls = ['/auth/login', '/auth/register', '/auth/refresh'];
      if (skipUrls.some(url => originalRequest.url?.includes(url))) {
        return Promise.reject(error.response?.data || { message: error.message });
      }

      const hadToken = !!localStorage.getItem('token');
      if (!hadToken) {
        return Promise.reject(error.response?.data || { message: error.message });
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent refresh — the backend accepts expired tokens for refresh
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const newToken = response.data?.data?.token;
        if (newToken) {
          localStorage.setItem('token', newToken);
          onRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed — force logout
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error.response?.data || { message: error.message });
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updatePreferences: (preferences) => api.put('/auth/preferences', preferences),
  deleteAccount: () => api.delete('/auth/account'),
  requestDataExport: () => api.post('/auth/data-export'),
  downloadDataExport: () => api.get('/auth/data-export/download'),
  permanentDeleteAccount: (confirmDelete) => api.delete('/auth/account/permanent', { data: { confirmDelete } })
};

// Mood API
export const moodAPI = {
  create: (entry) => api.post('/mood', entry),
  getAll: (params) => api.get('/mood', { params }),
  getById: (entryId) => api.get(`/mood/${entryId}`),
  update: (entryId, data) => api.put(`/mood/${entryId}`, data),
  delete: (entryId) => api.delete(`/mood/${entryId}`),
  getStatistics: (params) => api.get('/mood/statistics', { params }),
  getTrends: (params) => api.get('/mood/trends', { params })
};

// Insights API
export const insightsAPI = {
  generate: () => api.post('/insights/generate'),
  getAll: (params) => api.get('/insights', { params }),
  getPatterns: (days) => api.get('/insights/patterns', { params: { days } }),
  markAsRead: (insightId) => api.put(`/insights/${insightId}/read`),
  getSafetyAlerts: (params) => api.get('/insights/safety-alerts', { params }),
  acknowledgeSafetyAlert: (alertId, data) =>
    api.put(`/insights/safety-alerts/${alertId}/acknowledge`, data)
};

// Recommendations API
export const recommendationsAPI = {
  generate: () => api.post('/recommendations/generate'),
  getAll: (params) => api.get('/recommendations', { params }),
  complete: (recommendationId) => api.put(`/recommendations/${recommendationId}/complete`),
  submitFeedback: (recommendationId, feedback) =>
    api.post(`/recommendations/${recommendationId}/feedback`, feedback),
  getCrisisResources: () => api.get('/recommendations/crisis-resources')
};

// Chatbot API (Luna)
export const chatbotAPI = {
  chat: (message) => api.post('/chatbot/chat', { message }),
  getHistory: () => api.get('/chatbot/history'),
  newConversation: () => api.post('/chatbot/new'),
  getConversations: () => api.get('/chatbot/conversations')
};

// Peer Support API
export const peerSupportAPI = {
  // Groups
  getGroups: (params) => api.get('/peer-support/groups', { params }),
  getGroupById: (groupId) => api.get(`/peer-support/groups/${groupId}`),
  createGroup: (data) => api.post('/peer-support/groups', data),
  joinGroup: (groupId, nickname) => api.post(`/peer-support/groups/${groupId}/join`, { nickname }),
  leaveGroup: (groupId) => api.post(`/peer-support/groups/${groupId}/leave`),
  getMyGroups: () => api.get('/peer-support/my-groups'),

  // Messages
  getMessages: (groupId, params) => api.get(`/peer-support/groups/${groupId}/messages`, { params }),
  sendMessage: (groupId, content) => api.post(`/peer-support/groups/${groupId}/messages`, { content }),
  flagMessage: (messageId, reason) => api.post(`/peer-support/messages/${messageId}/flag`, { reason })
};

// Gamification API
export const gamificationAPI = {
  // Streak
  getStreak: () => api.get('/gamification/streak'),
  useStreakFreeze: () => api.post('/gamification/streak/freeze'),

  // Achievements
  getAchievements: () => api.get('/gamification/achievements'),
  getEarnedAchievements: () => api.get('/gamification/achievements/earned'),
  checkAchievements: () => api.post('/gamification/achievements/check'),
  markNotified: (achievementIds) => api.post('/gamification/achievements/notified', { achievementIds }),

  // Combined stats
  getStats: () => api.get('/gamification/stats')
};

// ============================================
// Phase 1: Predictive Intelligence APIs
// ============================================

// Predictions API (Mood Forecasting)
export const predictionsAPI = {
  // Get mood forecast for next N days
  getForecast: (days = 7) => api.get('/predictions', { params: { days } }),

  // Force regeneration of predictions
  generate: (days = 7) => api.post('/predictions/generate', { days }),

  // Get prediction accuracy metrics
  getAccuracy: () => api.get('/predictions/accuracy'),

  // Get user's analyzed mood patterns
  getPatterns: () => api.get('/predictions/patterns'),

  // Get prediction for specific date
  getByDate: (date) => api.get(`/predictions/${date}`)
};

// Voice Analysis API
export const voiceAPI = {
  // Analyze voice recording (sends pre-extracted audio features)
  analyze: (audioFeatures, transcript = null) =>
    api.post('/voice/analyze', { audioFeatures, transcript }),

  // Get user's voice baseline
  getBaseline: () => api.get('/voice/baseline'),

  // Get voice analysis history
  getHistory: (limit = 10) => api.get('/voice/history', { params: { limit } }),

  // Link voice analysis to mood entry
  linkToEntry: (analysisId, entryId) =>
    api.post(`/voice/${analysisId}/link`, { entryId })
};

// Micro-Interventions API
export const interventionsAPI = {
  // Check if intervention should be shown
  check: (context) => api.get('/interventions/check', {
    params: {
      moodEntry: context.moodEntry ? JSON.stringify(context.moodEntry) : null,
      trigger: context.trigger,
      override: context.override
    }
  }),

  // Get all available interventions
  getAll: () => api.get('/interventions/all'),

  // Get specific intervention by ID
  getById: (id) => api.get(`/interventions/${id}`),

  // Get intervention by code
  getByCode: (code) => api.get(`/interventions/code/${code}`),

  // Mark intervention as completed
  complete: (id, rating = null) =>
    api.post(`/interventions/${id}/complete`, { rating }),

  // Mark intervention as skipped
  skip: (id) => api.post(`/interventions/${id}/skip`),

  // Get user's intervention history
  getHistory: (days = 30) => api.get('/interventions/history', { params: { days } }),

  // Get user's intervention statistics
  getStats: () => api.get('/interventions/stats')
};

// ============================================
// Wearable Device Integration APIs
// ============================================

// Wearables API
export const wearablesAPI = {
  // Device Management
  getAvailableDevices: () => api.get('/wearables/devices'),
  getConnections: () => api.get('/wearables/connections'),
  initiateConnection: (deviceType) => api.post(`/wearables/connect/${deviceType}`),
  connectMockDevice: (deviceType) => api.post(`/wearables/connect-mock/${deviceType}`),
  disconnectDevice: (connectionId) => api.delete(`/wearables/connections/${connectionId}`),

  // Data Sync
  syncDevice: (connectionId, days = 7) => api.post(`/wearables/sync/${connectionId}`, { days }),
  syncAllDevices: (days = 7) => api.post('/wearables/sync-all', { days }),
  getSyncHistory: (connectionId, limit = 10) =>
    api.get(`/wearables/sync-history/${connectionId}`, { params: { limit } }),

  // Biometric Data
  getBiometricData: (params) => api.get('/wearables/biometrics', { params }),
  getBiometricSummary: (days = 30) =>
    api.get('/wearables/biometrics/summary', { params: { days } }),
  getLatestBiometrics: () => api.get('/wearables/biometrics/latest'),
  getBaselines: () => api.get('/wearables/baselines'),

  // Correlations
  getCorrelations: () => api.get('/wearables/correlations'),
  calculateCorrelations: (days = 30, forceRecalculate = false) =>
    api.post('/wearables/correlations/calculate', { days, forceRecalculate }),

  // Insights
  getInsights: (unreadOnly = false, limit = 20) =>
    api.get('/wearables/insights', { params: { unreadOnly, limit } }),
  generateInsights: () => api.post('/wearables/insights/generate'),
  markInsightRead: (insightId) => api.patch(`/wearables/insights/${insightId}/read`),

  // Dashboard
  getDashboard: () => api.get('/wearables/dashboard')
};

// ============================================
// Enhancement APIs (Enhancements 1-9)
// ============================================

// Quick Check-In API (Enhancement 1)
export const quickCheckInAPI = {
  create: (data) => api.post('/quick-checkin', data)
};

// EMA API (Enhancement 2)
export const emaAPI = {
  getSchedule: () => api.get('/ema/schedule'),
  updateSchedule: (settings) => api.put('/ema/schedule', settings),
  generatePrompts: () => api.post('/ema/prompts/generate'),
  getPendingPrompts: () => api.get('/ema/prompts/pending'),
  respondToPrompt: (promptId, data) => api.post(`/ema/prompts/${promptId}/respond`, data),
  getVariability: (date) => api.get('/ema/variability', { params: { date } })
};

// Luna 2.0 API (Enhancement 3)
export const lunaAPI = {
  sendMessage: (message, sessionId) => api.post('/luna/message', { message, sessionId }),
  getJournal: (limit) => api.get('/luna/journal', { params: { limit } }),
  getProfile: () => api.get('/luna/profile'),
  updateProfile: (updates) => api.put('/luna/profile', updates),
  getTechniques: () => api.get('/luna/techniques'),
  suggestRefinements: (emotion) => api.get('/luna/refinements', { params: { emotion } }),
  getContext: () => api.get('/luna/context')
};

// Voice Signature API (Enhancement 4)
export const voiceSignatureAPI = {
  recordSample: (features, moodScore) => api.post('/voice/sample', { features, moodScore }),
  getBaseline: () => api.get('/voice/baseline'),
  getHistory: (days) => api.get('/voice/history', { params: { days } }),
  getCorrelation: () => api.get('/voice/correlation')
};

// Predictions V2 API (Enhancement 5)
export const predictionsV2API = {
  getPredictions: (days = 3) => api.get('/predictions/v2', { params: { days } }),
  trainModel: () => api.post('/predictions/v2/train'),
  getModelInfo: () => api.get('/predictions/v2/model'),
  getAccuracy: () => api.get('/predictions/v2/accuracy')
};

// Protocols API (Enhancement 6)
export const protocolsAPI = {
  getAll: () => api.get('/protocols'),
  getEnrolled: () => api.get('/protocols/enrolled'),
  enroll: (protocolId, preAssessmentScore) => api.post('/protocols/enroll', { protocolId, preAssessmentScore }),
  getCurrentSession: (protocolId) => api.get(`/protocols/${protocolId}/session`),
  completeSession: (protocolId, data) => api.post(`/protocols/${protocolId}/complete`, data),
  getProgress: (protocolId) => api.get(`/protocols/${protocolId}/progress`),
  unenroll: (protocolId) => api.delete(`/protocols/${protocolId}`)
};

// Clinical Assessments API (Enhancement 7)
export const assessmentsAPI = {
  getAvailable: () => api.get('/assessments'),
  getDue: () => api.get('/assessments/due'),
  getLatestScores: () => api.get('/assessments/scores'),
  getAssessment: (instrument) => api.get(`/assessments/${instrument}`),
  submit: (instrument, data) => api.post(`/assessments/${instrument}/submit`, data),
  getHistory: (instrument, limit) => api.get(`/assessments/${instrument}/history`, { params: { limit } })
};

// Enhanced Peer Support API (Enhancement 8)
export const enhancedPeerAPI = {
  getPattern: () => api.get('/peer-support/enhanced/pattern'),
  getMatches: () => api.get('/peer-support/enhanced/matches'),
  suggestGroup: () => api.get('/peer-support/enhanced/suggest-group'),
  createExercise: (data) => api.post('/peer-support/enhanced/exercises', data),
  getExercises: (groupId) => api.get(`/peer-support/enhanced/exercises/${groupId}`),
  respondToExercise: (exerciseId, content) => api.post(`/peer-support/enhanced/exercises/${exerciseId}/respond`, { content }),
  getMentorships: () => api.get('/peer-support/enhanced/mentorships')
};

// Clinician Reports API (Enhancement 9)
export const clinicianReportsAPI = {
  generate: (startDate, endDate) => api.post('/clinician-reports/generate', { startDate, endDate }),
  getAll: () => api.get('/clinician-reports'),
  getById: (reportId) => api.get(`/clinician-reports/${reportId}`),
  checkEscalation: () => api.get('/clinician-reports/escalation')
};

// Admin API (separate instance with admin token)
const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Admin request interceptor
adminApi.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const adminAPI = {
  checkStatus: () => adminApi.get('/admin/status'),
  login: (password) => adminApi.post('/admin/login', { password }),
  getStats: () => adminApi.get('/admin/stats'),
  getUsers: () => adminApi.get('/admin/users'),
  getMoodEntries: (params) => adminApi.get('/admin/mood-entries', { params }),
  manageUser: (userId, action) => adminApi.put(`/admin/users/${userId}`, { action }),
  getLogs: (params) => adminApi.get('/admin/logs', { params }),
  generateTestData: (config) => adminApi.post('/admin/test-data/generate', config),
  deleteTestData: () => adminApi.delete('/admin/test-data')
};

export default api;

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { configureSocketIO } = require('./config/socketio');
const { registerSocketHandlers } = require('./handlers/socketHandlers');
const { initNotificationService } = require('./services/notificationService');

// Import routes
const authRoutes = require('./routes/authRoutes');
const moodRoutes = require('./routes/moodRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const peerSupportRoutes = require('./routes/peerSupportRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
// Phase 1 - Predictive Intelligence routes
const predictiveRoutes = require('./routes/predictiveRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const interventionRoutes = require('./routes/interventionRoutes');
// Wearable Integration routes
const wearableRoutes = require('./routes/wearableRoutes');

// Initialize Express app
const app = express();

// Create HTTP server for Socket.io integration
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configure Socket.io authentication and handlers
configureSocketIO(io);

// Register socket event handlers on connection
io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

// Initialize notification service with Socket.io
const notificationService = initNotificationService(io);

// Make io and notification service available to routes
app.set('io', io);
app.set('notificationService', notificationService);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const { getActiveConnectionCount, getOnlineUserCount } = require('./config/socketio');
  res.json({
    success: true,
    message: 'Mental Health Tracker API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    websocket: {
      activeConnections: getActiveConnectionCount(),
      onlineUsers: getOnlineUserCount()
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/peer-support', peerSupportRoutes);
app.use('/api/gamification', gamificationRoutes);
// Phase 1 - Predictive Intelligence routes
app.use('/api/predictions', predictiveRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/interventions', interventionRoutes);
// Wearable Integration routes
app.use('/api/wearables', wearableRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = httpServer.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🚀 Mental Health Tracker API is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Unhandled promise rejection
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { error: err.message, stack: err.stack });
});

module.exports = { app, io, httpServer };

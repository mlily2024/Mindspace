# MindSpace - Mental Health Tracker Application
## Complete System Architecture Documentation

**Version:** 1.1.0
**Last Updated:** January 2026
**Purpose:** System recovery, rebuild reference, and development guide

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Security Implementation](#7-security-implementation)
8. [Real-time Features](#8-real-time-features)
9. [Gamification System](#9-gamification-system)
10. [Luna AI Chatbot](#10-luna-ai-chatbot)
11. [Compliance & Standards](#11-compliance--standards)
12. [Configuration Guide](#12-configuration-guide)
13. [Deployment Guide](#13-deployment-guide)
14. [Future Recommendations](#14-future-recommendations)

---

## 1. System Overview

### 1.1 Application Purpose

MindSpace is a privacy-first mental health tracking application designed to help users monitor their emotional wellbeing, identify patterns, and receive personalized support. The application prioritizes data privacy, accessibility, and evidence-based mental health support.

### 1.2 Core Features

| Feature | Description |
|---------|-------------|
| **Multi-dimensional Mood Tracking** | Track 7 metrics: mood, energy, stress, anxiety, sleep quality, sleep hours, social interaction |
| **AI-powered Insights** | Automatic trend detection, pattern analysis, and anomaly identification |
| **Adaptive Recommendations** | Personalized activities based on user patterns and preferences |
| **Luna AI Chatbot** | Supportive conversational AI with emotion detection and therapeutic techniques |
| **Peer Support Groups** | Anonymous community support with moderation |
| **Gamification** | Streaks, 40+ achievements, streak freezes, and rewards |
| **Wearable Integration** | Connect Apple Health, Fitbit, Oura Ring for biometric-mood correlations |
| **Safety Alerts** | Crisis detection with UK-specific resources |
| **Data Export (GDPR)** | Full data portability and right to deletion |
| **Accessibility** | WCAG 2.1 AA compliant with customizable settings |

### 1.3 User Groups

The application supports segmented experiences for:
- **Students** - Academic stress, exam anxiety, study-life balance
- **Professionals** - Burnout prevention, work stress, chronic fatigue
- **Parents** - Caregiver stress, emotional overload, family balance
- **Elderly** - Loneliness, grief support, routine maintenance
- **General** - Default category for all users

### 1.4 System Architecture Diagram

```
                                    [Client Browser]
                                          |
                                          v
                    +------------------------------------------+
                    |            FRONTEND (React 18)            |
                    |  - Pages (Dashboard, Tracker, Insights)   |
                    |  - Components (Chatbot, Calendar, etc.)   |
                    |  - Context (Auth, Socket)                 |
                    |  - Services (API, Socket)                 |
                    |  - Error Boundaries for resilience        |
                    +------------------------------------------+
                                          |
                          HTTP/REST + WebSocket (Socket.io)
                                          |
                                          v
                    +------------------------------------------+
                    |           BACKEND (Node.js/Express)       |
                    |  +--------------------------------------+ |
                    |  |           Middleware Layer           | |
                    |  | (Auth, Validation, Rate Limit, CORS) | |
                    |  +--------------------------------------+ |
                    |  +--------------------------------------+ |
                    |  |           Controller Layer           | |
                    |  | (Auth, Mood, Insights, Wearables)    | |
                    |  +--------------------------------------+ |
                    |  +--------------------------------------+ |
                    |  |            Service Layer             | |
                    |  | (Gamification, Insights, Wearables)  | |
                    |  +--------------------------------------+ |
                    |  +--------------------------------------+ |
                    |  |             Model Layer              | |
                    |  | (User, MoodEntry, WearableConnection)| |
                    |  +--------------------------------------+ |
                    +------------------------------------------+
                              |                   |
                              v                   v
                    +------------------+  +------------------+
                    |   PostgreSQL 14+  |  | Wearable APIs   |
                    |  - Users/Prefs    |  | - Apple Health  |
                    |  - Mood Entries   |  | - Fitbit        |
                    |  - Biometrics     |  | - Oura Ring     |
                    |  - Correlations   |  | - Garmin        |
                    +------------------+  +------------------+
```

---

## 2. Technology Stack

### 2.1 Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.18.2 | Web framework |
| PostgreSQL | 14+ | Primary database |
| Socket.io | 4.7.2 | Real-time communication |
| JWT | 9.0.2 | Authentication tokens |
| bcryptjs | 2.4.3 | Password hashing |
| crypto-js | 4.2.0 | Data encryption |
| Winston | 3.11.0 | Logging |
| Helmet | 7.1.0 | Security headers |
| express-validator | 7.0.1 | Input validation |
| express-rate-limit | 7.1.5 | Rate limiting |

### 2.2 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 5.0.8 | Build tool |
| React Router | 6.20.1 | Client routing |
| Axios | 1.6.2 | HTTP client |
| Recharts | 2.10.3 | Data visualization |
| Zustand | 4.4.7 | State management |
| socket.io-client | 4.7.2 | Real-time client |
| date-fns | 3.0.6 | Date utilities |

### 2.3 Development Tools

| Tool | Purpose |
|------|---------|
| Nodemon | Backend hot reload |
| ESLint | Code linting |
| Jest | Testing framework |
| Supertest | API testing |

---

## 3. Backend Architecture

### 3.1 Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL pool with SSL support
│   │   ├── logger.js            # Winston logging setup
│   │   └── socketio.js          # Socket.io configuration
│   │
│   ├── controllers/
│   │   ├── authController.js    # Authentication & user management
│   │   ├── moodController.js    # Mood entry CRUD operations
│   │   ├── insightsController.js    # Insights generation & retrieval
│   │   ├── recommendationController.js  # Recommendations
│   │   ├── chatbotController.js     # Luna AI chatbot
│   │   ├── peerSupportController.js # Peer support groups
│   │   ├── gamificationController.js    # Streaks & achievements
│   │   ├── wearableController.js    # Wearable device management
│   │   └── adminController.js       # Admin operations
│   │
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── adminAuth.js         # Admin authentication (hardened)
│   │   ├── validation.js        # Input validation
│   │   └── errorHandler.js      # Global error handling
│   │
│   ├── models/
│   │   ├── User.js              # User database operations
│   │   ├── MoodEntry.js         # Mood entry operations
│   │   ├── ChatbotMessage.js    # Chatbot data operations
│   │   ├── PeerSupport.js       # Peer support operations
│   │   └── WearableConnection.js # Wearable device & biometric data
│   │
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth/*
│   │   ├── moodRoutes.js        # /api/mood/*
│   │   ├── insightsRoutes.js    # /api/insights/*
│   │   ├── recommendationRoutes.js  # /api/recommendations/*
│   │   ├── chatbotRoutes.js     # /api/chatbot/*
│   │   ├── peerSupportRoutes.js # /api/peer-support/*
│   │   ├── gamificationRoutes.js    # /api/gamification/*
│   │   ├── wearableRoutes.js    # /api/wearables/*
│   │   └── adminRoutes.js       # /api/admin/*
│   │
│   ├── services/
│   │   ├── gamificationService.js   # Streaks, achievements logic
│   │   ├── insightsEngine.js        # Analytics & patterns
│   │   ├── recommendationService.js # Recommendation generation
│   │   ├── notificationService.js   # Real-time notifications
│   │   ├── peerModerationService.js # Content moderation
│   │   ├── dataExportService.js     # GDPR data export
│   │   ├── wearableService.js       # Wearable OAuth & sync
│   │   ├── biometricCorrelationService.js # Biometric-mood correlations
│   │   ├── mockWearableProviders.js # Mock data for development
│   │   ├── predictiveMoodService.js # Mood prediction with biometrics
│   │   ├── mlEngine.js              # ML features (placeholder)
│   │   ├── trendPredictor.js        # Trend analysis
│   │   └── userSegmentation.js      # User grouping
│   │
│   ├── handlers/
│   │   └── socketHandlers.js    # WebSocket event handlers
│   │
│   ├── data/
│   │   └── therapeuticTechniques.js # Breathing, grounding exercises
│   │
│   ├── utils/
│   │   └── encryption.js        # AES-256 encryption utilities
│   │
│   └── server.js                # Main Express application
│
├── database/
│   └── migrations/
│       ├── 001_add_streak_freeze.sql
│       ├── 002_phase1_features.sql
│       └── 003_wearable_integration.sql
│
├── package.json
├── .env.example
└── .env
```

### 3.2 Controller Functions

#### AuthController (`authController.js`)
| Function | Description |
|----------|-------------|
| `register()` | User registration with validation |
| `login()` | User authentication, JWT generation |
| `getProfile()` | Fetch user profile with preferences |
| `updateProfile()` | Update username, user group, timezone |
| `updatePreferences()` | Update theme, language, accessibility |
| `deleteAccount()` | Soft delete (GDPR compliant) |
| `requestDataExport()` | Generate data export |
| `downloadDataExport()` | Download exported data |
| `permanentDeleteAccount()` | Hard delete all user data |

#### MoodController (`moodController.js`)
| Function | Description |
|----------|-------------|
| `createMoodEntry()` | Create entry with 7 metrics + gamification update |
| `getMoodEntries()` | Get entries with date filtering, pagination |
| `getMoodEntry()` | Get single entry by ID |
| `updateMoodEntry()` | Update entry fields |
| `deleteMoodEntry()` | Delete entry |
| `getMoodStatistics()` | Calculate avg, min, max statistics |
| `getMoodTrends()` | Generate trend data (daily/weekly/monthly) |

#### InsightsController (`insightsController.js`)
| Function | Description |
|----------|-------------|
| `generateInsights()` | Auto-generate insights from mood data |
| `getInsights()` | Get insights (paginated, unread filter) |
| `markInsightRead()` | Mark insight as read |
| `getSafetyAlerts()` | Get safety alerts |
| `acknowledgeSafetyAlert()` | Acknowledge with action |
| `getPatternAnalysis()` | Analyze mood patterns |

#### ChatbotController (`chatbotController.js`)
| Function | Description |
|----------|-------------|
| `chat()` | Process message, detect emotion, generate response |
| `getHistory()` | Get conversation history |
| `newConversation()` | Start fresh conversation |
| `getPastConversations()` | Get past conversations |

#### PeerSupportController (`peerSupportController.js`)
| Function | Description |
|----------|-------------|
| `getGroups()` | List all groups |
| `getGroupById()` | Get group details |
| `createGroup()` | Create new group |
| `joinGroup()` | Join with anonymous nickname |
| `leaveGroup()` | Leave group |
| `getUserGroups()` | Get user's groups |
| `getGroupMembers()` | Get members (members only) |
| `getMessages()` | Get group messages |
| `sendMessage()` | Send message (with moderation) |
| `flagMessage()` | Flag inappropriate message |
| `deleteMessage()` | Delete own message |
| `getFlaggedMessages()` | Get flagged messages (moderator) |
| `moderateMessage()` | Approve/delete (moderator) |
| `generateNickname()` | Generate unique nickname |

#### GamificationController (`gamificationController.js`)
| Function | Description |
|----------|-------------|
| `getStreak()` | Get streak information |
| `useStreakFreeze()` | Use freeze to maintain streak |
| `getAchievements()` | Get all achievements with earned status |
| `getUserAchievements()` | Get earned achievements |
| `checkAchievements()` | Check for newly earned |
| `markAchievementsNotified()` | Mark as notified |
| `getGamificationStats()` | Get combined stats |

#### WearableController (`wearableController.js`)
| Function | Description |
|----------|-------------|
| `getAvailableDevices()` | List supported wearable devices |
| `initiateConnection()` | Start OAuth flow for device |
| `handleCallback()` | Handle OAuth callback |
| `getConnections()` | Get user's connected devices |
| `disconnectDevice()` | Disconnect a device |
| `syncDevice()` | Trigger manual data sync |
| `getBiometricData()` | Get synced biometric data |
| `getLatestBiometrics()` | Get latest values for each type |
| `getCorrelations()` | Get biometric-mood correlations |
| `calculateCorrelations()` | Calculate new correlations |
| `getInsights()` | Get biometric insights |
| `generateInsights()` | Generate new insights |
| `markInsightRead()` | Mark insight as read |
| `connectMockDevice()` | Connect mock device (dev mode) |

#### AdminController (`adminController.js`)
| Function | Description |
|----------|-------------|
| `login()` | Admin authentication (requires ADMIN_PASSWORD) |
| `getUsers()` | Get all users |
| `manageUser()` | Manage user status |
| `getMoodEntries()` | Get all mood entries |
| `getStats()` | Get database statistics |
| `getLogs()` | Get system logs |
| `generateTestData()` | Generate test data |
| `deleteTestData()` | Delete test data |

### 3.3 Middleware Functions

#### Authentication (`auth.js`)
```javascript
authenticateToken()   // Verify JWT token from Authorization header
optionalAuth()        // Allow authenticated OR anonymous access
authorize(roles)      // Check role-based permissions
```

#### Admin Authentication (`adminAuth.js`) - Hardened
```javascript
adminLogin()          // Admin login - requires ADMIN_PASSWORD (min 12 chars)
                      // Uses timing-safe comparison to prevent timing attacks
                      // No development bypass - always requires authentication
verifyAdmin()         // Verify admin JWT token - no bypass modes
checkAdminStatus()    // Check if authenticated as admin
```

**Security Notes:**
- Admin password MUST be set via `ADMIN_PASSWORD` environment variable
- Minimum 12-character password required
- No development mode bypass - authentication always required
- Timing-safe password comparison prevents timing attacks

#### Validation (`validation.js`)
```javascript
validateRequest()     // Express-validator integration
handleValidationErrors() // Format and return validation errors
```

#### Error Handler (`errorHandler.js`)
```javascript
errorHandler()        // Global error handler with logging
notFound()            // 404 handler
```

### 3.4 Service Layer

#### GamificationService (`gamificationService.js`)
- `updateStreak()` - Calculate and update user streak on check-in
- `checkAndAwardAchievements()` - Award achievements based on criteria
- `getStreak()` - Fetch current streak data
- `getAchievements()` - Get all achievements with earned status
- `getUserAchievements()` - Get user's earned achievements only
- `getUserStats()` - Calculate total check-ins, journal entries, etc.
- `useStreakFreeze()` - Consume one freeze to maintain streak
- `awardStreakFreeze()` - Award freeze (weekly reward for 7+ day streaks)

#### InsightsEngine (`insightsEngine.js`)
- `generateInsights()` - Generate trends, patterns, anomalies
- `getUserInsights()` - Get insights with filtering
- `markAsRead()` - Mark insight as read
- `getSafetyAlerts()` - Get safety alerts
- `acknowledgeSafetyAlert()` - Acknowledge alert
- `getPatternAnalysis()` - Analyze mood patterns by day/time

#### RecommendationService (`recommendationService.js`)
- `generateRecommendations()` - Generate personalized recommendations
- `getRecommendations()` - Get active recommendations
- `completeRecommendation()` - Mark as completed
- `submitFeedback()` - Collect recommendation feedback

#### NotificationService (`notificationService.js`)
- `initNotificationService()` - Initialize with Socket.io instance
- `sendSafetyAlert()` - Broadcast safety alert to user
- `sendAchievementNotification()` - Broadcast achievement earned
- `sendInsightNotification()` - Broadcast new insight available
- `sendPeerMessage()` - Broadcast new peer message
- `sendStreakUpdate()` - Broadcast streak changes

#### DataExportService (`dataExportService.js`)
- `generateExport()` - Export all user data (JSON format)
- `deleteUserData()` - Permanent data deletion (GDPR)

#### WearableService (`wearableService.js`)
- `getAvailableDevices()` - List supported wearable devices (Apple Health, Fitbit, Oura, Garmin)
- `initiateConnection()` - Start OAuth 2.0 flow
- `handleOAuthCallback()` - Process OAuth callback, store encrypted tokens
- `refreshAccessToken()` - Refresh expired OAuth tokens
- `syncDeviceData()` - Sync biometric data from device APIs
- `disconnectDevice()` - Revoke access and remove connection

#### BiometricCorrelationService (`biometricCorrelationService.js`)
- `calculateCorrelations()` - Calculate Pearson correlations between biometrics and mood
- `analyzeCorrelation()` - Analyze single biometric-mood correlation with p-value
- `generateCorrelationInsights()` - Generate insights from significant correlations
- `identifyPatterns()` - Identify actionable patterns from data
- Statistical significance testing (p < 0.05 threshold)

#### PredictiveMoodService (`predictiveMoodService.js`)
- `getEnhancedPredictions()` - Get mood predictions with biometric factors
- `calculateBiometricFactors()` - Calculate biometric influence on mood
- `generateBiometricPreventiveActions()` - Suggest actions based on biometrics

---

## 4. Frontend Architecture

### 4.1 Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Chatbot.jsx              # Luna floating widget
│   │   ├── BreathingExercise.jsx    # Guided breathing
│   │   ├── GroundingExercise.jsx    # 5-4-3-2-1 technique
│   │   ├── MoodCalendar.jsx         # Calendar view
│   │   ├── EmojiMoodPicker.jsx      # Emoji mood selector
│   │   ├── StreakDisplay.jsx        # Streak visualization
│   │   ├── AchievementNotification.jsx  # Achievement popup
│   │   ├── NotificationCenter.jsx   # Notification list
│   │   ├── Navigation.jsx           # Navigation bar
│   │   ├── ErrorBoundary.jsx        # Error boundary for resilience
│   │   ├── WearableCard.jsx         # Wearable device cards
│   │   ├── BiometricInsights.jsx    # Biometric correlation display
│   │   └── peer/
│   │       ├── GroupCard.jsx        # Group card component
│   │       ├── GroupList.jsx        # Groups listing
│   │       ├── ChatRoom.jsx         # Group chat interface
│   │       ├── MessageBubble.jsx    # Message display
│   │       └── AnonymousNicknameModal.jsx
│   │
│   ├── pages/
│   │   ├── Landing.jsx              # Home page
│   │   ├── Login.jsx                # Login form
│   │   ├── Register.jsx             # Registration form
│   │   ├── Dashboard.jsx            # Main dashboard
│   │   ├── MoodTracker.jsx          # Mood entry form
│   │   ├── Insights.jsx             # Insights & calendar
│   │   ├── Recommendations.jsx      # Activity suggestions
│   │   ├── PeerSupport.jsx          # Community groups
│   │   ├── Journal.jsx              # Journal entries
│   │   ├── Settings.jsx             # User settings
│   │   ├── WearableSettings.jsx     # Wearable device management
│   │   ├── CrisisResources.jsx      # Crisis support
│   │   ├── AdminLogin.jsx           # Admin login
│   │   └── AdminDashboard.jsx       # Admin panel
│   │
│   ├── context/
│   │   ├── AuthContext.jsx          # Authentication state
│   │   └── SocketContext.jsx        # WebSocket state
│   │
│   ├── services/
│   │   ├── api.js                   # Axios API service (includes wearablesAPI)
│   │   └── socket.js                # Socket.io client
│   │
│   ├── styles/
│   │   ├── App.css                  # Main styles
│   │   └── variables.css            # CSS custom properties
│   │
│   ├── App.jsx                      # Main app with routing & ErrorBoundary
│   └── main.jsx                     # React entry point
│
├── index.html
├── vite.config.js
└── package.json
```

### 4.2 Pages Overview

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Home page with features overview |
| Login | `/login` | User login form |
| Register | `/register` | User registration form |
| Dashboard | `/dashboard` | Main dashboard with mood overview |
| MoodTracker | `/mood-tracker` | Create/edit mood entries |
| Insights | `/insights` | View insights, patterns, calendar |
| Recommendations | `/recommendations` | Personalized activities |
| PeerSupport | `/peer-support` | Community support groups |
| Journal | `/journal` | Personal journal entries |
| Settings | `/settings` | User preferences |
| WearableSettings | `/wearables` | Wearable device connection & biometrics |
| CrisisResources | `/crisis-resources` | Emergency support |
| AdminLogin | `/admin` | Admin authentication |
| AdminDashboard | `/admin/dashboard` | Admin management |

### 4.3 Component Descriptions

#### Chatbot.jsx (Luna AI)
- Floating action button (FAB) for quick access
- Expandable chat interface
- Message history display
- Quick action buttons (breathing, grounding, affirmation)
- Typing indicator animation
- Emotion-aware responses

#### MoodCalendar.jsx
- Monthly calendar view
- Color-coded days by mood score
- Day selection for details
- Navigation between months
- Mood emoji indicators
- Legend for color meanings

#### AchievementNotification.jsx
- Modal popup for new achievements
- Animation effects (bounce, pulse)
- Multiple achievement queue support
- Toast notification variant
- Points display

#### StreakDisplay.jsx
- Current streak visualization
- Streak freeze availability
- Longest streak record
- Total check-ins counter

#### ErrorBoundary.jsx
- Catches JavaScript errors in component tree
- Displays user-friendly fallback UI
- "Try Again" and "Go to Dashboard" recovery options
- Shows error details in development mode only
- Prevents entire app from crashing

#### WearableCard.jsx
- Device card with connection status
- Connect/disconnect buttons
- Sync status and last sync time
- Permission display
- WearableDeviceList for listing all devices
- BiometricSummaryCard for latest readings

#### BiometricInsights.jsx
- BiometricInsightCard for individual insights
- CorrelationDisplay for mood-biometric correlations
- BiometricTrendChart for visualizing trends
- Insight priority and actionability indicators

### 4.4 Context Providers

#### AuthContext.jsx

**State:**
```javascript
{
  user: Object | null,      // Current user data
  loading: Boolean,         // Auth state loading
  error: String | null,     // Auth errors
  isAuthenticated: Boolean  // Login status
}
```

**Methods:**
```javascript
checkAuth()              // Verify token on app load
register(userData)       // Register new user
login(credentials)       // User login
logout()                 // Clear auth state
updateProfile(data)      // Update user profile
updatePreferences(data)  // Update settings
```

#### SocketContext.jsx

**State:**
```javascript
{
  socket: Object | null,    // Socket.io instance
  isConnected: Boolean,     // Connection status
  notifications: Array,     // Notification list
  unreadCount: Number       // Unread count
}
```

**Event Handlers:**
```javascript
handleSafetyAlert()         // Safety notification
handleAchievement()         // Achievement earned
handleNewInsight()          // New insight available
handleNewRecommendation()   // New recommendation
handleStreakUpdate()        // Streak changes
handleCrisisResources()     // Crisis resources
```

### 4.5 API Service (`api.js`)

```javascript
// Axios instance configuration
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - add JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle 401 errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Groups
export const authAPI = { ... }
export const moodAPI = { ... }
export const insightsAPI = { ... }
export const recommendationsAPI = { ... }
export const chatbotAPI = { ... }
export const peerSupportAPI = { ... }
export const gamificationAPI = { ... }
export const wearablesAPI = { ... }  // Wearable device & biometric APIs
export const adminAPI = { ... }
```

### 4.6 Routing Configuration

```javascript
// App.jsx routing structure - wrapped in ErrorBoundary
<ErrorBoundary>
  <AuthProvider>
    <SocketProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/crisis-resources" element={<CrisisResources />} />

        {/* Protected routes (require authentication) */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/mood-tracker" element={<ProtectedRoute><MoodTracker /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
        <Route path="/peer-support" element={<ProtectedRoute><PeerSupport /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/wearables" element={<ProtectedRoute><WearableSettings /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </SocketProvider>
  </AuthProvider>
</ErrorBoundary>
```

---

## 5. Database Schema

### 5.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     USERS       │       │  MOOD_ENTRIES   │       │  USER_INSIGHTS  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ user_id (PK)    │──┐    │ entry_id (PK)   │       │ insight_id (PK) │
│ email           │  │    │ user_id (FK)────│───┐   │ user_id (FK)────│───┐
│ username        │  │    │ entry_date      │   │   │ insight_type    │   │
│ password_hash   │  │    │ mood_score      │   │   │ insight_data    │   │
│ user_group      │  │    │ energy_level    │   │   │ severity        │   │
│ timezone        │  │    │ stress_level    │   │   │ is_read         │   │
│ account_status  │  │    │ anxiety_level   │   │   │ generated_at    │   │
│ created_at      │  │    │ sleep_quality   │   │   └────────┬────────┘   │
└────────┬────────┘  │    │ sleep_hours     │   │            │            │
         │           │    │ social_quality  │   │            │            │
         │           │    │ notes (encrypt) │   │            │            │
         │           │    │ activities      │   │            │            │
         │           │    └────────┬────────┘   │            │            │
         │           │             │            │            │            │
         │           │             │            │            │            │
         │    ┌──────┴─────────────┴────────────┴────────────┴────────────┘
         │    │
         │    │  ┌─────────────────┐       ┌─────────────────┐
         │    │  │ USER_PREFERENCES│       │  USER_STREAKS   │
         │    │  ├─────────────────┤       ├─────────────────┤
         │    └──│ preference_id   │       │ streak_id (PK)  │
         │       │ user_id (FK)────│───┐   │ user_id (FK)────│───┐
         │       │ theme           │   │   │ current_streak  │   │
         │       │ font_size       │   │   │ longest_streak  │   │
         │       │ language        │   │   │ last_check_in   │   │
         │       │ accessibility   │   │   │ streak_freezes  │   │
         │       │ notifications   │   │   │ total_check_ins │   │
         │       └─────────────────┘   │   └─────────────────┘   │
         │                             │                         │
         │                             │                         │
┌────────┴────────┐       ┌────────────┴───┐       ┌─────────────┴───┐
│ ACHIEVEMENTS    │       │USER_ACHIEVEMENTS│      │ SAFETY_ALERTS   │
├─────────────────┤       ├────────────────┤       ├─────────────────┤
│ achievement_id  │◄──────│ user_achiev_id │       │ alert_id (PK)   │
│ achievement_code│       │ user_id (FK)   │       │ user_id (FK)    │
│ title           │       │ achievement_id │       │ alert_type      │
│ description     │       │ earned_at      │       │ severity        │
│ icon            │       │ is_notified    │       │ alert_data      │
│ category        │       └────────────────┘       │ is_acknowledged │
│ points          │                                └─────────────────┘
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ PEER_GROUPS     │       │ GROUP_MEMBERS   │       │ PEER_MESSAGES   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ group_id (PK)   │◄──────│ membership_id   │       │ message_id (PK) │
│ group_name      │       │ group_id (FK)───│───┐   │ group_id (FK)───│───┐
│ group_type      │       │ user_id (FK)    │   │   │ user_id (FK)    │   │
│ description     │       │ anon_nickname   │   │   │ anon_nickname   │   │
│ max_members     │       │ is_moderator    │   │   │ message_content │   │
│ is_moderated    │       │ joined_at       │   │   │ is_flagged      │   │
│ is_active       │       └─────────────────┘   │   │ flag_reason     │   │
└─────────────────┘                             │   │ is_deleted      │   │
                                                │   └─────────────────┘   │
                                                │                         │
┌─────────────────┐       ┌─────────────────┐   │                         │
│ CHATBOT_CONVOS  │       │CHATBOT_MESSAGES │   │                         │
├─────────────────┤       ├─────────────────┤   │                         │
│ conversation_id │◄──────│ message_id (PK) │   │                         │
│ user_id (FK)────│───────│ conversation_id │   │                         │
│ started_at      │       │ user_id (FK)────│───┘                         │
│ ended_at        │       │ sender          │                             │
│ is_active       │       │ message_content │                             │
│ mood_at_start   │       │ message_type    │                             │
│ mood_at_end     │       │ emotion_detected│                             │
└─────────────────┘       └─────────────────┘                             │
                                                                          │
┌─────────────────┐       ┌─────────────────┐                             │
│ RECOMMENDATIONS │       │  AUDIT_LOG      │                             │
├─────────────────┤       ├─────────────────┤                             │
│ recommendation_id│      │ log_id (PK)     │                             │
│ user_id (FK)────│───────│ user_id (FK)────│─────────────────────────────┘
│ rec_type        │       │ action          │
│ title           │       │ resource_type   │
│ description     │       │ resource_id     │
│ effort_level    │       │ ip_address      │
│ is_completed    │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

### 5.2 Table Definitions

#### Users Table
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,
  user_group VARCHAR(50) CHECK (user_group IN ('student', 'professional', 'parent', 'elderly', 'other')),
  date_of_birth DATE,
  timezone VARCHAR(50) DEFAULT 'Europe/London',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'deleted')),
  data_retention_consent BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE
);
```

#### User Preferences Table
```sql
CREATE TABLE user_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'en-GB',
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  accessibility_mode BOOLEAN DEFAULT FALSE,
  font_size VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'xl')),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  data_sharing_consent BOOLEAN DEFAULT FALSE,
  peer_support_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Mood Entries Table
```sql
CREATE TABLE mood_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_time TIME DEFAULT CURRENT_TIME,
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  sleep_hours DECIMAL(3,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
  social_interaction_quality INTEGER CHECK (social_interaction_quality BETWEEN 1 AND 10),
  notes TEXT,
  activities JSONB DEFAULT '[]',
  triggers JSONB DEFAULT '[]',
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, entry_date, entry_time)
);

CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, entry_date);
```

#### User Streaks Table
```sql
CREATE TABLE user_streaks (
  streak_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_check_in_date DATE,
  streak_started_at DATE,
  total_check_ins INTEGER DEFAULT 0,
  streak_freezes_available INTEGER DEFAULT 0 CHECK (streak_freezes_available <= 3),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
```

#### Achievements Table
```sql
CREATE TABLE achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  category VARCHAR(30) CHECK (category IN ('streak', 'check_in', 'engagement', 'wellness', 'social', 'milestone')),
  requirement_value INTEGER,
  requirement_type VARCHAR(30),
  points INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE
);
```

#### User Achievements Table
```sql
CREATE TABLE user_achievements (
  user_achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(achievement_id),
  earned_at TIMESTAMP DEFAULT NOW(),
  is_notified BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
```

#### Chatbot Conversations Table
```sql
CREATE TABLE chatbot_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  mood_at_start INTEGER CHECK (mood_at_start BETWEEN 1 AND 10),
  mood_at_end INTEGER CHECK (mood_at_end BETWEEN 1 AND 10),
  conversation_summary TEXT
);

CREATE INDEX idx_chatbot_conversations_user ON chatbot_conversations(user_id);
```

#### Chatbot Messages Table
```sql
CREATE TABLE chatbot_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chatbot_conversations(conversation_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  sender VARCHAR(20) CHECK (sender IN ('user', 'luna')),
  message_content TEXT NOT NULL,
  message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN ('text', 'breathing_exercise', 'grounding', 'affirmation', 'check_in', 'resource', 'crisis')),
  emotion_detected VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chatbot_messages_conversation ON chatbot_messages(conversation_id);
```

#### Peer Support Groups Table
```sql
CREATE TABLE peer_support_groups (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name VARCHAR(255) NOT NULL,
  group_type VARCHAR(50) CHECK (group_type IN ('student', 'professional', 'parent', 'elderly', 'general')),
  description TEXT,
  max_members INTEGER DEFAULT 50,
  is_moderated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

#### Group Members Table
```sql
CREATE TABLE group_members (
  membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES peer_support_groups(group_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  anonymous_nickname VARCHAR(100) NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  is_moderator BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(group_id, user_id)
);
```

#### Safety Alerts Table
```sql
CREATE TABLE safety_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  alert_type VARCHAR(50) CHECK (alert_type IN ('high_stress', 'mood_decline', 'crisis_indicator', 'prolonged_distress')),
  severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  alert_data JSONB,
  triggered_at TIMESTAMP DEFAULT NOW(),
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  action_taken TEXT
);

CREATE INDEX idx_safety_alerts_user ON safety_alerts(user_id);
```

---

## 6. API Reference

### 6.1 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/profile` | Get user profile | Yes |
| PUT | `/api/auth/profile` | Update profile | Yes |
| PUT | `/api/auth/preferences` | Update preferences | Yes |
| DELETE | `/api/auth/account` | Soft delete account | Yes |
| POST | `/api/auth/data-export` | Request data export | Yes |
| GET | `/api/auth/data-export/download` | Download export | Yes |
| DELETE | `/api/auth/account/permanent` | Permanent deletion | Yes |

### 6.2 Mood Tracking Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/mood` | Create mood entry | Yes |
| GET | `/api/mood` | Get mood entries | Yes |
| GET | `/api/mood/:entryId` | Get specific entry | Yes |
| PUT | `/api/mood/:entryId` | Update entry | Yes |
| DELETE | `/api/mood/:entryId` | Delete entry | Yes |
| GET | `/api/mood/statistics` | Get statistics | Yes |
| GET | `/api/mood/trends` | Get trends | Yes |

### 6.3 Insights Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/insights/generate` | Generate insights | Yes |
| GET | `/api/insights` | Get insights | Yes |
| GET | `/api/insights/patterns` | Get patterns | Yes |
| PUT | `/api/insights/:insightId/read` | Mark as read | Yes |
| GET | `/api/insights/safety-alerts` | Get safety alerts | Yes |
| PUT | `/api/insights/safety-alerts/:alertId/acknowledge` | Acknowledge alert | Yes |

### 6.4 Recommendations Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/recommendations/crisis-resources` | Get crisis resources | No |
| POST | `/api/recommendations/generate` | Generate recommendations | Yes |
| GET | `/api/recommendations` | Get recommendations | Yes |
| PUT | `/api/recommendations/:id/complete` | Mark complete | Yes |
| POST | `/api/recommendations/:id/feedback` | Submit feedback | Yes |

### 6.5 Chatbot Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/chatbot/chat` | Send message | Yes |
| GET | `/api/chatbot/history` | Get history | Yes |
| POST | `/api/chatbot/new` | New conversation | Yes |
| GET | `/api/chatbot/conversations` | Get past conversations | Yes |

### 6.6 Peer Support Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/peer-support/groups` | Get all groups | Yes |
| GET | `/api/peer-support/my-groups` | Get user's groups | Yes |
| GET | `/api/peer-support/groups/:groupId` | Get group | Yes |
| POST | `/api/peer-support/groups` | Create group | Yes |
| POST | `/api/peer-support/groups/:groupId/join` | Join group | Yes |
| POST | `/api/peer-support/groups/:groupId/leave` | Leave group | Yes |
| GET | `/api/peer-support/groups/:groupId/messages` | Get messages | Yes |
| POST | `/api/peer-support/groups/:groupId/messages` | Send message | Yes |
| POST | `/api/peer-support/messages/:messageId/flag` | Flag message | Yes |

### 6.7 Gamification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/gamification/streak` | Get streak info | Yes |
| POST | `/api/gamification/streak/freeze` | Use streak freeze | Yes |
| GET | `/api/gamification/achievements` | Get all achievements | Yes |
| GET | `/api/gamification/achievements/earned` | Get earned | Yes |
| POST | `/api/gamification/achievements/check` | Check new | Yes |
| POST | `/api/gamification/achievements/notified` | Mark notified | Yes |
| GET | `/api/gamification/stats` | Get stats | Yes |

### 6.8 Wearables Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/wearables/devices` | List available wearable devices | Yes |
| POST | `/api/wearables/connect/:deviceType` | Initiate OAuth connection | Yes |
| GET | `/api/wearables/callback/:deviceType` | OAuth callback handler | Yes |
| GET | `/api/wearables/connections` | Get user's connections | Yes |
| DELETE | `/api/wearables/connections/:connectionId` | Disconnect device | Yes |
| POST | `/api/wearables/sync/:connectionId` | Manual data sync | Yes |
| GET | `/api/wearables/biometrics` | Get biometric data | Yes |
| GET | `/api/wearables/biometrics/latest` | Get latest readings | Yes |
| GET | `/api/wearables/correlations` | Get mood correlations | Yes |
| POST | `/api/wearables/correlations/calculate` | Calculate correlations | Yes |
| GET | `/api/wearables/insights` | Get biometric insights | Yes |
| POST | `/api/wearables/insights/generate` | Generate new insights | Yes |
| PUT | `/api/wearables/insights/:insightId/read` | Mark insight read | Yes |
| POST | `/api/wearables/mock/:deviceType` | Connect mock device (dev) | Yes |

### 6.9 Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/admin/login` | Admin login (requires ADMIN_PASSWORD) | No |
| GET | `/api/admin/status` | Check admin status | Admin |
| GET | `/api/admin/users` | Get all users | Admin |
| PUT | `/api/admin/users/:userId` | Manage user | Admin |
| GET | `/api/admin/stats` | Get database stats | Admin |
| GET | `/api/admin/logs` | Get system logs | Admin |

---

## 7. Security Implementation

### 7.1 Authentication Flow

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Client  │         │  API    │         │   DB    │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │  POST /login      │                   │
     │  {email, pass}    │                   │
     │──────────────────►│                   │
     │                   │  Query user       │
     │                   │──────────────────►│
     │                   │  User record      │
     │                   │◄──────────────────│
     │                   │                   │
     │                   │  bcrypt.compare() │
     │                   │  ───────────────  │
     │                   │                   │
     │                   │  jwt.sign()       │
     │                   │  ───────────────  │
     │                   │                   │
     │  {token, user}    │                   │
     │◄──────────────────│                   │
     │                   │                   │
     │  Store token      │                   │
     │  localStorage     │                   │
     │                   │                   │
```

### 7.2 Security Measures

| Measure | Implementation |
|---------|---------------|
| **Password Hashing** | bcryptjs with 10 salt rounds |
| **JWT Tokens** | 7-day expiration, secure secret |
| **Data Encryption** | AES-256 for sensitive notes and OAuth tokens |
| **OAuth Token Encryption** | Tokens encrypted at rest in database |
| **Admin Authentication** | No bypass modes, timing-safe comparison, min 12-char password |
| **Rate Limiting** | 100 requests per 15 minutes |
| **Security Headers** | Helmet.js (HSTS, CSP, X-Frame, etc.) |
| **Input Validation** | express-validator on all inputs |
| **SQL Injection** | Parameterized queries only |
| **XSS Protection** | CSP headers + React escaping |
| **CORS** | Whitelist allowed origins |
| **SSL/TLS** | Certificate verification enabled in production |
| **Error Handling** | React ErrorBoundary prevents crash exposure |

### 7.3 Data Encryption

```javascript
// Encryption utility (utils/encryption.js)
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Encrypt sensitive data
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

// Decrypt sensitive data
function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### 7.4 Rate Limiting Configuration

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
```

---

## 8. Real-time Features

### 8.1 Socket.io Implementation

**Server Setup (`config/socketio.js`):**
```javascript
const { Server } = require('socket.io');

function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS.split(','),
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // Join user's personal room
    socket.on('join', (userId) => {
      socket.join(`user:${userId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Cleanup
    });
  });

  return io;
}
```

### 8.2 Notification Events

| Event | Description | Payload |
|-------|-------------|---------|
| `safety_alert` | Safety alert triggered | `{ alertId, type, severity, message }` |
| `achievement_earned` | Achievement unlocked | `{ achievementId, title, icon, points }` |
| `new_insight` | New insight available | `{ insightId, type, summary }` |
| `streak_update` | Streak changed | `{ currentStreak, longestStreak }` |
| `peer_message` | New group message | `{ groupId, messageId, nickname }` |

### 8.3 Client Integration

```javascript
// SocketContext.jsx
useEffect(() => {
  const socket = io(SOCKET_URL, {
    auth: { token: localStorage.getItem('token') }
  });

  socket.on('safety_alert', handleSafetyAlert);
  socket.on('achievement_earned', handleAchievement);
  socket.on('new_insight', handleNewInsight);
  socket.on('streak_update', handleStreakUpdate);

  return () => socket.disconnect();
}, []);
```

---

## 9. Gamification System

### 9.1 Streak Mechanics

```
Day 1: User checks in → current_streak = 1
Day 2: User checks in → current_streak = 2
Day 3: User misses   → Check for freeze
  - If freeze available: Use freeze, streak maintained
  - If no freeze: current_streak = 0
Day 4: User checks in → current_streak = 1 (or 4 if freeze used)
```

**Streak Freeze Rules:**
- Maximum 3 freezes can be stored
- One freeze earned per week (7+ day streak)
- Freeze used automatically on missed day
- Cannot earn freeze while one is active

### 9.2 Achievement Categories

| Category | Description | Example Achievements |
|----------|-------------|---------------------|
| **Streak** | Consecutive check-in days | 3-day, 7-day, 30-day, 100-day |
| **Check-in** | Total check-in count | 10, 25, 50, 100 check-ins |
| **Engagement** | Feature usage | First chat, breathing exercises |
| **Wellness** | Mood improvements | Rising spirits, self-care |
| **Social** | Community activity | Joining groups, helping others |
| **Milestone** | Special events | Night owl, early bird, weekend warrior |

### 9.3 Achievement List (40+ Total)

**Streak Achievements:**
- First Step (1 check-in) - 10 pts
- Getting Started (3-day streak) - 25 pts
- Week Warrior (7-day streak) - 50 pts
- Fortnight Fighter (14-day streak) - 75 pts
- Monthly Master (30-day streak) - 150 pts
- Century Club (100-day streak) - 500 pts

**Check-in Achievements:**
- Getting Consistent (10 check-ins) - 25 pts
- Building Habits (25 check-ins) - 50 pts
- Dedicated Tracker (50 check-ins) - 100 pts
- Centurion (100 check-ins) - 200 pts

**Engagement Achievements:**
- Made a Friend (First Luna chat) - 15 pts
- Regular Chatter (10 chats) - 30 pts
- Luna's Friend (50 chats) - 75 pts
- Deep Breath (First breathing exercise) - 15 pts
- Breath Aware (10 exercises) - 30 pts
- Grounded (First grounding exercise) - 15 pts

**Wellness Achievements:**
- Rising Spirits (Mood improvement) - 25 pts
- Self-Care Champion (Complete 5 recommendations) - 50 pts
- Mood Explorer (Track all 7 metrics) - 20 pts

**Time-based Achievements:**
- Night Owl (Check-in after 10 PM) - 10 pts
- Early Bird (Check-in before 7 AM) - 10 pts
- Weekend Warrior (Weekend check-in) - 15 pts

---

## 10. Luna AI Chatbot

### 10.1 Emotion Detection

Luna detects 10 emotion categories using regex pattern matching:

| Emotion | Pattern Keywords | Priority |
|---------|-----------------|----------|
| **Crisis** | suicide, kill myself, end my life, want to die | 1 (highest) |
| **Anxiety** | anxious, panic, scared, overwhelmed, racing thoughts | 2 |
| **Depression** | depressed, sad, hopeless, empty, worthless | 3 |
| **Angry** | angry, furious, frustrated, irritated, rage | 4 |
| **Stressed** | stressed, pressure, burnout, can't cope | 5 |
| **Positive** | happy, great, grateful, excited, hopeful | 6 |
| **Tired** | tired, exhausted, fatigued, no energy | 7 |
| **Confused** | confused, lost, uncertain, mixed feelings | 8 |
| **Lonely** | lonely, isolated, disconnected, invisible | 9 |
| **Guilty** | guilty, ashamed, regret, blame myself | 10 |

### 10.2 Response Templates

Each emotion has 3-4 response variations to avoid repetition:

```javascript
responses: {
  anxiety: [
    "I hear that you're feeling anxious...",
    "Anxiety can feel so overwhelming...",
    "Those anxious feelings are your mind trying to protect you...",
    "I understand how challenging anxiety can be..."
  ],
  // ... more emotions
}
```

### 10.3 Therapeutic Techniques

**Breathing Exercises:**
- 4-7-8 Technique (Inhale 4s, Hold 7s, Exhale 8s)
- Box Breathing (4s each: inhale, hold, exhale, hold)
- Belly Breathing

**Grounding Exercises:**
- 5-4-3-2-1 Technique (5 things you see, 4 hear, 3 touch, 2 smell, 1 taste)
- Body Scan
- Object Focus

**Affirmations:**
- Rotating set of 20+ positive affirmations
- Context-appropriate based on detected emotion

### 10.4 Crisis Response Protocol

When crisis keywords detected:
1. Log event for safety monitoring
2. Return immediate crisis response
3. Display UK crisis resources:
   - Samaritans: 116 123
   - Text SHOUT: 85258
   - NHS Crisis Line: 111 (press 2)
   - Papyrus (under 35): 0800 068 4141

---

## 11. Compliance & Standards

### 11.1 GDPR Compliance

| Requirement | Implementation |
|-------------|---------------|
| **Lawful Basis** | Consent obtained at registration |
| **Data Minimization** | Only essential data collected |
| **Purpose Limitation** | Data used only for stated purposes |
| **Right to Access** | Data export feature |
| **Right to Rectification** | Profile editing |
| **Right to Erasure** | Account deletion (soft + hard) |
| **Right to Portability** | JSON data export |
| **Data Protection** | Encryption, access controls |
| **Breach Notification** | Logging and monitoring |

### 11.2 WCAG 2.1 AA Compliance

| Guideline | Implementation |
|-----------|---------------|
| **1.1 Text Alternatives** | Alt text for images |
| **1.3 Adaptable** | Semantic HTML structure |
| **1.4 Distinguishable** | Color contrast ratios, font sizing |
| **2.1 Keyboard Accessible** | Full keyboard navigation |
| **2.4 Navigable** | Skip links, focus indicators |
| **3.1 Readable** | Clear language, adjustable size |
| **3.2 Predictable** | Consistent navigation |
| **4.1 Compatible** | Screen reader support |

### 11.3 UK Data Protection Act 2018

- Privacy by design principles
- Data protection impact assessments
- Encryption of sensitive data
- Access controls and audit logging
- User consent management

---

## 12. Configuration Guide

### 12.1 Environment Variables

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mental_health_tracker
DB_USER=postgres
DB_PASSWORD=your_secure_database_password_here

# Database SSL Configuration (for production)
# DB_SSL=true                           # Enable SSL connections
# DB_SSL_CA=/path/to/ca-certificate.crt # CA certificate for self-signed certs
# DB_SSL_REJECT_UNAUTHORIZED=true       # Verify certificates (recommended)

# Security - IMPORTANT: Generate strong, unique values for production!
# Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Generate ENCRYPTION_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=CHANGE_ME_generate_random_64_char_string
JWT_EXPIRE=7d
ENCRYPTION_KEY=CHANGE_ME_generate_random_32_char_string

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Admin Panel - IMPORTANT: Set a strong password (minimum 12 characters)
# Generate: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
ADMIN_PASSWORD=CHANGE_ME_set_secure_admin_password

# Optional: Crisis API
CRISIS_API_KEY=your_crisis_api_key
```

### 12.2 Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE mental_health_tracker;"

# Run migrations
psql -U postgres -d mental_health_tracker -f database/migrations/001_initial_schema.sql
psql -U postgres -d mental_health_tracker -f database/migrations/002_add_streak_freeze.sql

# Seed achievements
psql -U postgres -d mental_health_tracker -f database/seeds/achievements.sql
```

### 12.3 Starting the Application

**Backend:**
```bash
cd backend
npm install
npm run dev  # Development with nodemon
npm start    # Production
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Production build
npm run preview # Preview production build
```

---

## 13. Deployment Guide

### 13.1 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT_SECRET (32+ chars)
- [ ] Use strong ENCRYPTION_KEY (32+ chars)
- [ ] Use strong database password
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure logging and monitoring
- [ ] Set up SSL certificates
- [ ] Configure firewall rules

### 13.2 Recommended Infrastructure

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │    (Nginx/ALB)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────┴──────┐ ┌─────┴─────┐ ┌──────┴──────┐
       │  Node.js    │ │  Node.js  │ │  Node.js    │
       │  Instance 1 │ │ Instance 2│ │  Instance 3 │
       └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   (Primary)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   (Replica)     │
                    └─────────────────┘
```

### 13.3 Docker Configuration

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  db:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=mental_health_tracker
      - POSTGRES_PASSWORD=secure_password

volumes:
  postgres_data:
```

---

## 14. Future Recommendations

### 14.1 High Priority Features

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Password Reset** | Email-based password reset flow | Medium |
| **Email Verification** | Verify email on registration | Medium |
| **Push Notifications** | Browser push for reminders | Medium |
| **Mobile App** | React Native mobile application | High |
| **Two-Factor Auth** | TOTP-based 2FA | Medium |

### 14.2 Enhanced Features

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Mood Prediction** | ML-based mood forecasting | Proactive support |
| **Wearable Integration** | Fitbit, Apple Watch sync | Automatic data |
| **Voice Journaling** | Speech-to-text notes | Accessibility |
| **Medication Tracking** | Track medications and reminders | Comprehensive care |
| **Therapist Portal** | Share data with professionals | Better care coordination |
| **Family Dashboard** | Shared family wellness view | Support network |

### 14.3 Technical Improvements

| Improvement | Description | Priority |
|-------------|-------------|----------|
| **GraphQL API** | More efficient data fetching | Medium |
| **Redis Caching** | Improved performance | High |
| **Elasticsearch** | Better search capabilities | Low |
| **Microservices** | Split into smaller services | Low |
| **CI/CD Pipeline** | Automated testing/deployment | High |
| **E2E Testing** | Cypress or Playwright tests | Medium |

### 14.4 AI/ML Enhancements

| Enhancement | Description | Technology |
|-------------|-------------|------------|
| **Sentiment Analysis** | NLP for journal entries | TensorFlow.js |
| **Pattern Recognition** | Identify mood patterns | Python ML |
| **Chatbot NLU** | Natural language understanding | Dialogflow/Rasa |
| **Personalization** | AI-driven recommendations | Collaborative filtering |
| **Risk Assessment** | ML-based crisis detection | Supervised learning |

### 14.5 Localization

| Language | Region | Status |
|----------|--------|--------|
| English (UK) | United Kingdom | Complete |
| English (US) | United States | Planned |
| Spanish | Spain/LATAM | Planned |
| French | France | Planned |
| German | Germany | Planned |
| Welsh | Wales | Planned |

### 14.6 Implementation Roadmap

**Phase 1 (Foundation):**
- Password Reset
- Email Verification
- CI/CD Pipeline
- E2E Testing

**Phase 2 (Enhancement):**
- Push Notifications
- Two-Factor Authentication
- Redis Caching
- Medication Tracking

**Phase 3 (Advanced):**
- Mobile App (React Native)
- Wearable Integration
- Voice Journaling
- Sentiment Analysis

**Phase 4 (Scale):**
- GraphQL API
- Microservices Architecture
- Therapist Portal
- Multi-language Support

---

## Appendix A: Crisis Resources (UK)

| Service | Contact | Description |
|---------|---------|-------------|
| **Samaritans** | 116 123 | 24/7 emotional support |
| **SHOUT** | Text 85258 | 24/7 text support |
| **NHS Crisis** | 111 (press 2) | Mental health crisis |
| **Papyrus** | 0800 068 4141 | Under 35s support |
| **CALM** | 0800 58 58 58 | Men's mental health |
| **Mind** | 0300 123 3393 | Mental health charity |
| **YoungMinds** | Text YM to 85258 | Young people support |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Mood Score** | User-rated emotional state (1-10 scale) |
| **Streak** | Consecutive days of check-ins |
| **Streak Freeze** | Power-up that preserves streak on missed day |
| **Luna** | AI wellness companion chatbot |
| **Insight** | AI-generated pattern or trend observation |
| **Safety Alert** | Triggered when concerning patterns detected |
| **Peer Group** | Anonymous community support group |
| **Achievement** | Reward for reaching milestones |

---

## Appendix C: File Checksums

For integrity verification during recovery:

```
backend/src/server.js          - Main application entry
backend/src/config/database.js - Database configuration
backend/src/models/User.js     - User model
frontend/src/App.jsx           - React application
frontend/src/services/api.js   - API service layer
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 2026 | Initial comprehensive documentation |
| 1.1.0 | January 2026 | Added wearable integration, security hardening, error boundaries |

### Version 1.1.0 Changes Summary

**New Features:**
- Wearable device integration (Apple Health, Fitbit, Oura Ring, Garmin)
- Biometric data storage and correlation analysis
- Pearson correlation calculations with statistical significance
- WearableSettings page with device management
- BiometricInsights and WearableCard components

**Security Improvements:**
- Admin authentication hardened - no development bypasses
- Timing-safe password comparison prevents timing attacks
- Minimum 12-character admin password required
- OAuth tokens encrypted at rest using AES-256
- SSL/TLS certificate verification enabled for production database
- Hardcoded credentials removed from configuration files

**Frontend Improvements:**
- ErrorBoundary component for graceful error handling
- Prevents entire app crashes from component errors
- User-friendly fallback UI with recovery options

**New Database Tables:**
- wearable_connections - Device OAuth management
- biometric_data - Raw biometric readings
- biometric_correlations - Mood-biometric correlations
- biometric_insights - Generated insights
- biometric_baselines - User baseline calculations
- wearable_sync_logs - Sync operation logging

---

**End of System Architecture Documentation**

*This document serves as the authoritative reference for the MindSpace Mental Health Tracker application. For questions or updates, contact the development team.*

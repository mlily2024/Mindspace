# Mental Health Tracker Application

A privacy-first mental health tracking application designed to support students, professionals, parents, and elderly users with mood tracking, personalized insights, and self-care recommendations.

## Features

### Core Functionality
- **Mood & Wellbeing Tracking**: Log mood, energy, stress, anxiety, sleep quality, and social interactions
- **AI-Powered Insights**: Automatic trend detection and pattern analysis
- **Adaptive Recommendations**: Personalized self-care activities based on your mental health data
- **Risk Detection**: Safety alerts for concerning patterns with crisis resource information
- **Anonymous Peer Support**: Connect with others in similar life stages (planned feature)

### Privacy & Security
- End-to-end encryption for sensitive notes
- UK GDPR and Data Protection Act 2018 compliant
- User-controlled data sharing and deletion
- Secure JWT authentication
- Rate limiting and security headers

### Accessibility
- WCAG 2.1 compliant design
- Adjustable font sizes for elderly users
- High contrast mode support
- Keyboard navigation
- Screen reader friendly
- Reduced motion support

## Technology Stack

### Backend
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL
- **Authentication**: JWT with bcryptjs
- **Security**: Helmet, CORS, rate limiting
- **Encryption**: crypto-js for data encryption
- **Logging**: Winston

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **State Management**: Context API

## Project Structure

```
Mental Health tracker App/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database & logger config
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth, validation, errors
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utilities (encryption, etc.)
│   │   └── server.js       # Main server file
│   ├── package.json
│   └── .env.example
│
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React context (auth)
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   ├── styles/        # CSS styles
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── database/               # Database schema
│   └── schema.sql         # PostgreSQL schema
│
├── docs/                   # Documentation
│
└── README.md              # This file
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Installation

#### 1. Clone the repository
```bash
cd "C:\Users\lylli\Documents\Mental Health tracker App"
```

#### 2. Set up the database
```bash
# Create PostgreSQL database
createdb mental_health_tracker

# Run the schema
psql mental_health_tracker < database/schema.sql
```

#### 3. Configure backend
```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# - Set DB_PASSWORD
# - Generate secure JWT_SECRET (32+ characters)
# - Generate secure ENCRYPTION_KEY (32+ characters)
```

#### 4. Configure frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file if needed
echo "VITE_API_BASE_URL=http://localhost:5000/api" > .env
```

### Running the Application

#### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Access the application at: http://localhost:3000

### Production Deployment

#### Backend
```bash
cd backend
npm install --production
npm start
```

#### Frontend
```bash
cd frontend
npm run build
# Serve the 'dist' folder with a web server
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/preferences` - Update preferences
- `DELETE /api/auth/account` - Delete account
- `POST /api/auth/data-export` - Request data export

### Mood Tracking
- `POST /api/mood` - Create mood entry
- `GET /api/mood` - Get user's mood entries
- `GET /api/mood/statistics` - Get mood statistics
- `GET /api/mood/trends` - Get mood trends
- `GET /api/mood/:entryId` - Get specific entry
- `PUT /api/mood/:entryId` - Update entry
- `DELETE /api/mood/:entryId` - Delete entry

### Insights
- `POST /api/insights/generate` - Generate insights
- `GET /api/insights` - Get user insights
- `PUT /api/insights/:insightId/read` - Mark as read
- `GET /api/insights/safety-alerts` - Get safety alerts
- `PUT /api/insights/safety-alerts/:alertId/acknowledge` - Acknowledge alert

### Recommendations
- `POST /api/recommendations/generate` - Generate recommendations
- `GET /api/recommendations` - Get recommendations
- `PUT /api/recommendations/:id/complete` - Mark as completed
- `POST /api/recommendations/:id/feedback` - Submit feedback
- `GET /api/recommendations/crisis-resources` - Get crisis resources

## User Groups

The application is tailored for four primary user groups:

1. **Students** - Academic stress and social pressure support
2. **Professionals** - Burnout and chronic stress management
3. **Parents** - Emotional overload and caregiving support
4. **Elderly** - Loneliness, grief, and routine support

## Security Considerations

- All passwords are hashed with bcryptjs
- Sensitive notes are encrypted with AES encryption
- JWT tokens for stateless authentication
- Rate limiting to prevent abuse
- Helmet.js for security headers
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS protection

## Accessibility Features

- WCAG 2.1 Level AA compliant
- Skip to main content link
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Adjustable font sizes (small, medium, large, extra large)
- High contrast mode
- Focus indicators
- Screen reader friendly

## Crisis Resources

The application includes UK-specific crisis resources:
- Emergency Services: 999
- Samaritans: 116 123
- Shout Crisis Text Line: Text SHOUT to 85258
- NHS Urgent Mental Health: 111
- Mind Infoline: 0300 123 3393
- PAPYRUS: 0800 068 4141

## Contributing

This is an academic/research project. Contributions are welcome for:
- Bug fixes
- Accessibility improvements
- New features aligned with the project goals
- Documentation improvements

## License

MIT License - See LICENSE file for details

## Disclaimer

This application is designed for wellbeing tracking and early intervention support. It is **NOT** a substitute for professional mental health care. If you are experiencing a mental health crisis, please contact emergency services or a crisis helpline immediately.

## Support

For issues, questions, or feedback, please contact the development team or create an issue in the project repository.

## Acknowledgments

- Built with research-backed mental health intervention principles
- Peer-reviewed references available in the Academic Proposal document
- Designed with input from mental health professionals
- WCAG accessibility standards by W3C

---

**Version**: 1.0.0
**Last Updated**: December 2024
**Target Regions**: United Kingdom

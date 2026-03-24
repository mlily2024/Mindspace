# Quick Start Guide

Get the Mental Health Tracker Application up and running in 5 minutes!

## Prerequisites

Before you begin, make sure you have:
- ✅ Node.js 18+ installed ([Download](https://nodejs.org/))
- ✅ PostgreSQL 14+ installed ([Download](https://www.postgresql.org/download/))
- ✅ Git installed ([Download](https://git-scm.com/))

## Step 1: Database Setup (2 minutes)

### Create Database

**Windows (Command Prompt):**
```cmd
"C:\Program Files\PostgreSQL\14\bin\createdb.exe" mental_health_tracker
```

**macOS/Linux:**
```bash
createdb mental_health_tracker
```

### Load Schema

Navigate to your project directory:

**Windows:**
```cmd
cd "C:\Users\lylli\Documents\Mental Health tracker App"
"C:\Program Files\PostgreSQL\14\bin\psql.exe" -d mental_health_tracker -f database\schema.sql
```

**macOS/Linux:**
```bash
cd ~/Documents/Mental\ Health\ tracker\ App
psql mental_health_tracker < database/schema.sql
```

## Step 2: Backend Setup (1 minute)

### Install Dependencies

```cmd
cd backend
npm install
```

### Configure Environment

**Windows:**
```cmd
copy .env.example .env
notepad .env
```

**macOS/Linux:**
```bash
cp .env.example .env
nano .env
```

**Minimal Configuration** (update these values):
```env
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long_12345678
ENCRYPTION_KEY=your_encryption_key_32_characters_long_abcdefgh12345678
```

## Step 3: Frontend Setup (1 minute)

Open a **new terminal window**:

```cmd
cd frontend
npm install
```

## Step 4: Start the Application (1 minute)

### Terminal 1 - Backend

```cmd
cd backend
npm run dev
```

You should see:
```
🚀 Mental Health Tracker API is running on port 5000
📊 Health check: http://localhost:5000/health
```

### Terminal 2 - Frontend

```cmd
cd frontend
npm run dev
```

You should see:
```
  VITE v5.0.8  ready in 1234 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

## Step 5: Access the Application

Open your browser and navigate to:

**http://localhost:3000**

### Create Your Account

1. Click **"Create Account"**
2. Fill in your details:
   - Email address
   - Password (minimum 8 characters)
   - Select your user group (student, professional, parent, or elderly)
3. Click **"Create Account"**

### Track Your First Mood

1. Navigate to **"Track Mood"**
2. Use the sliders to rate your:
   - Overall mood
   - Energy level
   - Stress level
   - Anxiety level
   - Sleep quality
   - Social interaction quality
3. Enter sleep hours
4. Add optional notes
5. Click **"Save Entry"**

### View Your Dashboard

Return to the dashboard to see:
- Your mood statistics
- Personalized insights (generate after a few entries)
- Self-care recommendations

## Troubleshooting

### Backend won't start

**Error**: `Error: connect ECONNREFUSED`

**Solution**: Check PostgreSQL is running:

**Windows:**
```cmd
net start postgresql-x64-14
```

**macOS:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
```

---

**Error**: `JWT_SECRET must be at least 32 characters`

**Solution**: Update your `.env` file with a longer secret key.

---

### Frontend can't connect to backend

**Error**: Network error or 404

**Solution**: Make sure the backend is running on port 5000:

```cmd
curl http://localhost:5000/health
```

If not working, check your backend terminal for errors.

---

### Database connection failed

**Error**: `password authentication failed`

**Solution**: Check your `.env` file has the correct `DB_PASSWORD`.

---

### Port already in use

**Error**: `Port 5000 is already in use`

**Solution**:

**Windows:**
```cmd
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -ti:5000 | xargs kill -9
```

---

## Next Steps

Now that you're up and running:

1. ✅ Track your mood daily for personalized insights
2. ✅ Generate insights after 3-5 mood entries
3. ✅ Check recommendations for self-care activities
4. ✅ Explore the settings to customize your experience
5. ✅ Adjust font size and theme for comfort

## Key Features to Try

### Mood Tracking
- Track multiple wellbeing indicators
- Add private notes (encrypted)
- View your mood history

### Insights & Analysis
- Generate AI-powered insights
- Identify patterns and trends
- Get early warning alerts

### Recommendations
- Receive personalized self-care suggestions
- Mark activities as completed
- Provide feedback

### Accessibility
- Increase font size (Settings → Preferences)
- Switch to dark theme
- Enable accessibility mode

### Privacy
- All data encrypted and private
- GDPR compliant
- Request data export anytime
- Delete account option available

## Getting Help

### Check Logs

**Backend logs**:
```cmd
# Check backend/logs/combined.log
# Check backend/logs/error.log
```

**Browser console**:
- Open DevTools (F12)
- Check Console tab for errors

### Crisis Support

If you're experiencing a mental health crisis:
- **Emergency**: Call 999
- **Samaritans**: Call 116 123 (24/7)
- **Text support**: Text SHOUT to 85258
- Access crisis resources in the app: **"Crisis Help"** button

## Development Mode Features

### Backend
- Automatic restart on code changes (nodemon)
- Detailed error messages
- Request logging to console

### Frontend
- Hot module replacement
- React DevTools support
- Detailed error overlay

## Production Deployment

For production deployment instructions, see:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [README.md](../README.md) - Project overview

---

## Summary

You've successfully:
✅ Set up the database
✅ Configured backend and frontend
✅ Started the application
✅ Created your account
✅ Tracked your first mood

**Enjoy using the Mental Health Tracker!**

Remember: This application supports your mental wellbeing but is not a substitute for professional mental health care. If you're experiencing a crisis, please reach out to emergency services or a crisis helpline.

---

**Need more help?**
- See [README.md](../README.md) for full documentation
- See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for API reference
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment

**Version**: 1.0.0
**Last Updated**: December 2024

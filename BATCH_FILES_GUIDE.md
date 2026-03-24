# Batch Files Guide

This guide explains how to use the batch files to easily manage the Mental Health Tracker Application on Windows.

## 📦 Available Batch Files

### 1. **install-dependencies.bat**
Installs all required npm packages for both backend and frontend.

**When to use:**
- First time setting up the project
- After cloning the repository
- After pulling new code that adds dependencies

**What it does:**
- Checks if Node.js and npm are installed
- Installs backend dependencies (in `backend/node_modules`)
- Installs frontend dependencies (in `frontend/node_modules`)
- Shows success/error messages

**How to use:**
```
Double-click: install-dependencies.bat
```

---

### 2. **setup-database.bat**
Creates the PostgreSQL database and loads the schema.

**When to use:**
- First time setting up the project
- After database reset
- When setting up on a new machine

**What it does:**
- Checks if PostgreSQL is installed
- Prompts for database credentials
- Creates the database
- Loads all tables, indexes, and triggers from schema.sql

**How to use:**
```
Double-click: setup-database.bat
Enter PostgreSQL username (usually: postgres)
Enter database name (default: mental_health_tracker)
Enter your PostgreSQL password when prompted
```

---

### 3. **setup-env.bat**
Creates and configures the backend environment file.

**When to use:**
- First time setting up the project
- When you need to reconfigure settings

**What it does:**
- Copies .env.example to .env
- Prompts for database password
- Reminds you to set JWT_SECRET and ENCRYPTION_KEY
- Optionally opens .env in Notepad for editing

**How to use:**
```
Double-click: setup-env.bat
Follow the prompts
Manually add JWT_SECRET and ENCRYPTION_KEY (32+ characters each)
```

**Important:** You must manually add secure keys:
```env
JWT_SECRET=your_32_plus_character_random_string_here_abc123
ENCRYPTION_KEY=another_32_plus_character_random_string_xyz789
```

Generate random keys at: https://randomkeygen.com/

---

### 4. **start-app.bat** ⭐ (Most Used)
Starts both the backend and frontend servers.

**When to use:**
- Every time you want to run the application
- During development
- For testing

**What it does:**
- Checks if dependencies are installed
- Checks if .env file exists
- Opens 2 terminal windows:
  - Backend server (http://localhost:5000)
  - Frontend server (http://localhost:3000)
- Shows URLs and status messages

**How to use:**
```
Double-click: start-app.bat
Wait for both servers to start
Open browser to http://localhost:3000
```

**Terminal windows:**
- **Backend window** - Shows API logs and requests
- **Frontend window** - Shows React development server

**Keep these windows open** while using the application!

---

### 5. **stop-app.bat**
Stops all running Node.js servers.

**When to use:**
- When you're done working
- Before shutting down your computer
- If servers are stuck or need restart

**What it does:**
- Finds all running Node.js processes
- Terminates them
- Closes server windows

**How to use:**
```
Double-click: stop-app.bat
```

**Alternative:** Just close the terminal windows manually.

---

## 🚀 Quick Start Workflow

### First Time Setup:

**Step 1: Install Dependencies**
```
1. Double-click: install-dependencies.bat
2. Wait for installation to complete (2-3 minutes)
```

**Step 2: Setup Database**
```
1. Double-click: setup-database.bat
2. Enter PostgreSQL credentials
3. Wait for schema to load
```

**Step 3: Configure Environment**
```
1. Double-click: setup-env.bat
2. Enter database password
3. Edit .env file to add:
   - JWT_SECRET (32+ characters)
   - ENCRYPTION_KEY (32+ characters)
4. Save and close
```

**Step 4: Start Application**
```
1. Double-click: start-app.bat
2. Wait for servers to start
3. Open http://localhost:3000 in browser
4. Create your account and start using the app!
```

---

### Daily Usage:

**To Start:**
```
Double-click: start-app.bat
```

**To Stop:**
```
Double-click: stop-app.bat
OR close the terminal windows
```

---

## 🛠️ Troubleshooting

### "Node.js is not installed"
**Solution:** Install Node.js from https://nodejs.org/
- Download the LTS version
- Run the installer
- Restart your computer
- Try again

---

### "psql command not found"
**Solution:** PostgreSQL is not in your PATH
- Option 1: Add PostgreSQL to PATH
  - Default location: `C:\Program Files\PostgreSQL\14\bin`
  - Add to System Environment Variables
- Option 2: Enter full path when prompted
  - Example: `C:\Program Files\PostgreSQL\14\bin\psql.exe`

---

### "Backend dependencies not installed"
**Solution:** Run `install-dependencies.bat` first

---

### ".env file not found"
**Solution:** Run `setup-env.bat` first, then configure the file

---

### "Port already in use"
**Solution:**
- Run `stop-app.bat` to close existing servers
- Or restart your computer
- Or manually kill Node.js processes in Task Manager

---

### Servers won't start
**Solution:**
1. Check that PostgreSQL is running
2. Verify .env file has correct database credentials
3. Make sure all dependencies are installed
4. Check for error messages in the terminal windows

---

## 📝 Tips & Best Practices

### Development Tips:
- **Keep terminal windows open** - Don't close them while using the app
- **Check terminal for errors** - Errors show in the terminal windows
- **Auto-restart** - Backend auto-restarts when you edit code (nodemon)
- **Hot reload** - Frontend auto-refreshes when you edit code (Vite)

### Organization:
- **One click to start** - Use `start-app.bat` every day
- **Clean shutdown** - Use `stop-app.bat` or close windows
- **Fresh install** - Delete `node_modules` folders, run `install-dependencies.bat`

### Security:
- **Never commit .env** - It contains secrets
- **Use strong keys** - Generate random 32+ character strings
- **Different keys** - Use different values for JWT_SECRET and ENCRYPTION_KEY

---

## 🔄 Update Workflow

When you update the code:

**If package.json changed:**
```
1. Run: stop-app.bat
2. Run: install-dependencies.bat
3. Run: start-app.bat
```

**If database schema changed:**
```
1. Run: stop-app.bat
2. Backup your data first!
3. Run: setup-database.bat
4. Run: start-app.bat
```

**If only code changed:**
```
Just save your files - servers auto-restart!
```

---

## 📍 File Locations

All batch files are in the project root:
```
C:\Users\lylli\Documents\Mental Health tracker App\
├── install-dependencies.bat
├── setup-database.bat
├── setup-env.bat
├── start-app.bat
├── stop-app.bat
└── BATCH_FILES_GUIDE.md (this file)
```

---

## ❓ Need More Help?

See the other documentation files:
- **QUICK_START.md** - Detailed setup guide
- **README.md** - Project overview
- **API_DOCUMENTATION.md** - API reference
- **DEPLOYMENT.md** - Production deployment

---

**Happy Coding! 🚀**

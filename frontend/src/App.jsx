import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationCenter from './components/NotificationCenter';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MoodTracker from './pages/MoodTracker';
import Insights from './pages/Insights';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';
import CrisisResources from './pages/CrisisResources';
import Journal from './pages/Journal';
import PeerSupport from './pages/PeerSupport';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import WearableSettings from './pages/WearableSettings';
import Chatbot from './components/Chatbot';
import './styles/App.css';

// Protected Route Component with Chatbot
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" aria-label="Loading"></div>
      </div>
    );
  }

  return isAuthenticated ? (
    <>
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <NotificationCenter />
      </div>
      {children}
      <Chatbot />
    </>
  ) : (
    <Navigate to="/" />
  );
};

// Main App Content
const AppContent = () => {
  return (
    <Router>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/crisis-resources" element={<CrisisResources />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mood-tracker"
          element={
            <ProtectedRoute>
              <MoodTracker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/journal"
          element={
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/peer-support"
          element={
            <ProtectedRoute>
              <PeerSupport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wearables"
          element={
            <ProtectedRoute>
              <WearableSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/wearables"
          element={
            <ProtectedRoute>
              <WearableSettings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationCenter from './components/NotificationCenter';
import './styles/App.css';

// Eagerly loaded (used on initial page load)
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy-loaded pages (code-split for smaller initial bundle)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MoodTracker = lazy(() => import('./pages/MoodTracker'));
const Insights = lazy(() => import('./pages/Insights'));
const Recommendations = lazy(() => import('./pages/Recommendations'));
const Settings = lazy(() => import('./pages/Settings'));
const CrisisResources = lazy(() => import('./pages/CrisisResources'));
const Journal = lazy(() => import('./pages/Journal'));
const PeerSupport = lazy(() => import('./pages/PeerSupport'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const WearableSettings = lazy(() => import('./pages/WearableSettings'));
const Chatbot = lazy(() => import('./components/Chatbot'));

// Loading fallback for lazy-loaded routes
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <div className="spinner" aria-label="Loading page"></div>
  </div>
);

// Per-route error boundary fallback
const RouteErrorFallback = (
  <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }} role="alert">
    <h2 style={{ color: '#4A3F55', marginBottom: '12px' }}>This page encountered an error</h2>
    <p style={{ color: '#6b7280', marginBottom: '20px' }}>Something went wrong loading this page.</p>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: '10px 24px', backgroundColor: '#9B8AA5', color: 'white',
        border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px'
      }}
    >
      Reload Page
    </button>
  </div>
);

// Protected Route Component with Chatbot
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return isAuthenticated ? (
    <>
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
        <NotificationCenter />
      </div>
      <ErrorBoundary fallback={RouteErrorFallback}>
        {children}
      </ErrorBoundary>
      <Suspense fallback={null}>
        <Chatbot />
      </Suspense>
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/crisis-resources" element={
            <ErrorBoundary fallback={RouteErrorFallback}><CrisisResources /></ErrorBoundary>
          } />
          <Route path="/admin" element={
            <ErrorBoundary fallback={RouteErrorFallback}><AdminLogin /></ErrorBoundary>
          } />
          <Route path="/admin/dashboard" element={
            <ErrorBoundary fallback={RouteErrorFallback}><AdminDashboard /></ErrorBoundary>
          } />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/mood-tracker"
            element={<ProtectedRoute><MoodTracker /></ProtectedRoute>}
          />
          <Route
            path="/journal"
            element={<ProtectedRoute><Journal /></ProtectedRoute>}
          />
          <Route
            path="/insights"
            element={<ProtectedRoute><Insights /></ProtectedRoute>}
          />
          <Route
            path="/recommendations"
            element={<ProtectedRoute><Recommendations /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><Settings /></ProtectedRoute>}
          />
          <Route
            path="/peer-support"
            element={<ProtectedRoute><PeerSupport /></ProtectedRoute>}
          />
          <Route
            path="/wearables"
            element={<ProtectedRoute><WearableSettings /></ProtectedRoute>}
          />
          <Route
            path="/settings/wearables"
            element={<ProtectedRoute><WearableSettings /></ProtectedRoute>}
          />
        </Routes>
      </Suspense>
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

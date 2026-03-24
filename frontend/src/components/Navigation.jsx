import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { to: '/dashboard', label: 'Home', icon: '🏠' },
    { to: '/mood-tracker', label: 'Check In', icon: '✨' },
    { to: '/journal', label: 'Journal', icon: '📝' },
    { to: '/insights', label: 'Insights', icon: '🌟' },
    { to: '/recommendations', label: 'Self-Care', icon: '💜' },
    { to: '/wearables', label: 'Wearables', icon: '⌚' },
    { to: '/peer-support', label: 'Community', icon: '🤝' },
    { to: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  const navStyle = {
    background: 'linear-gradient(135deg, var(--primary-color) 0%, #8A7A94 100%)',
    color: 'var(--text-light)',
    padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-md) var(--spacing-lg)',
    boxShadow: '0 4px 20px rgba(155, 138, 165, 0.3)',
    borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  };

  const logoStyle = {
    fontSize: isMobile ? 'var(--font-size-large)' : 'var(--font-size-xl)',
    fontFamily: 'var(--font-family-heading)',
    fontWeight: 700,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)'
  };

  const linkStyle = (isActive) => ({
    color: 'var(--text-light)',
    textDecoration: 'none',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-full)',
    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    transition: 'all var(--transition-fast)',
    fontWeight: isActive ? 600 : 500,
    fontSize: 'var(--font-size-base)',
    width: isMobile ? '100%' : 'auto'
  });

  const crisisStyle = {
    color: 'var(--text-light)',
    textDecoration: 'none',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, #E8A5A5 0%, #D48F8F 100%)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    fontWeight: 600,
    fontSize: 'var(--font-size-base)',
    boxShadow: '0 2px 8px rgba(232, 165, 165, 0.4)',
    width: isMobile ? '100%' : 'auto'
  };

  const logoutBtnStyle = {
    background: 'rgba(255,255,255,0.15)',
    border: '2px solid rgba(255,255,255,0.5)',
    color: 'var(--text-light)',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-sm) var(--spacing-lg)',
    borderRadius: 'var(--radius-full)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    fontSize: 'var(--font-size-base)',
    width: isMobile ? '100%' : 'auto',
    textAlign: 'center'
  };

  const hamburgerStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    width: '28px',
    height: '24px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    zIndex: 101
  };

  const hamburgerLineStyle = (isOpen, position) => ({
    width: '28px',
    height: '3px',
    background: 'var(--text-light)',
    borderRadius: '3px',
    transition: 'all 0.3s ease',
    transformOrigin: 'center',
    ...(position === 'top' && isOpen && {
      transform: 'rotate(45deg) translate(5px, 5px)'
    }),
    ...(position === 'middle' && isOpen && {
      opacity: 0
    }),
    ...(position === 'bottom' && isOpen && {
      transform: 'rotate(-45deg) translate(7px, -7px)'
    })
  });

  const mobileDropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'linear-gradient(135deg, var(--primary-color) 0%, #8A7A94 100%)',
    padding: 'var(--spacing-md)',
    boxShadow: '0 8px 30px rgba(155, 138, 165, 0.4)',
    borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
    zIndex: 99,
    animation: 'fadeInUp 0.3s ease'
  };

  return (
    <nav style={navStyle} role="navigation" aria-label="Main navigation">
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative'
      }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1 style={logoStyle}>
            <span style={{ fontSize: '1.5em' }}>🌙</span>
            <span className={isMobile ? '' : ''}>MindSpace</span>
          </h1>
        </Link>

        {/* Mobile hamburger button */}
        {isMobile && (
          <button
            style={hamburgerStyle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span style={hamburgerLineStyle(mobileMenuOpen, 'top')} />
            <span style={hamburgerLineStyle(mobileMenuOpen, 'middle')} />
            <span style={hamburgerLineStyle(mobileMenuOpen, 'bottom')} />
          </button>
        )}

        {/* Desktop navigation */}
        {!isMobile && (
          <ul style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            listStyle: 'none',
            flexWrap: 'wrap',
            alignItems: 'center',
            margin: 0,
            padding: 0
          }}>
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  style={linkStyle(location.pathname === link.to)}
                  aria-current={location.pathname === link.to ? 'page' : undefined}
                >
                  <span role="img" aria-hidden="true">{link.icon}</span>
                  <span className="nav-label">{link.label}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link to="/crisis-resources" style={crisisStyle}>
                <span role="img" aria-hidden="true">💚</span>
                <span>Support</span>
              </Link>
            </li>
            <li style={{ marginLeft: 'var(--spacing-sm)' }}>
              <button
                onClick={handleLogout}
                style={logoutBtnStyle}
                aria-label="Logout"
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.25)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.15)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                }}
              >
                Logout
              </button>
            </li>
          </ul>
        )}

        {/* Mobile dropdown menu */}
        {isMobile && mobileMenuOpen && (
          <div style={mobileDropdownStyle}>
            <ul style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xs)'
            }}>
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    style={linkStyle(location.pathname === link.to)}
                    aria-current={location.pathname === link.to ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span role="img" aria-hidden="true">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/crisis-resources"
                  style={crisisStyle}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span role="img" aria-hidden="true">💚</span>
                  <span>Crisis Support</span>
                </Link>
              </li>
              <li style={{ marginTop: 'var(--spacing-sm)' }}>
                <button
                  onClick={handleLogout}
                  style={logoutBtnStyle}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;

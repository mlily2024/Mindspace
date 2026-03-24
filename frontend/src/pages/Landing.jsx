import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Landing Page - Public welcome page showcasing app features
 * Users can explore before deciding to sign up
 * Fully responsive for mobile, tablet, and desktop
 */
const Landing = () => {
  const { isAuthenticated } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 768);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
      setIsTablet(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const features = [
    {
      icon: '😊',
      title: 'Mood Tracking',
      description: 'Simple emoji-based check-ins to track how you\'re feeling each day',
      color: '#9B8AA5'
    },
    {
      icon: '🌙',
      title: 'Meet Luna',
      description: 'Your AI wellness companion, available 24/7 to chat and offer support',
      color: '#F5C9B3'
    },
    {
      icon: '📝',
      title: 'Guided Journaling',
      description: 'Therapeutic prompts to help you reflect and process your thoughts',
      color: '#A8C5A8'
    },
    {
      icon: '🧘',
      title: 'Breathing Exercises',
      description: 'Calming techniques like 4-7-8 and box breathing to reduce anxiety',
      color: '#F5D89A'
    },
    {
      icon: '📊',
      title: 'Insights & Patterns',
      description: 'Discover what affects your mood with personalised analytics',
      color: '#E8A5A5'
    },
    {
      icon: '🏆',
      title: 'Achievements',
      description: 'Build healthy habits and celebrate your progress with streaks and badges',
      color: '#9B8AA5'
    }
  ];

  const testimonials = [
    {
      text: "MindSpace has helped me understand my moods so much better. The daily check-ins take less than a minute!",
      author: "Sarah, Student"
    },
    {
      text: "Luna feels like a friend who's always there when I need to talk. No judgement, just support.",
      author: "James, Professional"
    },
    {
      text: "The breathing exercises have been a game-changer for my anxiety. I use them every day.",
      author: "Emma, Parent"
    }
  ];

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 50%, var(--background) 100%)',
    overflowX: 'hidden'
  };

  const heroStyle = {
    textAlign: 'center',
    padding: isMobile
      ? 'var(--spacing-lg) var(--spacing-sm)'
      : isTablet
        ? 'var(--spacing-xl) var(--spacing-md)'
        : 'var(--spacing-xxl) var(--spacing-lg)',
    maxWidth: '800px',
    margin: '0 auto'
  };

  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isMobile
      ? 'var(--spacing-sm) var(--spacing-md)'
      : 'var(--spacing-md) var(--spacing-xl)',
    maxWidth: '1200px',
    margin: '0 auto',
    flexWrap: isTablet ? 'wrap' : 'nowrap',
    gap: isTablet ? 'var(--spacing-sm)' : '0'
  };

  const logoStyle = {
    fontSize: isMobile ? 'var(--font-size-large)' : 'var(--font-size-xl)',
    fontFamily: 'var(--font-family-heading)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    textDecoration: 'none'
  };

  const btnPrimary = {
    padding: isMobile
      ? 'var(--spacing-sm) var(--spacing-md)'
      : 'var(--spacing-md) var(--spacing-xl)',
    background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'white',
    fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(155, 138, 165, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    textAlign: 'center',
    width: isMobile ? '100%' : 'auto'
  };

  const btnSecondary = {
    padding: isMobile
      ? 'var(--spacing-sm) var(--spacing-md)'
      : 'var(--spacing-md) var(--spacing-xl)',
    background: 'transparent',
    border: '2px solid var(--primary-color)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--primary-color)',
    fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    width: isMobile ? '100%' : 'auto'
  };

  const sectionStyle = {
    padding: isMobile
      ? 'var(--spacing-lg) var(--spacing-sm)'
      : isTablet
        ? 'var(--spacing-xl) var(--spacing-md)'
        : 'var(--spacing-xxl) var(--spacing-lg)',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const featureGridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, 1fr)'
        : 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)',
    marginTop: 'var(--spacing-xl)'
  };

  const featureCardStyle = (color) => ({
    background: 'var(--surface)',
    borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-md)',
    textAlign: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
    borderTop: `4px solid ${color}`
  });

  const footerStyle = {
    textAlign: 'center',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
    background: 'var(--surface)',
    marginTop: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xxl)'
  };

  return (
    <div style={pageStyle}>
      {/* Navigation */}
      <nav style={navStyle}>
        <span style={logoStyle}>
          <span style={{ fontSize: isMobile ? '1.2em' : '1.5em' }}>🌙</span>
          MindSpace
        </span>
        <div style={{
          display: 'flex',
          gap: isMobile ? 'var(--spacing-xs)' : 'var(--spacing-md)',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: isTablet ? 'center' : 'flex-end',
          width: isTablet ? '100%' : 'auto',
          marginTop: isTablet ? 'var(--spacing-sm)' : '0'
        }}>
          {!isMobile && (
            <Link to="/crisis-resources" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--font-size-small)' }}>
              Crisis Support
            </Link>
          )}
          {isAuthenticated ? (
            <Link to="/dashboard" style={btnPrimary}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" style={btnSecondary}>
                Log In
              </Link>
              <Link to="/register" style={btnPrimary}>
                {isMobile ? 'Sign Up' : 'Get Started'}
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header style={heroStyle} className="animate-fade-in">
        <div style={{ fontSize: isMobile ? '3rem' : '4rem', marginBottom: 'var(--spacing-md)' }}>
          🌙
        </div>
        <h1 style={{
          fontSize: isMobile ? '1.75rem' : isTablet ? '2.25rem' : '3rem',
          fontFamily: 'var(--font-family-heading)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-md)',
          lineHeight: 1.2
        }}>
          Your Mental Wellness,{isMobile ? ' ' : <br />}Made Simple
        </h1>
        <p style={{
          fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-large)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-xl)',
          maxWidth: '600px',
          margin: '0 auto var(--spacing-xl)',
          padding: isMobile ? '0 var(--spacing-sm)' : '0'
        }}>
          Track your mood, chat with Luna your AI companion, discover patterns,
          and build healthy habits — all in one friendly space.
        </p>
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          justifyContent: 'center',
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0 var(--spacing-md)' : '0'
        }}>
          {isAuthenticated ? (
            <Link to="/dashboard" style={btnPrimary}>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" style={btnPrimary}>
                {isMobile ? 'Start Free' : 'Start Your Journey — It\'s Free'}
              </Link>
              <Link to="/login" style={btnSecondary}>
                I Have an Account
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Features Section */}
      <section style={sectionStyle}>
        <h2 style={{
          textAlign: 'center',
          fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-xxl)',
          fontFamily: 'var(--font-family-heading)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Everything You Need to Thrive
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          margin: '0 auto',
          fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)',
          padding: isMobile ? '0 var(--spacing-sm)' : '0'
        }}>
          MindSpace combines proven wellness techniques with modern technology
          to support your mental health journey.
        </p>

        <div style={featureGridStyle}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={featureCardStyle(feature.color)}
              className="animate-fade-in-up"
            >
              <span style={{ fontSize: isMobile ? '2.5rem' : '3rem', display: 'block', marginBottom: 'var(--spacing-md)' }}>
                {feature.icon}
              </span>
              <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)', fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-large)' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{
        ...sectionStyle,
        background: 'var(--surface)',
        borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
        margin: isMobile
          ? 'var(--spacing-lg) var(--spacing-sm)'
          : 'var(--spacing-xxl) auto',
        maxWidth: '1000px',
        padding: isMobile ? 'var(--spacing-lg) var(--spacing-md)' : sectionStyle.padding
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-xxl)',
          fontFamily: 'var(--font-family-heading)',
          marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)'
        }}>
          How It Works
        </h2>

        <div style={{
          display: isMobile ? 'grid' : 'flex',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'none',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)'
        }}>
          {[
            { step: '1', icon: '📱', title: 'Sign Up Free', desc: 'Create your account in seconds' },
            { step: '2', icon: '😊', title: 'Daily Check-In', desc: 'Log your mood with simple emojis' },
            { step: '3', icon: '💬', title: 'Chat with Luna', desc: 'Get support whenever you need it' },
            { step: '4', icon: '📈', title: 'Track Progress', desc: 'Watch your wellness journey unfold' }
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', flex: isMobile ? 'none' : '1', minWidth: isMobile ? 'auto' : '150px' }}>
              <div style={{
                width: isMobile ? '50px' : '60px',
                height: isMobile ? '50px' : '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-light), var(--secondary-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--spacing-sm)',
                fontSize: isMobile ? '1.25rem' : '1.5rem'
              }}>
                {item.icon}
              </div>
              <h4 style={{ marginBottom: 'var(--spacing-xs)', fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)' }}>{item.title}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={sectionStyle}>
        <h2 style={{
          textAlign: 'center',
          fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-xxl)',
          fontFamily: 'var(--font-family-heading)',
          marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)'
        }}>
          What People Are Saying
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)'
        }}>
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface)',
                borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
                padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <p style={{
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                marginBottom: 'var(--spacing-md)',
                lineHeight: 1.6,
                fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)'
              }}>
                "{testimonial.text}"
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)', fontWeight: 600 }}>
                — {testimonial.author}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        textAlign: 'center',
        padding: isMobile ? 'var(--spacing-xl) var(--spacing-md)' : 'var(--spacing-xxl)',
        background: 'linear-gradient(135deg, var(--primary-color) 0%, #8A7A94 100%)',
        borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
        maxWidth: '900px',
        margin: isMobile ? '0 var(--spacing-sm) var(--spacing-lg)' : '0 auto var(--spacing-xxl)'
      }}>
        <h2 style={{
          color: 'white',
          fontSize: isMobile ? 'var(--font-size-large)' : 'var(--font-size-xxl)',
          fontFamily: 'var(--font-family-heading)',
          marginBottom: 'var(--spacing-md)'
        }}>
          Ready to Start Your Wellness Journey?
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          marginBottom: 'var(--spacing-xl)',
          maxWidth: '500px',
          margin: '0 auto var(--spacing-xl)',
          fontSize: isMobile ? 'var(--font-size-small)' : 'var(--font-size-base)'
        }}>
          Join thousands of people taking small steps toward better mental health every day.
        </p>
        {isAuthenticated ? (
          <Link
            to="/dashboard"
            style={{
              ...btnPrimary,
              background: 'white',
              color: 'var(--primary-color)',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '280px' : 'none'
            }}
          >
            Go to Your Dashboard
          </Link>
        ) : (
          <Link
            to="/register"
            style={{
              ...btnPrimary,
              background: 'white',
              color: 'var(--primary-color)',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '280px' : 'none'
            }}
          >
            Create Free Account
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer style={footerStyle}>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <span style={{ ...logoStyle, justifyContent: 'center', display: 'inline-flex' }}>
            <span style={{ fontSize: '1.2em' }}>🌙</span>
            MindSpace
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)', marginBottom: 'var(--spacing-md)' }}>
          Your mental wellness companion
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-lg)',
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center'
        }}>
          <Link to="/crisis-resources" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--font-size-small)' }}>
            Crisis Resources
          </Link>
          {!isMobile && <span style={{ color: 'var(--border)' }}>|</span>}
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
            Privacy First
          </span>
          {!isMobile && <span style={{ color: 'var(--border)' }}>|</span>}
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
            UK GDPR Compliant
          </span>
        </div>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-small)',
          marginTop: 'var(--spacing-lg)',
          padding: isMobile ? '0 var(--spacing-sm)' : '0'
        }}>
          If you're in crisis, please reach out: <strong>Samaritans 116 123</strong> (free, 24/7)
        </p>
      </footer>
    </div>
  );
};

export default Landing;

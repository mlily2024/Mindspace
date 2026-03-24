import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recommendationsAPI } from '../services/api';

const CrisisResources = () => {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const response = await recommendationsAPI.getCrisisResources();
      setResources(response.data.resources);
    } catch (error) {
      console.error('Failed to load crisis resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const ResourceCard = ({ title, phone, text, email, website, description, available }) => (
    <div className="card">
      <h2 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--primary-color)' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        {description}
      </p>
      <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
        {phone && (
          <div>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${phone}`} style={{ color: 'var(--primary-color)', fontSize: 'var(--font-size-large)', fontWeight: 'bold' }}>
              {phone}
            </a>
          </div>
        )}
        {text && (
          <div>
            <strong>Text:</strong>{' '}
            <a href={`sms:${text}`} style={{ color: 'var(--primary-color)', fontSize: 'var(--font-size-large)', fontWeight: 'bold' }}>
              {text}
            </a>
          </div>
        )}
        {email && (
          <div>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${email}`} style={{ color: 'var(--primary-color)' }}>
              {email}
            </a>
          </div>
        )}
        {website && (
          <div>
            <strong>Website:</strong>{' '}
            <a href={website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
              {website}
            </a>
          </div>
        )}
        {available && (
          <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
            <strong>Available:</strong> {available}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--surface)' }}>
      <div style={{ backgroundColor: 'var(--danger-color)', color: 'white', padding: 'var(--spacing-lg)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-xxl)', marginBottom: 'var(--spacing-sm)' }}>
          Crisis Support Resources
        </h1>
        <p style={{ fontSize: 'var(--font-size-large)', maxWidth: '800px', margin: '0 auto' }}>
          If you're in crisis, you're not alone. Help is available 24/7.
        </p>
      </div>

      <main className="container" style={{ maxWidth: '1000px', paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>
        <div className="alert alert-danger" role="alert" style={{ marginBottom: 'var(--spacing-xl)', fontSize: 'var(--font-size-large)' }}>
          <strong>⚠️ In an emergency:</strong> If you or someone else is in immediate danger, call 999 for emergency services.
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading crisis resources"></div>
          </div>
        ) : resources ? (
          <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>
            <ResourceCard {...resources.emergency} />
            <ResourceCard {...resources.samaritans} />
            <ResourceCard {...resources.shoutCrisisText} />
            <ResourceCard {...resources.nhsUrgentMentalHealth} />
            <ResourceCard {...resources.mindInfoline} />
            <ResourceCard {...resources.papyrus} />
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
            <p>Unable to load resources at this time. Please call 999 in an emergency or 111 for urgent mental health support.</p>
          </div>
        )}

        <div style={{ marginTop: 'var(--spacing-xxl)', textAlign: 'center' }}>
          <Link to="/" className="btn btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
};

export default CrisisResources;

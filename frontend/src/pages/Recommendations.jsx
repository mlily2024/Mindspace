import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { recommendationsAPI } from '../services/api';

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const response = await recommendationsAPI.getAll({ limit: 20 });
      setRecommendations(response.data.recommendations || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await recommendationsAPI.generate();
      await loadRecommendations();
      alert('Recommendations generated successfully!');
    } catch (error) {
      alert('Failed to generate recommendations.');
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async (recommendationId) => {
    try {
      await recommendationsAPI.complete(recommendationId);
      await loadRecommendations();
    } catch (error) {
      alert('Failed to mark recommendation as completed.');
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      breathing: '🌬️',
      exercise: '🏃',
      social: '👥',
      rest: '😴',
      activity: '📝',
      professional_help: '🏥'
    };
    return icons[type] || '✨';
  };

  return (
    <>
      <Navigation />
      <main id="main-content" className="container" style={{ paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <div>
            <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>Self-Care Recommendations</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Personalized activities to support your mental wellbeing
            </p>
          </div>
          <button onClick={handleGenerate} className="btn btn-primary" disabled={generating}>
            {generating ? 'Generating...' : 'Generate New Recommendations'}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading recommendations"></div>
          </div>
        ) : recommendations.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-lg)' }}>
            {recommendations.map((rec) => (
              <div key={rec.recommendation_id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-md)' }}>
                  {getTypeIcon(rec.recommendation_type)}
                </div>
                <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>{rec.title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)', flex: 1 }}>
                  {rec.description}
                </p>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                  <span>⏱️ {rec.estimated_duration} min</span>
                  <span>💪 {rec.effort_level} effort</span>
                </div>
                {!rec.is_completed && (
                  <button
                    onClick={() => handleComplete(rec.recommendation_id)}
                    className="btn btn-success"
                    style={{ width: '100%' }}
                  >
                    Mark as Completed
                  </button>
                )}
                {rec.is_completed && (
                  <div style={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--success-color)', color: 'white', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    ✓ Completed
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              No recommendations available. Track your mood to receive personalized self-care suggestions.
            </p>
            <button onClick={handleGenerate} className="btn btn-primary">
              Generate Recommendations
            </button>
          </div>
        )}
      </main>
    </>
  );
};

export default Recommendations;

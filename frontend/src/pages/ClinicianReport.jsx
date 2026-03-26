import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api from '../services/api';

/**
 * ClinicianReport Page
 * Generates structured handoff reports for clinicians with mood trends,
 * assessment scores, triggers, techniques, and risk flags.
 */
const ClinicianReport = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [previousReports, setPreviousReports] = useState([]);
  const [escalation, setEscalation] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [reportsRes, escalationRes] = await Promise.all([
        api.get('/clinician-reports').catch(() => ({ data: { reports: [] } })),
        api.get('/clinician-reports/escalation').catch(() => ({ data: null }))
      ]);
      setPreviousReports(reportsRes.data?.reports || []);
      setEscalation(escalationRes.data || null);
    } catch (err) {
      console.error('Failed to load clinician report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates.');
      return;
    }
    try {
      setGenerating(true);
      setError(null);
      const res = await api.post('/clinician-reports/generate', {
        startDate,
        endDate
      });
      setReport(res.data?.report || res.data || null);
      // Refresh previous reports list
      const reportsRes = await api.get('/clinician-reports').catch(() => ({ data: { reports: [] } }));
      setPreviousReports(reportsRes.data?.reports || []);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #FFFBF8 0%, #F3EDF7 100%)'
  };

  const containerStyle = {
    paddingTop: 'var(--spacing-xl)',
    paddingBottom: 'var(--spacing-xxl)'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    marginBottom: 'var(--spacing-lg)',
    boxShadow: '0 2px 12px rgba(155, 138, 165, 0.1)'
  };

  const headingStyle = {
    fontSize: 'var(--font-size-xxl)',
    fontWeight: 700,
    color: '#4A3F55',
    marginBottom: 'var(--spacing-lg)'
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-large)',
    fontWeight: 600,
    color: '#4A3F55',
    marginBottom: 'var(--spacing-md)',
    paddingBottom: 'var(--spacing-sm)',
    borderBottom: '2px solid #B8A9C9'
  };

  const inputStyle = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #B8A9C9',
    fontSize: 'var(--font-size-base)',
    color: '#4A3F55',
    background: '#FFFBF8',
    outline: 'none'
  };

  const buttonStyle = {
    padding: 'var(--spacing-sm) var(--spacing-xl)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    opacity: 0.6,
    cursor: 'not-allowed'
  };

  const escalationBannerStyle = {
    background: 'linear-gradient(135deg, #FDE8E8, #FCDCDC)',
    borderLeft: '4px solid #E53E3E',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-lg)',
    marginBottom: 'var(--spacing-xl)'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 'var(--spacing-sm)'
  };

  const thStyle = {
    textAlign: 'left',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderBottom: '2px solid #B8A9C9',
    color: '#4A3F55',
    fontWeight: 600,
    fontSize: 'var(--font-size-small)'
  };

  const tdStyle = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderBottom: '1px solid #F3EDF7',
    color: '#4A3F55',
    fontSize: 'var(--font-size-base)'
  };

  const riskFlagStyle = {
    background: '#FDE8E8',
    border: '1px solid #E53E3E',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    color: '#6B2D2D',
    marginBottom: 'var(--spacing-xs)',
    fontWeight: 500
  };

  const listItemStyle = {
    padding: 'var(--spacing-xs) 0',
    color: '#4A3F55',
    borderBottom: '1px solid #F3EDF7'
  };

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" className="container" style={containerStyle}>
        <h1 style={headingStyle}>Clinician Report</h1>

        {/* Escalation Banner */}
        {escalation?.needsEscalation && (
          <div role="alert" style={escalationBannerStyle}>
            <h2 style={{ fontSize: 'var(--font-size-large)', marginBottom: 'var(--spacing-sm)', color: '#6B2D2D', fontWeight: 600 }}>
              Escalation Recommended
            </h2>
            <p style={{ color: '#6B2D2D', marginBottom: 'var(--spacing-md)' }}>
              {escalation.reason || 'Based on recent patterns, clinical escalation may be warranted.'}
            </p>
            {escalation.crisisResources && (
              <div style={{ marginTop: 'var(--spacing-sm)' }}>
                <strong style={{ color: '#6B2D2D' }}>Crisis Resources:</strong>
                <ul style={{ marginTop: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-lg)' }}>
                  {escalation.crisisResources.map((resource, idx) => (
                    <li key={idx} style={{ color: '#6B2D2D', padding: '2px 0' }}>{resource}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Generate Report Section */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Generate Report</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-small)', color: '#4A3F55', fontWeight: 500 }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-small)', color: '#4A3F55', fontWeight: 500 }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !startDate || !endDate}
              style={generating || !startDate || !endDate ? disabledButtonStyle : buttonStyle}
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
          {error && (
            <p style={{ color: '#E53E3E', marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-small)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Generated Report */}
        {report && (
          <div className="print-section">
            {/* Summary */}
            <div style={cardStyle}>
              <h2 style={sectionHeadingStyle}>Summary</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-md)' }}>
                <div style={{ background: '#F3EDF7', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: 'var(--spacing-xs)' }}>Date Range</div>
                  <div style={{ fontWeight: 600, color: '#4A3F55' }}>{report.summary?.startDate || startDate} — {report.summary?.endDate || endDate}</div>
                </div>
                <div style={{ background: '#F3EDF7', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: 'var(--spacing-xs)' }}>Total Entries</div>
                  <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-xl)' }}>{report.summary?.totalEntries ?? '—'}</div>
                </div>
                <div style={{ background: '#F3EDF7', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: 'var(--spacing-xs)' }}>Average Mood</div>
                  <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-xl)' }}>{report.summary?.averageMood != null ? report.summary.averageMood.toFixed(1) : '—'}</div>
                </div>
                <div style={{ background: '#F3EDF7', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: 'var(--spacing-xs)' }}>Average Sleep</div>
                  <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-xl)' }}>{report.summary?.averageSleep != null ? report.summary.averageSleep.toFixed(1) : '—'}</div>
                </div>
              </div>
            </div>

            {/* Mood Trends */}
            {report.moodTrends && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Mood Trends</h2>
                {report.moodTrends.weeklyAverages?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {report.moodTrends.weeklyAverages.map((week, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...listItemStyle }}>
                        <span style={{ fontWeight: 500 }}>{week.weekLabel || `Week ${idx + 1}`}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                          <div style={{
                            width: `${Math.min((week.average / 10) * 120, 120)}px`,
                            height: '8px',
                            borderRadius: '4px',
                            background: 'linear-gradient(90deg, #B8A9C9, #9B8AA5)'
                          }} />
                          <span style={{ fontWeight: 600, minWidth: '30px', textAlign: 'right' }}>{week.average?.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9B8AA5' }}>No mood trend data available for this period.</p>
                )}
              </div>
            )}

            {/* Sleep Analysis */}
            {report.sleepAnalysis && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Sleep Analysis</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-md)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>Average Hours</div>
                    <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-large)' }}>
                      {report.sleepAnalysis.averageHours?.toFixed(1) ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>Average Quality</div>
                    <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-large)' }}>
                      {report.sleepAnalysis.averageQuality?.toFixed(1) ?? '—'}/10
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>Consistency</div>
                    <div style={{ fontWeight: 600, color: '#4A3F55', fontSize: 'var(--font-size-large)' }}>
                      {report.sleepAnalysis.consistency || '—'}
                    </div>
                  </div>
                </div>
                {report.sleepAnalysis.notes && (
                  <p style={{ marginTop: 'var(--spacing-md)', color: '#4A3F55' }}>{report.sleepAnalysis.notes}</p>
                )}
              </div>
            )}

            {/* Assessment Scores */}
            {report.assessmentScores?.length > 0 && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Assessment Scores</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Instrument</th>
                        <th style={thStyle}>Score</th>
                        <th style={thStyle}>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.assessmentScores.map((item, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle}>{item.instrument}</td>
                          <td style={tdStyle}>{item.score}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: item.severity === 'severe' || item.severity === 'high'
                                ? '#FDE8E8'
                                : item.severity === 'moderate'
                                  ? '#FEF3C7'
                                  : '#E6F7ED',
                              color: item.severity === 'severe' || item.severity === 'high'
                                ? '#6B2D2D'
                                : item.severity === 'moderate'
                                  ? '#92400E'
                                  : '#276749',
                              fontWeight: 500,
                              fontSize: 'var(--font-size-small)'
                            }}>
                              {item.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Identified Triggers */}
            {report.triggers?.length > 0 && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Identified Triggers</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {report.triggers.map((trigger, idx) => (
                    <li key={idx} style={{ ...listItemStyle, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9B8AA5', flexShrink: 0 }} />
                      {trigger}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Techniques Tried */}
            {report.techniques && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Techniques Tried</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-lg)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: '#276749', marginBottom: 'var(--spacing-sm)' }}>
                      What Worked
                    </h3>
                    {report.techniques.worked?.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {report.techniques.worked.map((t, idx) => (
                          <li key={idx} style={{ padding: 'var(--spacing-xs) 0', color: '#4A3F55', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                            <span style={{ color: '#276749' }}>+</span> {t}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#9B8AA5', fontSize: 'var(--font-size-small)' }}>None recorded</p>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: '#92400E', marginBottom: 'var(--spacing-sm)' }}>
                      What Didn't Work
                    </h3>
                    {report.techniques.didntWork?.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {report.techniques.didntWork.map((t, idx) => (
                          <li key={idx} style={{ padding: 'var(--spacing-xs) 0', color: '#4A3F55', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                            <span style={{ color: '#92400E' }}>-</span> {t}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#9B8AA5', fontSize: 'var(--font-size-small)' }}>None recorded</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {report.riskFlags?.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ ...sectionHeadingStyle, borderBottomColor: '#E53E3E', color: '#6B2D2D' }}>Risk Flags</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {report.riskFlags.map((flag, idx) => (
                    <div key={idx} style={riskFlagStyle}>{flag}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations?.length > 0 && (
              <div style={cardStyle}>
                <h2 style={sectionHeadingStyle}>Recommendations</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {report.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ ...listItemStyle, display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <span style={{ color: '#9B8AA5', fontWeight: 600, flexShrink: 0 }}>{idx + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Download / Print */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
              <button onClick={handlePrint} style={buttonStyle}>
                Download as PDF
              </button>
            </div>
          </div>
        )}

        {/* Previous Reports */}
        {previousReports.length > 0 && (
          <div style={cardStyle}>
            <h2 style={sectionHeadingStyle}>Previous Reports</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {previousReports.map((prev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: '#F3EDF7',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onClick={() => setReport(prev.report || prev)}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: '#4A3F55' }}>
                      {prev.startDate || prev.report?.summary?.startDate || '—'} to {prev.endDate || prev.report?.summary?.endDate || '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>
                    {prev.createdAt ? new Date(prev.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)', color: '#9B8AA5' }}>
            Loading...
          </div>
        )}
      </main>

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          nav, button, .no-print { display: none !important; }
          .print-section { break-inside: avoid; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
};

export default ClinicianReport;

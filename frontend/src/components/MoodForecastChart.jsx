import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import api from '../services/api';

/**
 * MoodForecastChart — probabilistic mood forecast "fan chart".
 *
 * Consumes GET /api/predictions/v2/forecast (ADR-0012): the Chronos foundation
 * model when the sidecar is available, otherwise the regression engine. Draws
 * the most-likely line (p50) inside a shaded p10–p90 uncertainty band, and is
 * honest about which engine produced it via the `source` badge.
 *
 * Self-contained (fetches its own data); renders nothing until there is a
 * forecast, so it never clutters the page for users without enough history.
 */
const cardStyle = {
  background: '#fff',
  borderRadius: 'var(--radius-lg, 16px)',
  padding: 'var(--spacing-lg, 20px)',
  marginBottom: 'var(--spacing-md, 16px)',
  boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)',
  border: '1px solid rgba(184, 169, 201, 0.15)',
};

const SOURCE_BADGE = {
  chronos: { label: 'Chronos AI model', bg: '#E6F4EA', fg: '#1E7E34' },
  regression_fallback: { label: 'Trend estimate', bg: '#F0EBF4', fg: '#6b5f7a' },
};

const shortDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
};

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const [low, high] = row.range || [];
  return (
    <div style={{
      background: '#fff', border: '1px solid #e6def0', borderRadius: 8,
      padding: '8px 10px', fontSize: '0.78rem', color: '#4A3F55',
      boxShadow: '0 2px 8px rgba(74,63,85,0.12)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>Most likely: <strong>{row.p50?.toFixed(1)}</strong></div>
      {low != null && high != null && (
        <div style={{ color: '#6b5f7a' }}>Likely range: {low.toFixed(1)}–{high.toFixed(1)}</div>
      )}
    </div>
  );
}

const MoodForecastChart = () => {
  const [forecast, setForecast] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/predictions/v2/forecast', { params: { days: 7 } });
        const body = res.data?.data ?? res.data ?? {};
        if (cancelled) return;
        setForecast(Array.isArray(body.forecast) ? body.forecast : []);
        setSource(body.source || null);
      } catch (_err) {
        if (!cancelled) setForecast([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !forecast.length) return null; // stays quiet until there's a forecast

  const data = forecast.map((p) => {
    const low = p.confidenceInterval?.low ?? p.predictedMood;
    const high = p.confidenceInterval?.high ?? p.predictedMood;
    return { label: shortDate(p.date), p50: p.predictedMood, range: [low, high] };
  });

  const badge = SOURCE_BADGE[source] || SOURCE_BADGE.regression_fallback;

  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8, marginBottom: 12,
      }}>
        <h3 style={{ fontSize: 'var(--font-size-lg, 1.1rem)', fontWeight: 600, color: '#4A3F55', margin: 0 }}>
          Mood forecast
        </h3>
        <span
          title={source === 'chronos'
            ? 'Forecast from the Chronos-Bolt foundation model (zero-shot, with uncertainty bands)'
            : 'Forecast from the trend-based regression engine'}
          style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 12,
            fontSize: '0.7rem', fontWeight: 600, background: badge.bg, color: badge.fg,
          }}
        >
          {badge.label}
        </span>
      </div>

      <p style={{ fontSize: '0.78rem', color: '#9B8AA5', margin: '0 0 10px' }}>
        Most-likely mood (line) within the likely range (shaded p10–p90). The band widens further out — more uncertain.
      </p>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebf4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9B8AA5' }} axisLine={{ stroke: '#e6def0' }} tickLine={false} />
          <YAxis domain={[1, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#9B8AA5' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ForecastTooltip />} />
          <Area type="monotone" dataKey="range" stroke="none" fill="#B8A9C9" fillOpacity={0.25} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" stroke="#9B8AA5" strokeWidth={2.5} dot={{ r: 3, fill: '#9B8AA5' }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MoodForecastChart;

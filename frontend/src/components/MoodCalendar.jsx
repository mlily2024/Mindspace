import React, { useState, useEffect } from 'react';
import { moodAPI } from '../services/api';

/**
 * MoodCalendar - Calendar view of mood history
 */
const MoodCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [moodData, setMoodData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    loadMoodData();
  }, [currentDate]);

  const loadMoodData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Get first and last day of month
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const response = await moodAPI.getAll({
        startDate,
        endDate,
        limit: 100
      });

      // Group entries by date
      const grouped = {};
      (response.data.entries || []).forEach(entry => {
        const date = entry.entry_date.split('T')[0];
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(entry);
      });

      // Calculate average mood per day
      const averages = {};
      Object.keys(grouped).forEach(date => {
        const entries = grouped[date];
        const avgMood = entries.reduce((sum, e) => sum + (e.mood_score || 0), 0) / entries.length;
        averages[date] = {
          avgMood: avgMood.toFixed(1),
          count: entries.length,
          entries
        };
      });

      setMoodData(averages);
    } catch (error) {
      console.error('Failed to load mood data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMoodColor = (score) => {
    if (!score) return 'var(--surface)';
    const s = parseFloat(score);
    if (s >= 8) return '#4CAF50'; // Green - great
    if (s >= 6) return '#8BC34A'; // Light green - good
    if (s >= 5) return '#FFC107'; // Yellow - neutral
    if (s >= 3) return '#FF9800'; // Orange - low
    return '#F44336'; // Red - very low
  };

  const getMoodEmoji = (score) => {
    if (!score) return '';
    const s = parseFloat(score);
    if (s >= 8) return '😊';
    if (s >= 6) return '🙂';
    if (s >= 5) return '😐';
    if (s >= 3) return '😔';
    return '😢';
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    const days = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null });
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        day: i,
        date: dateStr,
        data: moodData[dateStr] || null
      });
    }

    return days;
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    setSelectedDay(null);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(currentDate);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--spacing-xl)',
      boxShadow: 'var(--shadow-md)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            background: 'var(--background)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-large)'
          }}
        >
          ←
        </button>

        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          fontFamily: 'var(--font-family-heading)'
        }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>

        <button
          onClick={() => navigateMonth(1)}
          style={{
            background: 'var(--background)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-large)'
          }}
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        marginBottom: 'var(--spacing-sm)'
      }}>
        {dayNames.map(day => (
          <div
            key={day}
            style={{
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-small)',
              padding: 'var(--spacing-xs)'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-xxl)' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {days.map((dayObj, index) => (
            <div
              key={index}
              onClick={() => dayObj.data && setSelectedDay(dayObj)}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                background: dayObj.data ? getMoodColor(dayObj.data.avgMood) : 'var(--background)',
                cursor: dayObj.data ? 'pointer' : 'default',
                border: dayObj.date === today ? '2px solid var(--primary-color)' : 'none',
                opacity: dayObj.day ? 1 : 0.3,
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (dayObj.data) e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span style={{
                fontWeight: dayObj.date === today ? 700 : 500,
                color: dayObj.data ? 'white' : 'var(--text-primary)',
                fontSize: 'var(--font-size-small)'
              }}>
                {dayObj.day}
              </span>
              {dayObj.data && (
                <span style={{ fontSize: '0.7rem' }}>
                  {getMoodEmoji(dayObj.data.avgMood)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--spacing-md)',
        marginTop: 'var(--spacing-lg)',
        flexWrap: 'wrap'
      }}>
        <LegendItem color="#4CAF50" label="Great (8-10)" />
        <LegendItem color="#8BC34A" label="Good (6-7)" />
        <LegendItem color="#FFC107" label="Neutral (5)" />
        <LegendItem color="#FF9800" label="Low (3-4)" />
        <LegendItem color="#F44336" label="Very Low (1-2)" />
      </div>

      {/* Selected day details */}
      {selectedDay && selectedDay.data && (
        <div style={{
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--background)',
          borderRadius: 'var(--radius-lg)',
          borderLeft: `4px solid ${getMoodColor(selectedDay.data.avgMood)}`
        }}>
          <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span>{getMoodEmoji(selectedDay.data.avgMood)}</span>
            {new Date(selectedDay.date).toLocaleDateString('en-GB', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            <strong>Average mood:</strong> {selectedDay.data.avgMood}/10
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            <strong>Check-ins:</strong> {selectedDay.data.count}
          </p>

          {selectedDay.data.entries.length > 0 && selectedDay.data.entries[0].notes && (
            <div style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
              "{selectedDay.data.entries[0].notes}"
            </div>
          )}

          <button
            onClick={() => setSelectedDay(null)}
            style={{
              marginTop: 'var(--spacing-md)',
              background: 'none',
              border: 'none',
              color: 'var(--primary-color)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
    <div style={{
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      backgroundColor: color
    }} />
    <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
      {label}
    </span>
  </div>
);

export default MoodCalendar;

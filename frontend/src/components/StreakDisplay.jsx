import React from 'react';

/**
 * StreakDisplay - Shows user's check-in streak with fire emoji
 * Encourages consistent engagement through visual feedback
 */
const StreakDisplay = ({ currentStreak = 0, longestStreak = 0, totalCheckIns = 0, compact = false }) => {
  // Get appropriate fire emoji based on streak
  const getFireEmoji = (streak) => {
    if (streak >= 30) return '🔥🔥🔥';
    if (streak >= 14) return '🔥🔥';
    if (streak >= 7) return '🔥';
    if (streak >= 3) return '✨';
    return '🌱';
  };

  // Get encouragement message
  const getMessage = (streak) => {
    if (streak === 0) return "Start your streak today!";
    if (streak === 1) return "Great start! Keep going!";
    if (streak < 7) return `${7 - streak} more days for Week Warrior!`;
    if (streak < 14) return "Amazing consistency!";
    if (streak < 30) return "You're on fire!";
    return "Incredible dedication!";
  };

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        background: currentStreak > 0 ? 'linear-gradient(135deg, #FFE4B5, #FFD280)' : 'var(--surface)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--font-size-small)',
        fontWeight: 600,
        color: 'var(--text-primary)'
      }}>
        <span>{getFireEmoji(currentStreak)}</span>
        <span>{currentStreak}</span>
      </div>
    );
  }

  const containerStyle = {
    background: 'linear-gradient(145deg, var(--surface) 0%, #FFF8F0 100%)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)',
    textAlign: 'center'
  };

  const streakNumberStyle = {
    fontSize: '3rem',
    fontWeight: 700,
    fontFamily: 'var(--font-family-heading)',
    color: currentStreak > 0 ? 'var(--primary-color)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)'
  };

  const labelStyle = {
    fontSize: 'var(--font-size-base)',
    color: 'var(--text-secondary)',
    marginTop: 'var(--spacing-xs)'
  };

  const messageStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--primary-color)',
    marginTop: 'var(--spacing-md)',
    fontWeight: 500,
    padding: 'var(--spacing-sm) var(--spacing-md)',
    background: 'var(--primary-light)',
    borderRadius: 'var(--radius-md)',
    display: 'inline-block'
  };

  const statsContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--spacing-xl)',
    marginTop: 'var(--spacing-lg)',
    paddingTop: 'var(--spacing-lg)',
    borderTop: '1px solid var(--border)'
  };

  const statStyle = {
    textAlign: 'center'
  };

  const statValueStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    color: 'var(--text-primary)'
  };

  const statLabelStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)',
    marginTop: '2px'
  };

  return (
    <div style={containerStyle}>
      <div style={streakNumberStyle}>
        <span style={{ fontSize: '2rem' }}>{getFireEmoji(currentStreak)}</span>
        {currentStreak}
        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 400 }}>days</span>
      </div>
      <p style={labelStyle}>Current Streak</p>

      <p style={messageStyle}>{getMessage(currentStreak)}</p>

      <div style={statsContainerStyle}>
        <div style={statStyle}>
          <div style={statValueStyle}>{longestStreak}</div>
          <div style={statLabelStyle}>Best Streak</div>
        </div>
        <div style={statStyle}>
          <div style={statValueStyle}>{totalCheckIns}</div>
          <div style={statLabelStyle}>Total Check-ins</div>
        </div>
      </div>
    </div>
  );
};

/**
 * AchievementBadge - Individual achievement display
 */
export const AchievementBadge = ({ icon, title, description, isEarned = false, earnedAt }) => {
  const badgeStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'var(--spacing-md)',
    background: isEarned ? 'var(--surface)' : 'var(--background)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: isEarned ? 'var(--shadow-sm)' : 'none',
    border: isEarned ? 'none' : '2px dashed var(--border)',
    transition: 'all var(--transition-base)',
    opacity: isEarned ? 1 : 0.5,
    filter: isEarned ? 'none' : 'grayscale(100%)',
    minWidth: '100px',
    textAlign: 'center'
  };

  const iconStyle = {
    fontSize: '2rem',
    marginBottom: 'var(--spacing-xs)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-small)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px'
  };

  const descriptionStyle = {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.3
  };

  return (
    <div style={badgeStyle} title={isEarned ? `Earned: ${new Date(earnedAt).toLocaleDateString()}` : description}>
      <span style={iconStyle}>{icon}</span>
      <span style={titleStyle}>{title}</span>
      {isEarned && (
        <span style={{ fontSize: '0.65rem', color: 'var(--success-color)' }}>Earned!</span>
      )}
    </div>
  );
};

/**
 * AchievementsGrid - Display all achievements
 */
export const AchievementsGrid = ({ achievements = [], userAchievements = [] }) => {
  // Default achievements if none provided
  const defaultAchievements = [
    { code: 'first_checkin', icon: '🌱', title: 'First Step', description: 'Complete your first check-in' },
    { code: 'week_streak', icon: '🔥', title: 'Week Warrior', description: '7-day streak' },
    { code: 'month_streak', icon: '🏆', title: 'Monthly Master', description: '30-day streak' },
    { code: 'ten_checkins', icon: '⭐', title: 'Getting Consistent', description: '10 check-ins' },
    { code: 'fifty_checkins', icon: '💫', title: 'Dedicated Tracker', description: '50 check-ins' },
    { code: 'chat_with_luna', icon: '🌙', title: 'Made a Friend', description: 'Chat with Luna' },
    { code: 'mood_improver', icon: '🌈', title: 'Rising Spirits', description: 'Improve mood by 3+' },
    { code: 'self_care_champion', icon: '💜', title: 'Self-Care Champion', description: 'Complete 5 activities' }
  ];

  const displayAchievements = achievements.length > 0 ? achievements : defaultAchievements;

  const earnedCodes = new Set(userAchievements.map(ua => ua.achievement_code || ua.code));

  const containerStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)'
  };

  const countStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: 'var(--spacing-md)'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <span>🏅</span> Achievements
        </h3>
        <span style={countStyle}>
          {earnedCodes.size}/{displayAchievements.length} earned
        </span>
      </div>

      <div style={gridStyle}>
        {displayAchievements.map((achievement, index) => {
          const userAchievement = userAchievements.find(
            ua => (ua.achievement_code || ua.code) === achievement.code
          );

          return (
            <AchievementBadge
              key={achievement.code || index}
              icon={achievement.icon}
              title={achievement.title}
              description={achievement.description}
              isEarned={earnedCodes.has(achievement.code)}
              earnedAt={userAchievement?.earned_at}
            />
          );
        })}
      </div>
    </div>
  );
};

export default StreakDisplay;

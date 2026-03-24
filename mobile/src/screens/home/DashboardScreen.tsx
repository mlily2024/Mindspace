/**
 * Dashboard Screen
 * Main home screen showing overview of user's mental health data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { moodAPI, insightsAPI, recommendationsAPI } from '../../services/api';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';

interface MoodEntry {
  entry_id: string;
  mood_score: number;
  entry_date: string;
}

interface Insight {
  insight_id: string;
  title: string;
  description: string;
  insight_type: string;
}

interface Recommendation {
  recommendation_id: string;
  title: string;
  description: string;
  effort_level: string;
}

const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);
  const [latestInsight, setLatestInsight] = useState<Insight | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [moodsResponse, insightsResponse, recsResponse, statsResponse] = await Promise.all([
        moodAPI.getAll({ limit: 7 }),
        insightsAPI.getAll({ limit: 1 }),
        recommendationsAPI.getAll({ limit: 3 }),
        moodAPI.getStatistics()
      ]);

      if (moodsResponse.data?.entries) {
        setRecentMoods(moodsResponse.data.entries);
      }

      if (insightsResponse.data?.insights?.[0]) {
        setLatestInsight(insightsResponse.data.insights[0]);
      }

      if (recsResponse.data?.recommendations) {
        setRecommendations(recsResponse.data.recommendations);
      }

      if (statsResponse.data) {
        setStatistics(statsResponse.data);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const getMoodEmoji = (score: number): string => {
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    if (score >= 2) return '😔';
    return '😢';
  };

  const getMoodColor = (score: number): string => {
    const moodColors = colors.mood as Record<number, string>;
    return moodColors[Math.round(score)] || colors.textSecondary;
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{user?.name || 'Friend'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      {statistics && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{getMoodEmoji(statistics.avg_mood || 5)}</Text>
            <Text style={styles.statValue}>{(statistics.avg_mood || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avg Mood</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>📊</Text>
            <Text style={styles.statValue}>{statistics.entry_count || 0}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{statistics.current_streak || 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      )}

      {/* Recent Moods */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Moods</Text>
        {recentMoods.length > 0 ? (
          <View style={styles.moodChart}>
            {recentMoods.slice(0, 7).reverse().map((mood, index) => (
              <View key={mood.entry_id || index} style={styles.moodBar}>
                <View
                  style={[
                    styles.moodBarFill,
                    {
                      height: `${mood.mood_score * 10}%`,
                      backgroundColor: getMoodColor(mood.mood_score)
                    }
                  ]}
                />
                <Text style={styles.moodDay}>
                  {new Date(mood.entry_date).toLocaleDateString('en-GB', { weekday: 'short' }).charAt(0)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>No mood entries yet</Text>
            <Text style={styles.emptySubtext}>Start tracking to see your progress!</Text>
          </View>
        )}
      </View>

      {/* Latest Insight */}
      {latestInsight && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Insight</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightEmoji}>💡</Text>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{latestInsight.title}</Text>
              <Text style={styles.insightDescription} numberOfLines={2}>
                {latestInsight.description}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Self-Care Suggestions</Text>
        {recommendations.length > 0 ? (
          recommendations.map((rec, index) => (
            <TouchableOpacity key={rec.recommendation_id || index} style={styles.recCard}>
              <View style={styles.recContent}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDescription} numberOfLines={2}>
                  {rec.description}
                </Text>
                <View style={styles.recMeta}>
                  <Text style={styles.recEffort}>
                    {rec.effort_level === 'low' ? '🟢 Easy' :
                     rec.effort_level === 'medium' ? '🟡 Medium' : '🔴 Challenging'}
                  </Text>
                </View>
              </View>
              <Text style={styles.recArrow}>›</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyText}>Recommendations coming soon</Text>
            <Text style={styles.emptySubtext}>Track your mood to get personalized suggestions</Text>
          </View>
        )}
      </View>

      {/* Crisis Resources Banner */}
      <TouchableOpacity style={styles.crisisBanner}>
        <Text style={styles.crisisEmoji}>💙</Text>
        <View style={styles.crisisContent}>
          <Text style={styles.crisisTitle}>Need immediate support?</Text>
          <Text style={styles.crisisSubtitle}>Access crisis resources anytime</Text>
        </View>
        <Text style={styles.crisisArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  contentContainer: {
    padding: spacing.md
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.base
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  greeting: {
    fontSize: fontSize.base,
    color: colors.textSecondary
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary
  },
  logoutButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full
  },
  logoutText: {
    color: colors.primary,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.sm
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 4,
    elevation: 2
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  section: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md
  },
  moodChart: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    height: 150,
    alignItems: 'flex-end'
  },
  moodBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%'
  },
  moodBarFill: {
    width: 20,
    borderRadius: borderRadius.sm,
    minHeight: 10
  },
  moodDay: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    color: colors.textSecondary
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center'
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm
  },
  emptyText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center'
  },
  insightEmoji: {
    fontSize: 32,
    marginRight: spacing.md
  },
  insightContent: {
    flex: 1
  },
  insightTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  insightDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18
  },
  recCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center'
  },
  recContent: {
    flex: 1
  },
  recTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  recDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs
  },
  recMeta: {
    flexDirection: 'row'
  },
  recEffort: {
    fontSize: fontSize.xs,
    color: colors.textMuted
  },
  recArrow: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.sm
  },
  crisisBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md
  },
  crisisEmoji: {
    fontSize: 24,
    marginRight: spacing.md
  },
  crisisContent: {
    flex: 1
  },
  crisisTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary
  },
  crisisSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary
  },
  crisisArrow: {
    fontSize: 24,
    color: colors.primary
  }
});

export default DashboardScreen;

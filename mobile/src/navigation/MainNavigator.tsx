/**
 * Main Navigator
 * Bottom tab navigation for authenticated users
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, View } from 'react-native';
import DashboardScreen from '../screens/home/DashboardScreen';
import { colors, spacing } from '../theme/colors';

// Placeholder screens (to be implemented)
const MoodTrackerScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>Mood Tracker</Text>
    <Text style={styles.placeholderSubtext}>Coming Soon</Text>
  </View>
);

const InsightsScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>Insights</Text>
    <Text style={styles.placeholderSubtext}>Coming Soon</Text>
  </View>
);

const CommunityScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>Community</Text>
    <Text style={styles.placeholderSubtext}>Coming Soon</Text>
  </View>
);

const ProfileScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>Profile</Text>
    <Text style={styles.placeholderSubtext}>Coming Soon</Text>
  </View>
);

export type MainTabParamList = {
  Dashboard: undefined;
  MoodTracker: undefined;
  Insights: undefined;
  Community: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
}

const TabIcon: React.FC<{ emoji: string; focused: boolean }> = ({ emoji, focused }) => (
  <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          height: 70
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: spacing.xs
        },
        headerStyle: {
          backgroundColor: colors.primary
        },
        headerTintColor: colors.textLight,
        headerTitleStyle: {
          fontWeight: '600'
        }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          headerTitle: 'MindSpace'
        }}
      />
      <Tab.Screen
        name="MoodTracker"
        component={MoodTrackerScreen}
        options={{
          title: 'Check In',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✨" focused={focused} />,
          headerTitle: 'Mood Check-In'
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          title: 'Insights',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌟" focused={focused} />,
          headerTitle: 'Your Insights'
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤝" focused={focused} />,
          headerTitle: 'Peer Support'
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          headerTitle: 'Your Profile'
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  placeholderSubtext: {
    fontSize: 16,
    color: colors.textSecondary
  }
});

export default MainNavigator;

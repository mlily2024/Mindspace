# API Documentation

Mental Health Tracker Application - RESTful API Documentation

**Base URL**: `http://localhost:5000/api`
**Version**: 1.0.0
**Authentication**: JWT Bearer Token

## Table of Contents
1. [Authentication](#authentication)
2. [Mood Tracking](#mood-tracking)
3. [Insights](#insights)
4. [Recommendations](#recommendations)
5. [Error Handling](#error-handling)

## Authentication

### Register User
Create a new user account.

**Endpoint**: `POST /auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "JohnDoe",
  "isAnonymous": false,
  "userGroup": "professional"
}
```

**Parameters**:
- `email` (string, required*): Valid email address (*not required if anonymous)
- `password` (string, required): Minimum 8 characters
- `username` (string, optional): Display name
- `isAnonymous` (boolean, optional): Create anonymous account
- `userGroup` (string, optional): One of: `student`, `professional`, `parent`, `elderly`, `other`

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "username": "JohnDoe",
      "userGroup": "professional",
      "isAnonymous": false
    },
    "token": "jwt-token-here"
  }
}
```

---

### Login
Authenticate existing user.

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "username": "JohnDoe",
      "userGroup": "professional",
      "isAnonymous": false
    },
    "token": "jwt-token-here"
  }
}
```

---

### Get Profile
Get current user profile. **Requires authentication**.

**Endpoint**: `GET /auth/profile`

**Headers**:
```
Authorization: Bearer {token}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "uuid",
      "email": "user@example.com",
      "username": "JohnDoe",
      "userGroup": "professional",
      "isAnonymous": false,
      "timezone": "Europe/London",
      "language": "en-GB",
      "theme": "light",
      "fontSize": "medium",
      "accessibilityMode": false,
      "notificationsEnabled": true,
      "peerSupportEnabled": true,
      "createdAt": "2024-12-01T10:00:00Z",
      "lastLogin": "2024-12-30T15:30:00Z"
    }
  }
}
```

---

### Update Profile
Update user profile information. **Requires authentication**.

**Endpoint**: `PUT /auth/profile`

**Request Body**:
```json
{
  "username": "NewUsername",
  "userGroup": "student",
  "timezone": "Europe/London"
}
```

**Response**: `200 OK`

---

### Update Preferences
Update user preferences. **Requires authentication**.

**Endpoint**: `PUT /auth/preferences`

**Request Body**:
```json
{
  "language": "en-GB",
  "theme": "dark",
  "fontSize": "large",
  "accessibilityMode": true,
  "notificationsEnabled": true,
  "peerSupportEnabled": false
}
```

**Response**: `200 OK`

---

### Delete Account
Permanently delete user account. **Requires authentication**.

**Endpoint**: `DELETE /auth/account`

**Response**: `200 OK`

---

### Request Data Export
Request GDPR data export. **Requires authentication**.

**Endpoint**: `POST /auth/data-export`

**Response**: `200 OK`

---

## Mood Tracking

### Create Mood Entry
Log a new mood entry. **Requires authentication**.

**Endpoint**: `POST /mood`

**Request Body**:
```json
{
  "moodScore": 7,
  "energyLevel": 6,
  "stressLevel": 4,
  "sleepQuality": 8,
  "sleepHours": 7.5,
  "anxietyLevel": 3,
  "socialInteractionQuality": 7,
  "notes": "Feeling good today, had a productive morning",
  "activities": ["exercise", "meditation"],
  "triggers": []
}
```

**Parameters**:
- `moodScore` (integer, required): 1-10
- `energyLevel` (integer, optional): 1-10
- `stressLevel` (integer, optional): 1-10
- `sleepQuality` (integer, optional): 1-10
- `sleepHours` (number, optional): 0-24
- `anxietyLevel` (integer, optional): 1-10
- `socialInteractionQuality` (integer, optional): 1-10
- `notes` (string, optional): Private notes (encrypted)
- `activities` (array, optional): Activities performed
- `triggers` (array, optional): Potential triggers

**Response**: `201 Created`
```json
{
  "success": true,
  "message": "Mood entry created successfully",
  "data": {
    "entry": {
      "entryId": "uuid",
      "userId": "uuid",
      "entryDate": "2024-12-30",
      "entryTime": "15:30:00",
      "moodScore": 7,
      "energyLevel": 6,
      "stressLevel": 4,
      "sleepQuality": 8,
      "sleepHours": 7.5,
      "anxietyLevel": 3,
      "socialInteractionQuality": 7,
      "notes": "Feeling good today...",
      "activities": ["exercise", "meditation"],
      "triggers": [],
      "createdAt": "2024-12-30T15:30:00Z"
    }
  }
}
```

---

### Get Mood Entries
Retrieve user's mood entries. **Requires authentication**.

**Endpoint**: `GET /mood`

**Query Parameters**:
- `startDate` (string, optional): ISO date (YYYY-MM-DD)
- `endDate` (string, optional): ISO date (YYYY-MM-DD)
- `limit` (integer, optional): Default 30
- `offset` (integer, optional): Default 0

**Example**: `GET /mood?startDate=2024-12-01&endDate=2024-12-30&limit=50`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "entries": [...],
    "count": 25
  }
}
```

---

### Get Mood Entry
Retrieve a specific mood entry. **Requires authentication**.

**Endpoint**: `GET /mood/:entryId`

**Response**: `200 OK`

---

### Update Mood Entry
Update an existing mood entry. **Requires authentication**.

**Endpoint**: `PUT /mood/:entryId`

**Request Body**: Same as Create Mood Entry

**Response**: `200 OK`

---

### Delete Mood Entry
Delete a mood entry. **Requires authentication**.

**Endpoint**: `DELETE /mood/:entryId`

**Response**: `200 OK`

---

### Get Mood Statistics
Get statistical analysis of mood data. **Requires authentication**.

**Endpoint**: `GET /mood/statistics`

**Query Parameters**:
- `period` (integer, optional): Days to analyze (default: 30)

**Example**: `GET /mood/statistics?period=90`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "statistics": {
      "totalEntries": 25,
      "avgMood": "7.2",
      "avgEnergy": "6.8",
      "avgStress": "4.5",
      "avgSleepQuality": "7.1",
      "avgSleepHours": "7.3",
      "avgAnxiety": "3.9",
      "avgSocial": "6.5",
      "minMood": "3",
      "maxMood": "9",
      "firstEntryDate": "2024-12-01",
      "lastEntryDate": "2024-12-30"
    }
  }
}
```

---

### Get Mood Trends
Get trend analysis over time. **Requires authentication**.

**Endpoint**: `GET /mood/trends`

**Query Parameters**:
- `period` (integer, optional): Days to analyze (default: 30)
- `groupBy` (string, optional): `day`, `week`, or `month` (default: week)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "groupBy": "week",
    "trends": [
      {
        "period": "2024-52",
        "entryCount": "7",
        "avgMood": "7.5",
        "avgEnergy": "7.0",
        "avgStress": "4.0",
        "avgAnxiety": "3.5",
        "avgSleepQuality": "7.8"
      },
      ...
    ]
  }
}
```

---

## Insights

### Generate Insights
Generate AI insights from mood data. **Requires authentication**.

**Endpoint**: `POST /insights/generate`

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Generated 5 insights",
  "data": {
    "insights": [...]
  }
}
```

---

### Get Insights
Retrieve user insights. **Requires authentication**.

**Endpoint**: `GET /insights`

**Query Parameters**:
- `limit` (integer, optional): Default 10
- `unreadOnly` (boolean, optional): Filter unread insights

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "insightId": "uuid",
        "insightType": "trend",
        "insightPeriod": "weekly",
        "insightData": {
          "title": "Declining Mood Trend",
          "description": "Your mood has decreased by 2.0 points...",
          "metric": "mood",
          "previousValue": 8.0,
          "currentValue": 6.0,
          "change": -2.0
        },
        "severity": "moderate",
        "isRead": false,
        "generatedAt": "2024-12-30T10:00:00Z"
      },
      ...
    ],
    "count": 5
  }
}
```

---

### Mark Insight as Read
Mark an insight as read. **Requires authentication**.

**Endpoint**: `PUT /insights/:insightId/read`

**Response**: `200 OK`

---

### Get Safety Alerts
Retrieve safety alerts. **Requires authentication**.

**Endpoint**: `GET /insights/safety-alerts`

**Query Parameters**:
- `limit` (integer, optional): Default 10
- `unacknowledgedOnly` (boolean, optional): Filter unacknowledged alerts

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "alertId": "uuid",
        "alertType": "high_stress",
        "severity": "high",
        "alertData": {
          "daysWithHighStress": 5,
          "message": "You've reported high stress levels..."
        },
        "triggeredAt": "2024-12-30T08:00:00Z",
        "isAcknowledged": false
      },
      ...
    ],
    "count": 2
  }
}
```

---

### Acknowledge Safety Alert
Acknowledge a safety alert. **Requires authentication**.

**Endpoint**: `PUT /insights/safety-alerts/:alertId/acknowledge`

**Request Body**:
```json
{
  "actionTaken": "Contacted therapist"
}
```

**Response**: `200 OK`

---

## Recommendations

### Generate Recommendations
Generate personalized recommendations. **Requires authentication**.

**Endpoint**: `POST /recommendations/generate`

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Generated 5 recommendations",
  "data": {
    "recommendations": [...]
  }
}
```

---

### Get Recommendations
Retrieve recommendations. **Requires authentication**.

**Endpoint**: `GET /recommendations`

**Query Parameters**:
- `activeOnly` (boolean, optional): Default true
- `limit` (integer, optional): Default 10

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "recommendationId": "uuid",
        "recommendationType": "breathing",
        "title": "Deep Breathing Exercise",
        "description": "Try the 4-7-8 breathing technique...",
        "effortLevel": "low",
        "estimatedDuration": 5,
        "priority": 1,
        "isCompleted": false,
        "createdAt": "2024-12-30T10:00:00Z",
        "expiresAt": "2025-01-06T10:00:00Z"
      },
      ...
    ],
    "count": 5
  }
}
```

---

### Complete Recommendation
Mark recommendation as completed. **Requires authentication**.

**Endpoint**: `PUT /recommendations/:recommendationId/complete`

**Response**: `200 OK`

---

### Submit Feedback
Submit feedback for a recommendation. **Requires authentication**.

**Endpoint**: `POST /recommendations/:recommendationId/feedback`

**Request Body**:
```json
{
  "wasHelpful": true,
  "wasCompleted": true,
  "rating": 5,
  "feedbackText": "This breathing exercise really helped me relax"
}
```

**Response**: `201 Created`

---

### Get Crisis Resources
Get UK crisis support resources. **No authentication required**.

**Endpoint**: `GET /recommendations/crisis-resources`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "resources": {
      "emergency": {
        "title": "Emergency Services",
        "phone": "999",
        "description": "For immediate life-threatening emergencies"
      },
      "samaritans": {
        "title": "Samaritans",
        "phone": "116 123",
        "email": "jo@samaritans.org",
        "website": "https://www.samaritans.org",
        "description": "24/7 emotional support...",
        "available": "24/7"
      },
      ...
    }
  }
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Valid email required"
    }
  ]
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Common Error Messages

**Authentication Errors**:
- `"Access token required"` - No token provided
- `"Invalid or expired token"` - Invalid JWT token
- `"Invalid credentials"` - Wrong email/password

**Validation Errors**:
- `"Valid email required"` - Invalid email format
- `"Password must be at least 8 characters"` - Password too short
- `"Mood score must be between 1-10"` - Invalid range

**Rate Limiting**:
- `"Too many requests from this IP, please try again later"`

---

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time when limit resets

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer your-jwt-token-here
```

Tokens expire after 7 days by default.

---

## Pagination

Endpoints returning lists support pagination:

```
GET /mood?limit=20&offset=40
```

---

## Date Formats

All dates use ISO 8601 format:
- Date: `YYYY-MM-DD` (e.g., `2024-12-30`)
- DateTime: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2024-12-30T15:30:00.000Z`)

---

**Version**: 1.0.0
**Last Updated**: December 2024

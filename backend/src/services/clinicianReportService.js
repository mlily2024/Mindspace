const db = require('../config/database');

// ── UK Crisis Resources ─────────────────────────────────────────────────────

const UK_RESOURCES = [
  { name: 'Emergency Services', contact: '999', type: 'emergency' },
  { name: 'Samaritans', contact: '116 123', type: 'crisis', note: 'Available 24/7, free to call' },
  { name: 'Shout Crisis Text Line', contact: 'Text SHOUT to 85258', type: 'crisis' },
  { name: 'NHS Urgent', contact: '111', type: 'urgent' },
  { name: 'NHS IAPT Self-Referral', contact: 'https://www.nhs.uk/mental-health/talking-therapies-medicine-treatments/talking-therapies-and-counselling/nhs-talking-therapies/', type: 'referral' },
  { name: 'Mind Infoline', contact: '0300 123 3393', type: 'support' }
];

// ── Helper Functions ────────────────────────────────────────────────────────

function determineTrendDirection(values) {
  if (!values || values.length < 2) return 'insufficient_data';

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 'stable';

  const slope = (n * sumXY - sumX * sumY) / denominator;

  if (slope > 0.05) return 'improving';
  if (slope < -0.05) return 'declining';
  return 'stable';
}

function computeWeeklyAverages(rows, field) {
  const weeks = {};
  for (const row of rows) {
    const date = new Date(row.date);
    // ISO week start (Monday)
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(date.setDate(diff)).toISOString().split('T')[0];

    if (!weeks[weekStart]) weeks[weekStart] = [];
    weeks[weekStart].push(row[field]);
  }

  return Object.entries(weeks)
    .map(([week, values]) => ({
      week_start: week,
      average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
      count: values.length
    }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

function generateRecommendations(summary, assessmentScores, riskFlags) {
  const recommendations = [];

  // Based on PHQ-9
  const phq9 = assessmentScores.find(a => a.instrument === 'PHQ-9');
  if (phq9) {
    if (phq9.latest_score >= 20) {
      recommendations.push('Consider immediate psychiatric evaluation — PHQ-9 indicates severe depression.');
    } else if (phq9.latest_score >= 15) {
      recommendations.push('Active treatment recommended — PHQ-9 indicates moderately severe depression. Consider combination therapy (medication + psychological).');
    } else if (phq9.latest_score >= 10) {
      recommendations.push('Watchful waiting or treatment plan — PHQ-9 indicates moderate depression. Consider structured psychological intervention.');
    }
  }

  // Based on GAD-7
  const gad7 = assessmentScores.find(a => a.instrument === 'GAD-7');
  if (gad7) {
    if (gad7.latest_score >= 15) {
      recommendations.push('Severe anxiety indicated — consider CBT referral and/or anxiolytic review.');
    } else if (gad7.latest_score >= 10) {
      recommendations.push('Moderate anxiety — consider guided self-help or structured CBT programme.');
    }
  }

  // Based on ISI
  const isi = assessmentScores.find(a => a.instrument === 'ISI');
  if (isi) {
    if (isi.latest_score >= 15) {
      recommendations.push('Clinically significant insomnia — consider CBT-I referral or sleep hygiene intervention.');
    }
  }

  // Based on sleep/mood correlation
  if (summary.avg_sleep_hours !== null && summary.avg_sleep_hours < 6) {
    recommendations.push('Consistently low sleep duration detected — sleep assessment and intervention may benefit mood outcomes.');
  }

  // Based on trend
  if (summary.mood_trend === 'declining') {
    recommendations.push('Declining mood trend over the reporting period — consider increased session frequency or treatment adjustment.');
  }

  // Risk-based
  if (riskFlags.length > 0) {
    recommendations.push('Safety flags detected during reporting period — conduct risk assessment at next session.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current treatment approach — monitoring data shows stable or improving patterns.');
  }

  return recommendations;
}

// ── Service ─────────────────────────────────────────────────────────────────

const clinicianReportService = {
  /**
   * Generates a comprehensive clinician handoff report.
   */
  async generateReport(userId, startDate, endDate) {
    // ── Mood entries ──
    const moodEntries = await db.all(
      `SELECT date, mood_score, stress_level, sleep_hours, sleep_quality, triggers, activities
       FROM mood_entries
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    const totalEntries = moodEntries.length;

    // Averages
    const moodScores = moodEntries.filter(e => e.mood_score != null).map(e => e.mood_score);
    const stressLevels = moodEntries.filter(e => e.stress_level != null).map(e => e.stress_level);
    const sleepHours = moodEntries.filter(e => e.sleep_hours != null).map(e => e.sleep_hours);
    const sleepQualities = moodEntries.filter(e => e.sleep_quality != null).map(e => e.sleep_quality);

    const avg = arr => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

    const avgMood = avg(moodScores);
    const avgStress = avg(stressLevels);
    const avgSleepHours = avg(sleepHours);
    const avgSleepQuality = avg(sleepQualities);
    const moodTrend = determineTrendDirection(moodScores);

    // ── Summary ──
    const summary = {
      date_range: { start: startDate, end: endDate },
      total_entries: totalEntries,
      avg_mood: avgMood,
      avg_stress: avgStress,
      avg_sleep_hours: avgSleepHours,
      avg_sleep_quality: avgSleepQuality,
      mood_trend: moodTrend
    };

    // ── Mood trends (weekly) ──
    const weeklyMood = computeWeeklyAverages(
      moodEntries.filter(e => e.mood_score != null),
      'mood_score'
    );

    // Best/worst periods
    let bestWeek = null;
    let worstWeek = null;
    if (weeklyMood.length > 0) {
      bestWeek = weeklyMood.reduce((best, w) => w.average > best.average ? w : best, weeklyMood[0]);
      worstWeek = weeklyMood.reduce((worst, w) => w.average < worst.average ? w : worst, weeklyMood[0]);
    }

    const moodTrends = {
      weekly_averages: weeklyMood,
      best_period: bestWeek,
      worst_period: worstWeek
    };

    // ── Sleep analysis ──
    const weeklySleep = computeWeeklyAverages(
      moodEntries.filter(e => e.sleep_hours != null),
      'sleep_hours'
    );

    // Mood-sleep correlation (simple Pearson)
    let sleepMoodCorrelation = null;
    const pairedEntries = moodEntries.filter(e => e.mood_score != null && e.sleep_hours != null);
    if (pairedEntries.length >= 5) {
      const moods = pairedEntries.map(e => e.mood_score);
      const sleeps = pairedEntries.map(e => e.sleep_hours);
      const mMood = moods.reduce((a, b) => a + b, 0) / moods.length;
      const mSleep = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;

      let num = 0, dMood = 0, dSleep = 0;
      for (let i = 0; i < moods.length; i++) {
        const dm = moods[i] - mMood;
        const ds = sleeps[i] - mSleep;
        num += dm * ds;
        dMood += dm * dm;
        dSleep += ds * ds;
      }
      const denom = Math.sqrt(dMood * dSleep);
      sleepMoodCorrelation = denom > 0 ? Math.round((num / denom) * 1000) / 1000 : 0;
    }

    const sleepAnalysis = {
      avg_hours: avgSleepHours,
      avg_quality: avgSleepQuality,
      quality_trend: determineTrendDirection(sleepQualities),
      weekly_averages: weeklySleep,
      mood_correlation: sleepMoodCorrelation
    };

    // ── Assessment scores ──
    const assessmentScores = await db.all(
      `SELECT instrument, score, severity, flags, completed_at
       FROM clinical_assessment_responses
       WHERE user_id = ? AND completed_at BETWEEN ? AND ?
       ORDER BY completed_at ASC`,
      [userId, startDate, endDate]
    );

    const parsedAssessments = assessmentScores.map(a => ({
      ...a,
      flags: JSON.parse(a.flags || '[]')
    }));

    // Latest score per instrument
    const latestByInstrument = {};
    for (const a of parsedAssessments) {
      latestByInstrument[a.instrument] = a;
    }

    const assessmentSummary = Object.values(latestByInstrument).map(a => ({
      instrument: a.instrument,
      latest_score: a.score,
      latest_severity: a.severity,
      completed_at: a.completed_at,
      total_administrations: parsedAssessments.filter(r => r.instrument === a.instrument).length
    }));

    // ── Triggers analysis ──
    const triggerCounts = {};
    const lowMoodTriggers = {};
    for (const entry of moodEntries) {
      if (entry.triggers) {
        let triggers;
        try {
          triggers = JSON.parse(entry.triggers);
        } catch {
          triggers = entry.triggers.split(',').map(t => t.trim());
        }
        if (Array.isArray(triggers)) {
          for (const t of triggers) {
            const key = String(t).toLowerCase().trim();
            if (!key) continue;
            triggerCounts[key] = (triggerCounts[key] || 0) + 1;
            if (entry.mood_score != null && entry.mood_score <= 4) {
              lowMoodTriggers[key] = (lowMoodTriggers[key] || 0) + 1;
            }
          }
        }
      }
    }

    const identifiedTriggers = {
      all_triggers: Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([trigger, count]) => ({ trigger, count })),
      low_mood_triggers: Object.entries(lowMoodTriggers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trigger, count]) => ({ trigger, count }))
    };

    // ── Techniques effectiveness ──
    const techniques = await db.all(
      `SELECT technique_name, effectiveness_score, used_at
       FROM luna_technique_effectiveness
       WHERE user_id = ? AND used_at BETWEEN ? AND ?
       ORDER BY used_at ASC`,
      [userId, startDate, endDate]
    );

    const techniqueMap = {};
    for (const t of techniques) {
      if (!techniqueMap[t.technique_name]) {
        techniqueMap[t.technique_name] = { scores: [], count: 0 };
      }
      techniqueMap[t.technique_name].scores.push(t.effectiveness_score);
      techniqueMap[t.technique_name].count++;
    }

    const techniquesTried = Object.entries(techniqueMap)
      .map(([name, data]) => ({
        technique: name,
        times_used: data.count,
        avg_effectiveness: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100
      }))
      .sort((a, b) => b.avg_effectiveness - a.avg_effectiveness);

    // ── Risk flags ──
    const safetyFlags = await db.all(
      `SELECT * FROM clinical_safety_flags
       WHERE user_id = ? AND created_at BETWEEN ? AND ?
       ORDER BY created_at DESC`,
      [userId, startDate, endDate]
    );

    const riskFlags = safetyFlags.map(f => ({
      date: f.created_at,
      instrument: f.instrument,
      item_position: f.item_position,
      item_text: f.item_text,
      score: f.score,
      flag_type: f.flag_type
    }));

    // ── Recommendations ──
    const recommendations = generateRecommendations(summary, assessmentSummary, riskFlags);

    // ── Compile full report ──
    const report = {
      user_id: userId,
      generated_at: new Date().toISOString(),
      summary,
      mood_trends: moodTrends,
      sleep_analysis: sleepAnalysis,
      assessment_scores: {
        responses: parsedAssessments,
        summary: assessmentSummary
      },
      identified_triggers: identifiedTriggers,
      techniques_tried: techniquesTried,
      risk_flags: riskFlags,
      recommendations
    };

    // Save to database
    const result = await db.run(
      `INSERT INTO clinician_reports
         (user_id, start_date, end_date, report_data, generated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [userId, startDate, endDate, JSON.stringify(report)]
    );

    report.id = result.lastID;
    return report;
  },

  /**
   * Returns all generated reports for a user.
   */
  async getReports(userId) {
    const rows = await db.all(
      `SELECT id, start_date, end_date, generated_at
       FROM clinician_reports
       WHERE user_id = ?
       ORDER BY generated_at DESC`,
      [userId]
    );

    return rows;
  },

  /**
   * Returns a specific report, verifying ownership.
   */
  async getReport(reportId, userId) {
    const row = await db.get(
      `SELECT * FROM clinician_reports
       WHERE id = ? AND user_id = ?`,
      [reportId, userId]
    );

    if (!row) return null;

    return {
      id: row.id,
      user_id: row.user_id,
      start_date: row.start_date,
      end_date: row.end_date,
      generated_at: row.generated_at,
      report_data: JSON.parse(row.report_data)
    };
  },

  /**
   * Checks if a user needs care escalation based on latest assessment scores.
   * PHQ-9 >= 15, GAD-7 >= 15, or PHQ-9 item 9 flagged.
   */
  async checkEscalation(userId) {
    const reasons = [];
    let maxSeverity = 'none';

    // Check PHQ-9
    const phq9 = await db.get(
      `SELECT score, severity, flags FROM clinical_assessment_responses
       WHERE user_id = ? AND instrument = 'PHQ-9'
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    if (phq9) {
      if (phq9.score >= 15) {
        reasons.push(`PHQ-9 score ${phq9.score} (${phq9.severity}) indicates significant depression`);
        maxSeverity = phq9.score >= 20 ? 'critical' : 'high';
      }

      const flags = JSON.parse(phq9.flags || '[]');
      const item9Flag = flags.find(f => f.item_position === 9);
      if (item9Flag) {
        reasons.push(`PHQ-9 item 9 (self-harm/suicidal ideation) scored ${item9Flag.score}`);
        maxSeverity = 'critical';
      }
    }

    // Check GAD-7
    const gad7 = await db.get(
      `SELECT score, severity FROM clinical_assessment_responses
       WHERE user_id = ? AND instrument = 'GAD-7'
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    if (gad7 && gad7.score >= 15) {
      reasons.push(`GAD-7 score ${gad7.score} (${gad7.severity}) indicates severe anxiety`);
      if (maxSeverity !== 'critical') maxSeverity = 'high';
    }

    const needsEscalation = reasons.length > 0;

    // Create escalation record if needed
    if (needsEscalation) {
      await db.run(
        `INSERT INTO care_escalations
           (user_id, severity, reasons, resources, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [
          userId,
          maxSeverity,
          JSON.stringify(reasons),
          JSON.stringify(UK_RESOURCES)
        ]
      );
    }

    return {
      needsEscalation,
      severity: maxSeverity,
      reasons,
      resources: needsEscalation ? UK_RESOURCES : []
    };
  }
};

module.exports = clinicianReportService;

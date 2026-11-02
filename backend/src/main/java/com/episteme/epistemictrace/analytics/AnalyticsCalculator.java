package com.episteme.epistemictrace.analytics;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.episteme.epistemictrace.sdi.StruggleLevel;
import com.episteme.epistemictrace.sdi.StruggleLevels;

/**
 * Builds the analytics of one activity from the rows {@link AnalyticsRepository} reads (spec 29 R2-R4, R9). Plain
 * Java: no Spring, JPA or clock. The level boundaries are passed in (R8), so the same inputs always give the same result.
 */
public final class AnalyticsCalculator {

	private static final Comparator<StudentAnalytics> BY_PEAK_THEN_NAME = Comparator
		.comparing(StudentAnalytics::peakSdi, Comparator.nullsLast(Comparator.<Integer>reverseOrder()))
		.thenComparing(StudentAnalytics::name)
		.thenComparingLong(StudentAnalytics::studentId);

	private AnalyticsCalculator() {
	}

	/**
	 * One row per student with at least one of {@code sessions} (all of one activity), ordered by peak SDI descending
	 * (nulls last), then name, then id (R4).
	 * @param events event totals of those sessions; a session without a row has no events
	 * @param reflections reflection counts of those sessions; a session without a row has none
	 * @param identities name and email of every student in {@code sessions}
	 * @param mediumFrom the lowest SDI of level {@code MEDIUM} (configuration)
	 * @param threshold the activity's SDI threshold, the lowest SDI of level {@code HIGH}
	 * @throws IllegalStateException if a student in {@code sessions} has no identity
	 */
	public static List<StudentAnalytics> students(Collection<AnalyticsSessionRow> sessions,
			Collection<SessionEventTotals> events, Collection<SessionReflectionCount> reflections,
			Collection<StudentIdentity> identities, int mediumFrom, int threshold) {
		Map<Long, SessionEventTotals> eventsBySession = new HashMap<>();
		events.forEach(totals -> eventsBySession.put(totals.sessionId(), totals));
		Map<Long, Long> reflectionsBySession = new HashMap<>();
		reflections.forEach(count -> reflectionsBySession.put(count.sessionId(), count.reflectionCount()));
		Map<Long, StudentIdentity> identityByStudent = new HashMap<>();
		identities.forEach(identity -> identityByStudent.put(identity.studentId(), identity));

		Map<Long, List<AnalyticsSessionRow>> byStudent = new LinkedHashMap<>();
		for (AnalyticsSessionRow session : sessions) {
			byStudent.computeIfAbsent(session.studentId(), id -> new ArrayList<>()).add(session);
		}
		List<StudentAnalytics> rows = new ArrayList<>(byStudent.size());
		for (Map.Entry<Long, List<AnalyticsSessionRow>> entry : byStudent.entrySet()) {
			StudentIdentity identity = identityByStudent.get(entry.getKey());
			if (identity == null) {
				throw new IllegalStateException("Student " + entry.getKey() + " has no identity");
			}
			rows.add(student(identity, entry.getValue(), eventsBySession, reflectionsBySession, mediumFrom, threshold));
		}
		rows.sort(BY_PEAK_THEN_NAME);
		return rows;
	}

	private static StudentAnalytics student(StudentIdentity identity, List<AnalyticsSessionRow> sessions,
			Map<Long, SessionEventTotals> eventsBySession, Map<Long, Long> reflectionsBySession, int mediumFrom,
			int threshold) {
		long runCount = 0;
		long sessionSeconds = 0;
		long reflectionCount = 0;
		long lockedSessions = 0;
		Integer peakSdi = null;
		Instant latestEvent = null;
		Instant latestStart = null;
		for (AnalyticsSessionRow session : sessions) {
			SessionEventTotals events = eventsBySession.get(session.sessionId());
			if (events != null) {
				runCount += events.runCount();
				latestEvent = later(latestEvent, events.lastEventAt());
			}
			reflectionCount += reflectionsBySession.getOrDefault(session.sessionId(), 0L);
			if (session.endedAt() != null) {
				sessionSeconds += Math.max(0, Duration.between(session.startedAt(), session.endedAt()).getSeconds());
			}
			if (Boolean.TRUE.equals(session.runnerLocked())) {
				lockedSessions++;
			}
			peakSdi = higher(peakSdi, session.peakSdi());
			latestStart = later(latestStart, session.startedAt());
		}
		return new StudentAnalytics(identity.studentId(), identity.name(), identity.email(), sessions.size(), runCount,
				sessionSeconds, peakSdi, levelOf(peakSdi, mediumFrom, threshold), reflectionCount + lockedSessions,
				reflectionCount, (latestEvent != null) ? latestEvent : latestStart);
	}

	/** R2: the level of a peak SDI, or {@code null} when no run was scored. */
	public static StruggleLevel levelOf(Integer peakSdi, int mediumFrom, int threshold) {
		return (peakSdi != null) ? StruggleLevels.of(peakSdi, mediumFrom, threshold) : null;
	}

	/** R3: students per level. All three levels are always present; students without a level are not counted. */
	public static Map<StruggleLevel, Integer> distribution(Collection<StudentAnalytics> students) {
		Map<StruggleLevel, Integer> distribution = new EnumMap<>(StruggleLevel.class);
		for (StruggleLevel level : StruggleLevel.values()) {
			distribution.put(level, 0);
		}
		for (StudentAnalytics student : students) {
			if (student.level() != null) {
				distribution.merge(student.level(), 1, Integer::sum);
			}
		}
		return distribution;
	}

	/** R1: the sum of the students' counts and the highest peak SDI. */
	public static AnalyticsTotals totals(Collection<StudentAnalytics> students) {
		long sessionCount = 0;
		long runCount = 0;
		long sessionSeconds = 0;
		long breakerTriggerCount = 0;
		long reflectionCount = 0;
		Integer peakSdi = null;
		for (StudentAnalytics student : students) {
			sessionCount += student.sessionCount();
			runCount += student.runCount();
			sessionSeconds += student.sessionSeconds();
			breakerTriggerCount += student.breakerTriggerCount();
			reflectionCount += student.reflectionCount();
			peakSdi = higher(peakSdi, student.peakSdi());
		}
		return new AnalyticsTotals(students.size(), sessionCount, runCount, sessionSeconds, breakerTriggerCount,
				reflectionCount, peakSdi);
	}

	private static Integer higher(Integer current, Integer candidate) {
		if (candidate == null) {
			return current;
		}
		return (current == null || candidate > current) ? candidate : current;
	}

	private static Instant later(Instant current, Instant candidate) {
		return (current == null || candidate.isAfter(current)) ? candidate : current;
	}
}

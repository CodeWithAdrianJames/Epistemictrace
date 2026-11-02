package com.episteme.epistemictrace.analytics;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.telemetry.EventType;

/**
 * Read queries for instructor analytics (spec 29 R10). Each takes the activities to cover, so one activity (R1) and
 * all activities of one instructor (R5) use the same five queries, and the number of queries does not grow with the
 * number of students.
 */
public interface AnalyticsRepository extends Repository<CodingSession, Long> {

	/** Every session of the given activities. */
	@Query("""
			select new com.episteme.epistemictrace.analytics.AnalyticsSessionRow(s.id, s.activityId, s.studentId,
				s.startedAt, s.endedAt, s.peakSdi, s.runnerLocked)
			from CodingSession s
			where s.activityId in :activityIds
			order by s.id""")
	List<AnalyticsSessionRow> findSessionRows(@Param("activityIds") Collection<Long> activityIds);

	/** RUN count and latest event time per session of the given activities; sessions without events are absent. */
	@Query("""
			select new com.episteme.epistemictrace.analytics.SessionEventTotals(e.sessionId,
				count(case when e.type = :run then 1 end), max(e.occurredAt))
			from TelemetryEvent e
			where e.sessionId in (select s.id from CodingSession s where s.activityId in :activityIds)
			group by e.sessionId""")
	List<SessionEventTotals> countEvents(@Param("activityIds") Collection<Long> activityIds,
			@Param("run") EventType run);

	/** Reflection count per session of the given activities; sessions without reflections are absent. */
	@Query("""
			select new com.episteme.epistemictrace.analytics.SessionReflectionCount(r.sessionId, count(r))
			from Reflection r
			where r.sessionId in (select s.id from CodingSession s where s.activityId in :activityIds)
			group by r.sessionId""")
	List<SessionReflectionCount> countReflections(@Param("activityIds") Collection<Long> activityIds);

	/** Name and email of the given users. */
	@Query("""
			select new com.episteme.epistemictrace.analytics.StudentIdentity(u.id, u.name, u.email)
			from User u
			where u.id in :studentIds""")
	List<StudentIdentity> findStudentIdentities(@Param("studentIds") Collection<Long> studentIds);

	/** The SDI threshold of each given activity. */
	@Query("""
			select new com.episteme.epistemictrace.analytics.ActivityThreshold(c.activityId, c.threshold)
			from SdiConfig c
			where c.activityId in :activityIds""")
	List<ActivityThreshold> findThresholds(@Param("activityIds") Collection<Long> activityIds);
}

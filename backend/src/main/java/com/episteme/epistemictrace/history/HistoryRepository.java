package com.episteme.epistemictrace.history;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.telemetry.EventType;

/** Read queries for the student's session history (spec 26 R4): one page query and one count query per page. */
public interface HistoryRepository extends Repository<CodingSession, Long> {

	/** A page of the student's sessions with their activity title, newest {@code started_at} first. */
	@Query(value = """
			select new com.episteme.epistemictrace.history.SessionRow(s.id, s.activityId, a.title, s.startedAt, s.endedAt)
			from CodingSession s join Activity a on a.id = s.activityId
			where s.studentId = :studentId
			order by s.startedAt desc, s.id desc""",
			countQuery = "select count(s) from CodingSession s where s.studentId = :studentId")
	Page<SessionRow> findSessionRows(@Param("studentId") Long studentId, Pageable pageable);

	/** One session with its activity title, or nothing when the id is unknown. */
	@Query("""
			select new com.episteme.epistemictrace.history.SessionRow(s.id, s.activityId, a.title, s.startedAt, s.endedAt)
			from CodingSession s join Activity a on a.id = s.activityId
			where s.id = :sessionId""")
	List<SessionRow> findSessionRow(@Param("sessionId") Long sessionId);

	/** RUN event and reflection counts of the given sessions, in one query. */
	@Query("""
			select new com.episteme.epistemictrace.history.SessionCounts(s.id,
				(select count(e) from TelemetryEvent e where e.sessionId = s.id and e.type = :run),
				(select count(r) from Reflection r where r.sessionId = s.id))
			from CodingSession s
			where s.id in :sessionIds""")
	List<SessionCounts> countRunsAndReflections(@Param("sessionIds") Collection<Long> sessionIds,
			@Param("run") EventType run);

	/** The session's reflections, oldest first; never the SDI at trigger (spec 26 R3). */
	@Query("""
			select new com.episteme.epistemictrace.history.ReflectionEntry(r.hypothesis, r.plannedFix, r.submittedAt)
			from Reflection r
			where r.sessionId = :sessionId
			order by r.submittedAt, r.id""")
	List<ReflectionEntry> findReflections(@Param("sessionId") Long sessionId);

}

package com.episteme.epistemictrace.session;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CodingSessionRepository extends JpaRepository<CodingSession, Long> {

	/** The student's latest session for the activity by {@code started_at}; equal start times fall back to the id. */
	Optional<CodingSession> findFirstByStudentIdAndActivityIdOrderByStartedAtDescIdDesc(long studentId,
			long activityId);

}

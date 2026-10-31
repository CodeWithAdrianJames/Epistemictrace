package com.episteme.epistemictrace.session;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CodingSessionRepository extends JpaRepository<CodingSession, Long> {

	/** The student's latest session for the activity by {@code started_at}; equal start times fall back to the id. */
	Optional<CodingSession> findFirstByStudentIdAndActivityIdOrderByStartedAtDescIdDesc(long studentId,
			long activityId);

	/** The session with its row locked until the transaction ends (spec 24 R6: one reflection per lock). */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from CodingSession s where s.id = :id")
	Optional<CodingSession> findByIdForUpdate(@Param("id") long id);

}

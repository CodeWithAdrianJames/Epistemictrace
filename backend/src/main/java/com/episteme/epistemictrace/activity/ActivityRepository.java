package com.episteme.epistemictrace.activity;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

	List<Activity> findByInstructorIdOrderByUpdatedAtDesc(Long instructorId);

	List<Activity> findByStatusOrderByTitleAsc(ActivityStatus status);

	/** The activity with its test cases fetched in the same query, so they can be read after the transaction. */
	@EntityGraph(attributePaths = "testCases")
	Optional<Activity> findWithTestCasesById(Long id);

	/**
	 * The activity with its row locked until the transaction ends ({@code select ... for update}). Test cases are not
	 * fetched here: PostgreSQL rejects {@code for update} on the nullable side of the outer join an entity graph adds.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select a from Activity a where a.id = :id")
	Optional<Activity> findLockedById(@Param("id") Long id);

	/** Summaries of one instructor's activities, most recently updated first; ties by id, newest first. */
	@Query("""
			select new com.episteme.epistemictrace.activity.ActivitySummary(
				a.id, a.title, a.status, size(a.testCases), a.updatedAt)
			from Activity a
			where a.instructorId = :instructorId
			order by a.updatedAt desc, a.id desc""")
	List<ActivitySummary> findSummariesByInstructorId(@Param("instructorId") Long instructorId);

}

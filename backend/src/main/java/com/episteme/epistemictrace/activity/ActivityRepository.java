package com.episteme.epistemictrace.activity;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

	List<Activity> findByInstructorIdOrderByUpdatedAtDesc(Long instructorId);

	List<Activity> findByStatusOrderByTitleAsc(ActivityStatus status);

}

package com.episteme.epistemictrace.activity;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SdiConfigRepository extends JpaRepository<SdiConfig, Long> {

	Optional<SdiConfig> findByActivityId(Long activityId);

}

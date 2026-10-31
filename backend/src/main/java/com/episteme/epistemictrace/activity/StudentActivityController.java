package com.episteme.epistemictrace.activity;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Student activity endpoints (spec 08 R4). Role {@code STUDENT} is enforced by {@code SecurityConfig}; every student
 * sees every published activity, so no user id is needed.
 */
@RestController
@RequestMapping("/api/activities")
public class StudentActivityController {

	private final ActivityService activityService;

	public StudentActivityController(ActivityService activityService) {
		this.activityService = activityService;
	}

	@GetMapping
	public List<ActivitySummary> list() {
		return this.activityService.listPublished();
	}

	@GetMapping("/{id}")
	public ActivityDetail get(@PathVariable long id) {
		return ActivityDetail.from(this.activityService.getPublished(id));
	}

}

package com.episteme.epistemictrace.activity;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/** Instructor activity endpoints (spec 08 R3). Role {@code INSTRUCTOR} is enforced by {@code SecurityConfig}. */
@RestController
@RequestMapping("/api/instructor/activities")
public class InstructorActivityController {

	private final ActivityService activityService;

	private final CurrentUser currentUser;

	public InstructorActivityController(ActivityService activityService, CurrentUser currentUser) {
		this.activityService = activityService;
		this.currentUser = currentUser;
	}

	@GetMapping
	public List<ActivitySummary> list() {
		return this.activityService.listForInstructor(this.currentUser.id());
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ActivityDetail create(@Valid @RequestBody ActivityRequest request) {
		Activity activity = this.activityService.create(this.currentUser.id(), request.title(),
				request.problemStatement(), request.starterCode());
		return ActivityDetail.from(activity);
	}

	@GetMapping("/{id}")
	public ActivityDetail get(@PathVariable long id) {
		return ActivityDetail.from(this.activityService.getForInstructor(this.currentUser.id(), id));
	}

	@PutMapping("/{id}")
	public ActivityDetail update(@PathVariable long id, @Valid @RequestBody ActivityRequest request) {
		Activity activity = this.activityService.update(this.currentUser.id(), id, request.title(),
				request.problemStatement(), request.starterCode());
		return ActivityDetail.from(activity);
	}

	@PostMapping("/{id}/publish")
	public ActivityDetail publish(@PathVariable long id) {
		return ActivityDetail.from(this.activityService.publish(this.currentUser.id(), id));
	}

	@PostMapping("/{id}/archive")
	public ActivityDetail archive(@PathVariable long id) {
		return ActivityDetail.from(this.activityService.archive(this.currentUser.id(), id));
	}

}

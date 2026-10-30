package com.episteme.epistemictrace.activity;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Activity rules (spec 08 R3, R5). Every method takes the caller's user id from the controller; an activity that
 * exists but belongs to another instructor is an {@link AccessDeniedException} ({@code 403}), a missing one is an
 * {@link ActivityNotFoundException} ({@code 404}).
 */
@Service
@EnableConfigurationProperties(SdiDefaultsProperties.class)
public class ActivityService {

	static final String ARCHIVED_DETAIL = "Archived activities can't be changed.";

	private final ActivityRepository activityRepository;

	private final SdiConfigRepository sdiConfigRepository;

	private final SdiDefaultsProperties sdiDefaults;

	public ActivityService(ActivityRepository activityRepository, SdiConfigRepository sdiConfigRepository,
			SdiDefaultsProperties sdiDefaults) {
		this.activityRepository = activityRepository;
		this.sdiConfigRepository = sdiConfigRepository;
		this.sdiDefaults = sdiDefaults;
	}

	/** The instructor's activities in every status, most recently updated first. */
	public List<ActivitySummary> listForInstructor(long instructorId) {
		return this.activityRepository.findSummariesByInstructorId(instructorId);
	}

	/** Creates a {@link ActivityStatus#DRAFT} activity and its {@code sdi_configs} row from the configured defaults. */
	@Transactional
	public Activity create(long instructorId, String title, String problemStatement, String starterCode) {
		Activity activity = this.activityRepository
			.save(new Activity(instructorId, title.strip(), problemStatement, starterCode, ActivityStatus.DRAFT));
		this.sdiConfigRepository.save(new SdiConfig(activity.getId(), this.sdiDefaults.threshold(),
				this.sdiDefaults.cooldownSeconds(), this.sdiDefaults.windowMinutes()));
		return activity;
	}

	/** The instructor's own activity with its test cases loaded. */
	public Activity getForInstructor(long instructorId, long activityId) {
		return ownedActivity(instructorId, activityId);
	}

	/**
	 * Replaces title, problem statement and starter code; the status and test cases stay as they are.
	 * @throws ActivityConflictException if the activity is {@link ActivityStatus#ARCHIVED}
	 */
	@Transactional
	public Activity update(long instructorId, long activityId, String title, String problemStatement,
			String starterCode) {
		Activity activity = ownedActivity(instructorId, activityId);
		if (activity.getStatus() == ActivityStatus.ARCHIVED) {
			throw new ActivityConflictException(ARCHIVED_DETAIL);
		}
		activity.edit(title.strip(), problemStatement, starterCode);
		return activity;
	}

	private Activity ownedActivity(long instructorId, long activityId) {
		Activity activity = this.activityRepository.findWithTestCasesById(activityId)
			.orElseThrow(ActivityNotFoundException::new);
		if (activity.getInstructorId() != instructorId) {
			throw new AccessDeniedException("Activity " + activityId + " belongs to another instructor.");
		}
		return activity;
	}

}

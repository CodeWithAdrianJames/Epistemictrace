package com.episteme.epistemictrace.activity;

import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Activity rules (spec 08 R3–R5). Every instructor method takes the caller's user id from the controller; an activity
 * that exists but belongs to another instructor is an {@link AccessDeniedException} ({@code 403}), a missing one is an
 * {@link ActivityNotFoundException} ({@code 404}). Student reads see {@link ActivityStatus#PUBLISHED} activities only.
 */
@Service
@EnableConfigurationProperties(SdiDefaultsProperties.class)
public class ActivityService {

	static final String ARCHIVED_DETAIL = "Archived activities can't be changed.";

	static final String ALREADY_PUBLISHED_DETAIL = "This activity is already published.";

	static final String NO_TEST_CASES_DETAIL = "Add at least one test case before publishing.";

	static final String ALREADY_ARCHIVED_DETAIL = "This activity is already archived.";

	static final String LAST_TEST_CASE_DETAIL = "A published activity needs at least one test case.";

	/** Q16: at most 50 test cases per activity. */
	static final int MAX_TEST_CASES = 50;

	private final ActivityRepository activityRepository;

	private final TestCaseRepository testCaseRepository;

	private final SdiConfigRepository sdiConfigRepository;

	private final SdiDefaultsProperties sdiDefaults;

	public ActivityService(ActivityRepository activityRepository, TestCaseRepository testCaseRepository,
			SdiConfigRepository sdiConfigRepository, SdiDefaultsProperties sdiDefaults) {
		this.activityRepository = activityRepository;
		this.testCaseRepository = testCaseRepository;
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
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		requireNotArchived(activity);
		activity.edit(title.strip(), problemStatement, starterCode);
		return activity;
	}

	/**
	 * Moves a {@link ActivityStatus#DRAFT} activity with at least one test case to {@link ActivityStatus#PUBLISHED}.
	 * @throws ActivityConflictException if the activity is not a draft or has no test cases
	 */
	@Transactional
	public Activity publish(long instructorId, long activityId) {
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		switch (activity.getStatus()) {
			case PUBLISHED -> throw new ActivityConflictException(ALREADY_PUBLISHED_DETAIL);
			case ARCHIVED -> throw new ActivityConflictException(ARCHIVED_DETAIL);
			case DRAFT -> {
				if (activity.getTestCases().isEmpty()) {
					throw new ActivityConflictException(NO_TEST_CASES_DETAIL);
				}
			}
		}
		activity.changeStatus(ActivityStatus.PUBLISHED);
		return activity;
	}

	/**
	 * Moves a {@link ActivityStatus#DRAFT} or {@link ActivityStatus#PUBLISHED} activity to
	 * {@link ActivityStatus#ARCHIVED}; there is no way back in the MVP.
	 * @throws ActivityConflictException if the activity is already archived
	 */
	@Transactional
	public Activity archive(long instructorId, long activityId) {
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		if (activity.getStatus() == ActivityStatus.ARCHIVED) {
			throw new ActivityConflictException(ALREADY_ARCHIVED_DETAIL);
		}
		activity.changeStatus(ActivityStatus.ARCHIVED);
		return activity;
	}

	/** The instructor's own activity's test cases in position order, in every status. */
	public List<TestCase> listTestCases(long instructorId, long activityId) {
		return ownedActivity(instructorId, activityId).getTestCases();
	}

	/**
	 * Adds a test case after the last one ({@code position} = current max + 1).
	 * @throws ActivityConflictException if the activity is {@link ActivityStatus#ARCHIVED}
	 * @throws TestCaseLimitException if the activity already has {@link #MAX_TEST_CASES} test cases
	 */
	@Transactional
	public TestCase addTestCase(long instructorId, long activityId, String input, String expectedOutput,
			boolean hidden) {
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		requireNotArchived(activity);
		List<TestCase> testCases = activity.getTestCases();
		if (testCases.size() >= MAX_TEST_CASES) {
			throw new TestCaseLimitException(MAX_TEST_CASES);
		}
		int position = testCases.stream().mapToInt(TestCase::getPosition).max().orElse(0) + 1;
		TestCase testCase = new TestCase(position, input, expectedOutput, hidden);
		activity.addTestCase(testCase);
		activity.touch();
		return this.testCaseRepository.save(testCase);
	}

	/**
	 * Replaces input, expected output and hidden flag; the position stays as it is.
	 * @throws ActivityConflictException if the activity is {@link ActivityStatus#ARCHIVED}
	 * @throws TestCaseNotFoundException if the test case does not belong to this activity
	 */
	@Transactional
	public TestCase updateTestCase(long instructorId, long activityId, long testCaseId, String input,
			String expectedOutput, boolean hidden) {
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		requireNotArchived(activity);
		TestCase testCase = testCaseOf(activity, testCaseId);
		testCase.edit(input, expectedOutput, hidden);
		activity.touch();
		return testCase;
	}

	/**
	 * Deletes a test case and renumbers the remaining ones 1..n in their current order.
	 * @throws ActivityConflictException if the activity is {@link ActivityStatus#ARCHIVED}, or
	 * {@link ActivityStatus#PUBLISHED} and this is its last test case
	 * @throws TestCaseNotFoundException if the test case does not belong to this activity
	 */
	@Transactional
	public void deleteTestCase(long instructorId, long activityId, long testCaseId) {
		Activity activity = lockedOwnedActivity(instructorId, activityId);
		requireNotArchived(activity);
		TestCase testCase = testCaseOf(activity, testCaseId);
		if (activity.getStatus() == ActivityStatus.PUBLISHED && activity.getTestCases().size() == 1) {
			throw new ActivityConflictException(LAST_TEST_CASE_DETAIL);
		}
		activity.removeTestCase(testCase);
		// uk_test_cases_activity_position is checked row by row in PostgreSQL, so each move is flushed on its own:
		// the deleted row frees its position first, then every later row moves down into the position just freed.
		this.testCaseRepository.flush();
		int position = 1;
		for (TestCase remaining : activity.getTestCases()) {
			if (remaining.getPosition() != position) {
				remaining.moveTo(position);
				this.testCaseRepository.flush();
			}
			position++;
		}
		activity.touch();
	}

	/** Every {@link ActivityStatus#PUBLISHED} activity, by title (spec 08 R4); students see no other status. */
	public List<ActivitySummary> listPublished() {
		return this.activityRepository.findSummariesByStatus(ActivityStatus.PUBLISHED);
	}

	/**
	 * A {@link ActivityStatus#PUBLISHED} activity with every test case, hidden ones included: the student's browser
	 * runs them (spec 08 R4, Q8).
	 * @throws ActivityNotFoundException if the activity is missing, a draft or archived, so students cannot tell an
	 * unpublished activity from a missing one
	 */
	public Activity getPublished(long activityId) {
		return this.activityRepository.findWithTestCasesById(activityId)
			.filter(activity -> activity.getStatus() == ActivityStatus.PUBLISHED)
			.orElseThrow(ActivityNotFoundException::new);
	}

	private Activity ownedActivity(long instructorId, long activityId) {
		Activity activity = this.activityRepository.findWithTestCasesById(activityId)
			.orElseThrow(ActivityNotFoundException::new);
		requireOwner(instructorId, activity);
		return activity;
	}

	/**
	 * Like {@link #ownedActivity}, but the activity row stays locked until the transaction ends, so changes to one
	 * activity run one after another. Without it, a publish and a delete of the last test case running at the same
	 * time could each pass their own check and leave a published activity with no test cases; two adds could pick the
	 * same position; and a stale status could be written back over a concurrent publish or archive.
	 */
	private Activity lockedOwnedActivity(long instructorId, long activityId) {
		Activity activity = this.activityRepository.findLockedById(activityId)
			.orElseThrow(ActivityNotFoundException::new);
		requireOwner(instructorId, activity);
		// Loads the lazy test cases now: callers read them after the transaction (open-in-view is off).
		activity.getTestCases().size();
		return activity;
	}

	private static void requireOwner(long instructorId, Activity activity) {
		if (activity.getInstructorId() != instructorId) {
			throw new AccessDeniedException("Activity " + activity.getId() + " belongs to another instructor.");
		}
	}

	private static void requireNotArchived(Activity activity) {
		if (activity.getStatus() == ActivityStatus.ARCHIVED) {
			throw new ActivityConflictException(ARCHIVED_DETAIL);
		}
	}

	private static TestCase testCaseOf(Activity activity, long testCaseId) {
		return activity.getTestCases()
			.stream()
			.filter(testCase -> testCase.getId() == testCaseId)
			.findFirst()
			.orElseThrow(TestCaseNotFoundException::new);
	}

}

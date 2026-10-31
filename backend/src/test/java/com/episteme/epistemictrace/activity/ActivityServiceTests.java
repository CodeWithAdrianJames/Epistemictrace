package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;

import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Spec 08 Parts 1–4 service rules against the H2 database. The SDI defaults differ from {@code application.properties}
 * to show that the new {@code sdi_configs} row comes from configuration.
 */
@SpringBootTest(properties = { "epistemictrace.sdi.defaults.threshold=65",
		"epistemictrace.sdi.defaults.cooldown-seconds=90", "epistemictrace.sdi.defaults.window-minutes=7" })
@ActiveProfiles("test")
class ActivityServiceTests {

	private static final Instant PAST = Instant.parse("2026-10-01T08:00:00Z");

	@Autowired
	private ActivityService activityService;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private TestCaseRepository testCaseRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PlatformTransactionManager transactionManager;

	private long instructorId;

	private long otherInstructorId;

	@BeforeEach
	void createInstructors() {
		this.instructorId = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR))
			.getId();
		this.otherInstructorId = this.userRepository
			.save(new User("Instructor Two", "instructor2@example.test", "not-a-real-hash", Role.INSTRUCTOR))
			.getId();
	}

	@AfterEach
	void deleteData() {
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void createStoresTrimmedDraftAndOneSdiConfigFromConfiguration() {
		Activity activity = this.activityService.create(this.instructorId, " Loops ", "Print 1 to 5.", "");

		assertThat(activity.getId()).isNotNull();
		assertThat(activity.getTitle()).isEqualTo("Loops");
		assertThat(activity.getStatus()).isEqualTo(ActivityStatus.DRAFT);
		assertThat(activity.getCreatedAt()).isNotNull();
		assertThat(activity.getUpdatedAt()).isEqualTo(activity.getCreatedAt());
		assertThat(this.sdiConfigRepository.findAll()).singleElement().satisfies(config -> {
			assertThat(config.getActivityId()).isEqualTo(activity.getId());
			assertThat(config.getThreshold()).isEqualTo(65);
			assertThat(config.getCooldownSeconds()).isEqualTo(90);
			assertThat(config.getWindowMinutes()).isEqualTo(7);
		});
	}

	@Test
	void updateChangesUpdatedAt() {
		Activity activity = this.activityService.create(this.instructorId, "Loops", "Print 1 to 5.", "");
		setUpdatedAt(activity.getId(), PAST);

		Activity updated = this.activityService.update(this.instructorId, activity.getId(), "Loops 2",
				"Print 1 to 10.", "for i in range(10):\n");

		assertThat(updated.getUpdatedAt()).isAfter(PAST);
		Activity reloaded = this.activityRepository.findById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTitle()).isEqualTo("Loops 2");
		assertThat(reloaded.getProblemStatement()).isEqualTo("Print 1 to 10.");
		assertThat(reloaded.getStarterCode()).isEqualTo("for i in range(10):\n");
		assertThat(reloaded.getUpdatedAt()).isAfter(PAST);
	}

	@Test
	void updateWithUnchangedValuesStillChangesUpdatedAt() {
		Activity activity = this.activityService.create(this.instructorId, "Loops", "Print 1 to 5.", "");
		setUpdatedAt(activity.getId(), PAST);

		this.activityService.update(this.instructorId, activity.getId(), "Loops", "Print 1 to 5.", "");

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getUpdatedAt()).isAfter(PAST);
	}

	@Test
	void updateKeepsStatusAndTestCases() {
		Activity activity = new Activity(this.instructorId, "Sum", "Print a + b.", "", ActivityStatus.PUBLISHED);
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		activity = this.activityRepository.save(activity);

		Activity updated = this.activityService.update(this.instructorId, activity.getId(), "Sum", "Print a+b.", "");

		assertThat(updated.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(updated.getTestCases()).extracting(TestCase::getExpectedOutput).containsExactly("3\n");
	}

	@Test
	void updateArchivedActivityIsAConflict() {
		Activity activity = this.activityRepository
			.save(new Activity(this.instructorId, "Old", "Statement.", "", ActivityStatus.ARCHIVED));
		setUpdatedAt(activity.getId(), PAST);
		long activityId = activity.getId();

		assertThatThrownBy(() -> this.activityService.update(this.instructorId, activityId, "New", "New.", ""))
			.isInstanceOfSatisfying(ActivityConflictException.class, ex -> {
				assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
				assertThat(ex.getBody().getDetail()).isEqualTo(ActivityService.ARCHIVED_DETAIL);
			});

		Activity reloaded = this.activityRepository.findById(activityId).orElseThrow();
		assertThat(reloaded.getTitle()).isEqualTo("Old");
		assertThat(reloaded.getUpdatedAt()).isEqualTo(PAST);
	}

	@Test
	void anotherInstructorsActivityIsAccessDenied() {
		long activityId = this.activityService.create(this.instructorId, "Mine", "Statement.", "").getId();

		assertThatThrownBy(() -> this.activityService.getForInstructor(this.otherInstructorId, activityId))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.update(this.otherInstructorId, activityId, "X", "X.", ""))
			.isInstanceOf(AccessDeniedException.class);
		assertThat(this.activityRepository.findById(activityId).orElseThrow().getTitle()).isEqualTo("Mine");
	}

	@Test
	void missingActivityIsNotFound() {
		assertThatThrownBy(() -> this.activityService.getForInstructor(this.instructorId, 999_999L))
			.isInstanceOfSatisfying(ActivityNotFoundException.class,
					ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
		assertThatThrownBy(() -> this.activityService.update(this.instructorId, 999_999L, "X", "X.", ""))
			.isInstanceOf(ActivityNotFoundException.class);
	}

	@Test
	void listOrdersEqualUpdatedAtByNewestId() {
		long first = this.activityService.create(this.instructorId, "First", "Statement.", "").getId();
		long second = this.activityService.create(this.instructorId, "Second", "Statement.", "").getId();
		this.activityService.create(this.otherInstructorId, "Other", "Statement.", "");
		setUpdatedAt(first, PAST);
		setUpdatedAt(second, PAST);

		assertThat(this.activityService.listForInstructor(this.instructorId)).extracting(ActivitySummary::id)
			.containsExactly(second, first);
	}

	@Test
	void publishDraftWithTestCaseChangesStatusAndUpdatedAt() {
		long activityId = saveActivity(ActivityStatus.DRAFT, 1).getId();
		setUpdatedAt(activityId, PAST);

		Activity published = this.activityService.publish(this.instructorId, activityId);

		assertThat(published.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(published.getTestCases()).hasSize(1);
		Activity reloaded = this.activityRepository.findById(activityId).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(reloaded.getUpdatedAt()).isAfter(PAST);
	}

	@Test
	void publishIsAConflictUnlessDraftWithTestCases() {
		long emptyDraft = saveActivity(ActivityStatus.DRAFT, 0).getId();
		long published = saveActivity(ActivityStatus.PUBLISHED, 1).getId();
		long archived = saveActivity(ActivityStatus.ARCHIVED, 1).getId();
		setUpdatedAt(emptyDraft, PAST);
		setUpdatedAt(published, PAST);
		setUpdatedAt(archived, PAST);

		assertConflict(() -> this.activityService.publish(this.instructorId, emptyDraft),
				ActivityService.NO_TEST_CASES_DETAIL);
		assertConflict(() -> this.activityService.publish(this.instructorId, published),
				ActivityService.ALREADY_PUBLISHED_DETAIL);
		assertConflict(() -> this.activityService.publish(this.instructorId, archived),
				ActivityService.ARCHIVED_DETAIL);

		assertStatusAndUpdatedAt(emptyDraft, ActivityStatus.DRAFT);
		assertStatusAndUpdatedAt(published, ActivityStatus.PUBLISHED);
		assertStatusAndUpdatedAt(archived, ActivityStatus.ARCHIVED);
	}

	@Test
	void archiveFromDraftOrPublishedChangesStatusAndUpdatedAt() {
		long draft = saveActivity(ActivityStatus.DRAFT, 0).getId();
		long published = saveActivity(ActivityStatus.PUBLISHED, 2).getId();
		setUpdatedAt(draft, PAST);
		setUpdatedAt(published, PAST);

		assertThat(this.activityService.archive(this.instructorId, draft).getStatus())
			.isEqualTo(ActivityStatus.ARCHIVED);
		Activity archivedPublished = this.activityService.archive(this.instructorId, published);
		assertThat(archivedPublished.getStatus()).isEqualTo(ActivityStatus.ARCHIVED);
		assertThat(archivedPublished.getTestCases()).hasSize(2);

		for (long activityId : new long[] { draft, published }) {
			Activity reloaded = this.activityRepository.findById(activityId).orElseThrow();
			assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.ARCHIVED);
			assertThat(reloaded.getUpdatedAt()).isAfter(PAST);
		}
	}

	@Test
	void archiveAlreadyArchivedActivityIsAConflict() {
		long activityId = saveActivity(ActivityStatus.ARCHIVED, 0).getId();
		setUpdatedAt(activityId, PAST);

		assertConflict(() -> this.activityService.archive(this.instructorId, activityId),
				ActivityService.ALREADY_ARCHIVED_DETAIL);

		assertStatusAndUpdatedAt(activityId, ActivityStatus.ARCHIVED);
	}

	@Test
	void publishAndArchiveCheckOwnershipAndExistence() {
		long activityId = saveActivity(ActivityStatus.DRAFT, 1).getId();
		setUpdatedAt(activityId, PAST);

		assertThatThrownBy(() -> this.activityService.publish(this.otherInstructorId, activityId))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.archive(this.otherInstructorId, activityId))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.publish(this.instructorId, 999_999L))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.archive(this.instructorId, 999_999L))
			.isInstanceOf(ActivityNotFoundException.class);

		assertStatusAndUpdatedAt(activityId, ActivityStatus.DRAFT);
	}

	@Test
	void addTestCaseAppendsAtMaxPositionPlusOneAndChangesUpdatedAt() {
		long activityId = saveActivity(ActivityStatus.DRAFT, 2).getId();
		setUpdatedAt(activityId, PAST);

		TestCase added = this.activityService.addTestCase(this.instructorId, activityId, "1 1\n", "2\n", true);

		assertThat(added.getId()).isNotNull();
		assertThat(added.getPosition()).isEqualTo(3);
		Activity reloaded = this.activityRepository.findWithTestCasesById(activityId).orElseThrow();
		assertThat(reloaded.getTestCases()).extracting(TestCase::getPosition).containsExactly(1, 2, 3);
		assertThat(reloaded.getTestCases().get(2).getId()).isEqualTo(added.getId());
		assertThat(reloaded.getTestCases().get(2).isHidden()).isTrue();
		assertThat(reloaded.getUpdatedAt()).isAfter(PAST);
	}

	@Test
	void addTestCaseStopsAtFiftyTestCases() {
		long activityId = saveActivity(ActivityStatus.DRAFT, 49).getId();

		assertThat(this.activityService.addTestCase(this.instructorId, activityId, "", "50\n", false).getPosition())
			.isEqualTo(50);
		setUpdatedAt(activityId, PAST);

		assertThatThrownBy(() -> this.activityService.addTestCase(this.instructorId, activityId, "", "51\n", false))
			.isInstanceOfSatisfying(TestCaseLimitException.class, ex -> {
				assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
				assertThat(ex.getBody().getProperties()).containsEntry("errors",
						Map.of("testCases", "An activity can have at most 50 test cases."));
			});
		Activity reloaded = this.activityRepository.findWithTestCasesById(activityId).orElseThrow();
		assertThat(reloaded.getTestCases()).hasSize(50);
		assertThat(reloaded.getUpdatedAt()).isEqualTo(PAST);
	}

	@Test
	void updateTestCaseKeepsPositionAndChangesUpdatedAt() {
		Activity activity = saveActivity(ActivityStatus.PUBLISHED, 2);
		long activityId = activity.getId();
		long testCaseId = activity.getTestCases().get(0).getId();
		setUpdatedAt(activityId, PAST);

		TestCase updated = this.activityService.updateTestCase(this.instructorId, activityId, testCaseId, "7\n",
				"49\n", true);

		assertThat(updated.getPosition()).isEqualTo(1);
		Activity reloaded = this.activityRepository.findWithTestCasesById(activityId).orElseThrow();
		assertThat(reloaded.getTestCases().get(0)).satisfies(testCase -> {
			assertThat(testCase.getId()).isEqualTo(testCaseId);
			assertThat(testCase.getPosition()).isEqualTo(1);
			assertThat(testCase.getInput()).isEqualTo("7\n");
			assertThat(testCase.getExpectedOutput()).isEqualTo("49\n");
			assertThat(testCase.isHidden()).isTrue();
		});
		assertThat(reloaded.getUpdatedAt()).isAfter(PAST);
	}

	@Test
	void deleteRenumbersRemainingPositionsInOrder() {
		Activity activity = saveActivity(ActivityStatus.DRAFT, 5);
		long activityId = activity.getId();
		setUpdatedAt(activityId, PAST);

		this.activityService.deleteTestCase(this.instructorId, activityId, activity.getTestCases().get(0).getId());
		assertPositionsAndOutputs(activityId, "out 2\n", "out 3\n", "out 4\n", "out 5\n");
		assertThat(this.activityRepository.findById(activityId).orElseThrow().getUpdatedAt()).isAfter(PAST);

		this.activityService.deleteTestCase(this.instructorId, activityId, activity.getTestCases().get(2).getId());
		assertPositionsAndOutputs(activityId, "out 2\n", "out 4\n", "out 5\n");

		this.activityService.deleteTestCase(this.instructorId, activityId, activity.getTestCases().get(4).getId());
		assertPositionsAndOutputs(activityId, "out 2\n", "out 4\n");
	}

	@Test
	void deleteLastTestCaseOfPublishedActivityIsAConflictButOfDraftIsAllowed() {
		Activity published = saveActivity(ActivityStatus.PUBLISHED, 1);
		Activity draft = saveActivity(ActivityStatus.DRAFT, 1);
		long publishedTestCaseId = published.getTestCases().get(0).getId();
		setUpdatedAt(published.getId(), PAST);

		assertConflict(() -> this.activityService.deleteTestCase(this.instructorId, published.getId(),
				publishedTestCaseId), ActivityService.LAST_TEST_CASE_DETAIL);
		this.activityService.deleteTestCase(this.instructorId, draft.getId(), draft.getTestCases().get(0).getId());

		assertThat(this.activityRepository.findWithTestCasesById(published.getId()).orElseThrow().getTestCases())
			.hasSize(1);
		assertStatusAndUpdatedAt(published.getId(), ActivityStatus.PUBLISHED);
		assertThat(this.activityRepository.findWithTestCasesById(draft.getId()).orElseThrow().getTestCases())
			.isEmpty();
	}

	@Test
	void testCaseChangesOnArchivedActivityAreConflicts() {
		Activity activity = saveActivity(ActivityStatus.ARCHIVED, 2);
		long activityId = activity.getId();
		long testCaseId = activity.getTestCases().get(0).getId();
		setUpdatedAt(activityId, PAST);

		assertConflict(() -> this.activityService.addTestCase(this.instructorId, activityId, "", "x\n", false),
				ActivityService.ARCHIVED_DETAIL);
		assertConflict(() -> this.activityService.updateTestCase(this.instructorId, activityId, testCaseId, "",
				"x\n", false), ActivityService.ARCHIVED_DETAIL);
		assertConflict(() -> this.activityService.deleteTestCase(this.instructorId, activityId, testCaseId),
				ActivityService.ARCHIVED_DETAIL);

		assertPositionsAndOutputs(activityId, "out 1\n", "out 2\n");
		assertStatusAndUpdatedAt(activityId, ActivityStatus.ARCHIVED);
	}

	@Test
	void testCaseFromAnotherActivityIsNotFound() {
		long activityId = saveActivity(ActivityStatus.DRAFT, 1).getId();
		long foreignTestCaseId = saveActivity(ActivityStatus.DRAFT, 1).getTestCases().get(0).getId();

		assertThatThrownBy(() -> this.activityService.updateTestCase(this.instructorId, activityId,
				foreignTestCaseId, "", "x\n", false))
			.isInstanceOfSatisfying(TestCaseNotFoundException.class,
					ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
		assertThatThrownBy(() -> this.activityService.deleteTestCase(this.instructorId, activityId, foreignTestCaseId))
			.isInstanceOf(TestCaseNotFoundException.class);
		assertThat(this.testCaseRepository.findById(foreignTestCaseId)).isPresent();
	}

	@Test
	void testCaseMethodsCheckOwnershipAndExistence() {
		Activity activity = saveActivity(ActivityStatus.DRAFT, 2);
		long activityId = activity.getId();
		long testCaseId = activity.getTestCases().get(0).getId();
		setUpdatedAt(activityId, PAST);

		assertThatThrownBy(() -> this.activityService.listTestCases(this.otherInstructorId, activityId))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.addTestCase(this.otherInstructorId, activityId, "", "x", false))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.updateTestCase(this.otherInstructorId, activityId, testCaseId,
				"", "x", false))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.deleteTestCase(this.otherInstructorId, activityId, testCaseId))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> this.activityService.listTestCases(this.instructorId, 999_999L))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.addTestCase(this.instructorId, 999_999L, "", "x", false))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.updateTestCase(this.instructorId, 999_999L, testCaseId, "",
				"x", false))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.deleteTestCase(this.instructorId, 999_999L, testCaseId))
			.isInstanceOf(ActivityNotFoundException.class);

		assertPositionsAndOutputs(activityId, "out 1\n", "out 2\n");
		assertStatusAndUpdatedAt(activityId, ActivityStatus.DRAFT);
	}

	@Test
	void listTestCasesReturnsPositionOrder() {
		Activity activity = new Activity(this.instructorId, "Sum", "Statement.", "", ActivityStatus.ARCHIVED);
		activity.addTestCase(new TestCase(2, "", "second\n", true));
		activity.addTestCase(new TestCase(1, "", "first\n", false));
		long activityId = this.activityRepository.save(activity).getId();

		assertThat(this.activityService.listTestCases(this.instructorId, activityId))
			.extracting(TestCase::getExpectedOutput)
			.containsExactly("first\n", "second\n");
	}

	@Test
	void listPublishedReturnsOnlyPublishedOfEveryInstructorByTitleIgnoringCase() {
		long loops = this.activityRepository
			.save(new Activity(this.instructorId, "Loops", "Statement.", "", ActivityStatus.PUBLISHED))
			.getId();
		this.activityRepository
			.save(new Activity(this.instructorId, "A draft", "Statement.", "", ActivityStatus.DRAFT));
		this.activityRepository
			.save(new Activity(this.instructorId, "An archived one", "Statement.", "", ActivityStatus.ARCHIVED));
		long arrays = this.activityRepository
			.save(new Activity(this.otherInstructorId, "arrays", "Statement.", "", ActivityStatus.PUBLISHED))
			.getId();
		long sum = saveActivity(ActivityStatus.PUBLISHED, 2).getId();

		assertThat(this.activityService.listPublished()).extracting(ActivitySummary::id)
			.containsExactly(sum, arrays, loops);
		assertThat(this.activityService.listPublished()).first().satisfies(summary -> {
			assertThat(summary.title()).isEqualTo("Activity");
			assertThat(summary.status()).isEqualTo(ActivityStatus.PUBLISHED);
			assertThat(summary.testCaseCount()).isEqualTo(2);
		});
	}

	@Test
	void getPublishedReturnsTestCasesIncludingHiddenOnes() {
		Activity activity = new Activity(this.otherInstructorId, "Sum", "Statement.", "", ActivityStatus.PUBLISHED);
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		long activityId = this.activityRepository.save(activity).getId();

		// Read outside a transaction: the test cases must already be loaded (open-in-view is off).
		Activity published = this.activityService.getPublished(activityId);

		assertThat(published.getTestCases()).extracting(TestCase::getExpectedOutput).containsExactly("3\n", "7\n");
		assertThat(published.getTestCases()).extracting(TestCase::isHidden).containsExactly(false, true);
	}

	@Test
	void getPublishedTreatsDraftArchivedAndMissingAsNotFound() {
		long draft = saveActivity(ActivityStatus.DRAFT, 1).getId();
		long archived = saveActivity(ActivityStatus.ARCHIVED, 1).getId();

		assertThatThrownBy(() -> this.activityService.getPublished(draft))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.getPublished(archived))
			.isInstanceOf(ActivityNotFoundException.class);
		assertThatThrownBy(() -> this.activityService.getPublished(Long.MAX_VALUE))
			.isInstanceOf(ActivityNotFoundException.class);
	}

	/**
	 * The publish vs. delete race from Part 2: a delete of the last test case holds the activity row lock until its
	 * transaction commits, so a publish started meanwhile waits and then sees no test cases, instead of publishing an
	 * activity that is about to have none.
	 */
	@Test
	void publishWaitsForAConcurrentDeleteOfTheLastTestCase() throws Exception {
		Activity activity = saveActivity(ActivityStatus.DRAFT, 1);
		long activityId = activity.getId();
		long testCaseId = activity.getTestCases().get(0).getId();
		AtomicReference<Future<Activity>> publish = new AtomicReference<>();
		ExecutorService executor = Executors.newSingleThreadExecutor();
		try {
			new TransactionTemplate(this.transactionManager).executeWithoutResult(transaction -> {
				this.activityService.deleteTestCase(this.instructorId, activityId, testCaseId);
				publish.set(executor.submit(() -> this.activityService.publish(this.instructorId, activityId)));
				assertThatThrownBy(() -> publish.get().get(300, TimeUnit.MILLISECONDS))
					.isInstanceOf(TimeoutException.class);
			});

			assertThatThrownBy(() -> publish.get().get(10, TimeUnit.SECONDS)).isInstanceOf(ExecutionException.class)
				.cause()
				.isInstanceOfSatisfying(ActivityConflictException.class, ex -> assertThat(ex.getBody().getDetail())
					.isEqualTo(ActivityService.NO_TEST_CASES_DETAIL));
		}
		finally {
			executor.shutdownNow();
		}

		Activity reloaded = this.activityRepository.findWithTestCasesById(activityId).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.DRAFT);
		assertThat(reloaded.getTestCases()).isEmpty();
	}

	private void assertPositionsAndOutputs(long activityId, String... expectedOutputs) {
		Activity reloaded = this.activityRepository.findWithTestCasesById(activityId).orElseThrow();
		assertThat(reloaded.getTestCases()).extracting(TestCase::getExpectedOutput).containsExactly(expectedOutputs);
		assertThat(reloaded.getTestCases()).extracting(TestCase::getPosition)
			.containsExactlyElementsOf(IntStream.rangeClosed(1, expectedOutputs.length).boxed().toList());
	}

	private Activity saveActivity(ActivityStatus status, int testCaseCount) {
		Activity activity = new Activity(this.instructorId, "Activity", "Statement.", "", status);
		for (int position = 1; position <= testCaseCount; position++) {
			activity.addTestCase(new TestCase(position, "", "out " + position + "\n", false));
		}
		return this.activityRepository.save(activity);
	}

	private void assertConflict(ThrowingCallable call, String detail) {
		assertThatThrownBy(call).isInstanceOfSatisfying(ActivityConflictException.class, ex -> {
			assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
			assertThat(ex.getBody().getDetail()).isEqualTo(detail);
		});
	}

	/** The activity still has {@code status} and the {@link #PAST} timestamp set before the rejected call. */
	private void assertStatusAndUpdatedAt(long activityId, ActivityStatus status) {
		Activity reloaded = this.activityRepository.findById(activityId).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(status);
		assertThat(reloaded.getUpdatedAt()).isEqualTo(PAST);
	}

	private void setUpdatedAt(long activityId, Instant updatedAt) {
		this.jdbcTemplate.update("update activities set updated_at = ? where id = ?", Timestamp.from(updatedAt),
				activityId);
	}

}

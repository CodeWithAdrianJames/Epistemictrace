package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Spec 08 Part 1 service rules against the H2 database. The SDI defaults differ from {@code application.properties}
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
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

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

	private void setUpdatedAt(long activityId, Instant updatedAt) {
		this.jdbcTemplate.update("update activities set updated_at = ? where id = ?", Timestamp.from(updatedAt),
				activityId);
	}

}

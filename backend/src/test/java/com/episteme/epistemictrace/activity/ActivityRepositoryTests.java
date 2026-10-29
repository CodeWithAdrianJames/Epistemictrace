package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;

// Keep the H2 PostgreSQL-mode datasource from application-test.properties so Flyway's migrations run
// and Hibernate validates against them, instead of letting @DataJpaTest swap in a plain embedded database.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class ActivityRepositoryTests {

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private TestCaseRepository testCaseRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	@Autowired
	private TestEntityManager entityManager;

	private Long instructorId;

	@BeforeEach
	void createInstructor() {
		this.instructorId = this.entityManager
			.persistAndGetId(new User("Instructor One", "instructor1@example.test", "fake-hash", Role.INSTRUCTOR),
					Long.class);
	}

	@Test
	void savedActivityReloadsTestCasesOrderedByPosition() {
		Activity activity = newActivity();
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		Long activityId = this.activityRepository.saveAndFlush(activity).getId();
		this.entityManager.clear();

		Activity reloaded = this.activityRepository.findById(activityId).orElseThrow();
		assertThat(reloaded.getInstructorId()).isEqualTo(this.instructorId);
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.DRAFT);
		assertThat(reloaded.getCreatedAt()).isNotNull();
		assertThat(reloaded.getUpdatedAt()).isNotNull();
		assertThat(reloaded.getTestCases()).extracting(TestCase::getPosition).containsExactly(1, 2);
		assertThat(reloaded.getTestCases()).extracting(TestCase::getExpectedOutput).containsExactly("3\n", "7\n");
		assertThat(reloaded.getTestCases()).extracting(TestCase::isHidden).containsExactly(false, true);
	}

	@Test
	void deletingActivityDeletesTestCasesAndSdiConfig() {
		Activity activity = newActivity();
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		Long activityId = this.activityRepository.saveAndFlush(activity).getId();
		this.sdiConfigRepository.saveAndFlush(new SdiConfig(activityId, 70, 120, 5));
		this.entityManager.clear();
		assertThat(this.testCaseRepository.count()).isEqualTo(2);
		assertThat(this.sdiConfigRepository.findByActivityId(activityId)).isPresent();

		this.activityRepository.deleteById(activityId);
		this.entityManager.flush();
		this.entityManager.clear();

		assertThat(this.activityRepository.findById(activityId)).isEmpty();
		assertThat(this.testCaseRepository.count()).isZero();
		assertThat(this.sdiConfigRepository.findByActivityId(activityId)).isEmpty();
	}

	@Test
	void sdiConfigThresholdAbove100Throws() {
		Long activityId = this.activityRepository.saveAndFlush(newActivity()).getId();

		assertThatThrownBy(() -> this.sdiConfigRepository.saveAndFlush(new SdiConfig(activityId, 101, 120, 5)))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	private Activity newActivity() {
		return new Activity(this.instructorId, "Add two numbers", "Read two integers and print their sum.", "",
				ActivityStatus.DRAFT);
	}

}

package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

/**
 * Seeding is off at start-up in the test profile, so each test builds its own seeder against the real database.
 * Start-up seeding is covered by {@link InstructorSeederStartupTests}.
 */
@SpringBootTest
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class InstructorSeederTests {

	private static final String PASSWORD = "instructor-password-1";

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@AfterEach
	void deleteUsers() {
		this.userRepository.deleteAll();
	}

	@Test
	void createsInstructorOnce() {
		InstructorSeedProperties properties = new InstructorSeedProperties("  Instructor1@Example.TEST ", PASSWORD,
				"  Instructor One  ");

		seeder(properties).run(new DefaultApplicationArguments());
		Long id = this.userRepository.findByEmail("instructor1@example.test").orElseThrow().getId();
		seeder(properties).run(new DefaultApplicationArguments());
		// A restart builds a new seeder with the same values.
		seeder(properties).run(new DefaultApplicationArguments());

		assertThat(this.userRepository.count()).isEqualTo(1);
		assertThat(this.userRepository.findByEmail("instructor1@example.test")).hasValueSatisfying(user -> {
			assertThat(user.getId()).isEqualTo(id);
			assertThat(user.getName()).isEqualTo("Instructor One");
			assertThat(user.getRole()).isEqualTo(Role.INSTRUCTOR);
			assertThat(user.getConsentAcceptedAt()).isNull();
			assertThat(user.getPasswordHash()).isNotEqualTo(PASSWORD).startsWith("$2a$10$");
			assertThat(this.passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
		});
	}

	@Test
	void usesDefaultNameWhenNameIsUnset() {
		seeder(new InstructorSeedProperties("instructor1@example.test", PASSWORD, ""))
				.run(new DefaultApplicationArguments());

		assertThat(this.userRepository.findByEmail("instructor1@example.test"))
				.hasValueSatisfying(user -> assertThat(user.getName()).isEqualTo(InstructorSeedProperties.DEFAULT_NAME));
	}

	@Test
	void doesNothingWhenUnset() {
		seeder(new InstructorSeedProperties(null, null, null)).run(new DefaultApplicationArguments());
		seeder(new InstructorSeedProperties("", "", "")).run(new DefaultApplicationArguments());

		assertThat(this.userRepository.count()).isZero();
	}

	@Test
	void doesNothingWhenOnlyEmailOrOnlyPasswordIsSet(CapturedOutput output) {
		seeder(new InstructorSeedProperties("instructor1@example.test", "", null)).run(new DefaultApplicationArguments());
		seeder(new InstructorSeedProperties("", PASSWORD, null)).run(new DefaultApplicationArguments());

		assertThat(this.userRepository.count()).isZero();
		assertThat(output).contains("INSTRUCTOR_SEED_EMAIL and INSTRUCTOR_SEED_PASSWORD must both be set")
				.doesNotContain(PASSWORD);
	}

	@Test
	void doesNotModifyExistingUser() {
		String existingHash = this.passwordEncoder.encode("student-password-1");
		User student = this.userRepository.saveAndFlush(
				new User("Student One", "student1@example.test", existingHash, Role.STUDENT));

		seeder(new InstructorSeedProperties("Student1@Example.test", PASSWORD, "Instructor One"))
				.run(new DefaultApplicationArguments());

		assertThat(this.userRepository.count()).isEqualTo(1);
		assertThat(this.userRepository.findById(student.getId())).hasValueSatisfying(user -> {
			assertThat(user.getName()).isEqualTo("Student One");
			assertThat(user.getEmail()).isEqualTo("student1@example.test");
			assertThat(user.getRole()).isEqualTo(Role.STUDENT);
			assertThat(user.getPasswordHash()).isEqualTo(existingHash);
		});
	}

	@Test
	void logsEmailButNeverPassword(CapturedOutput output) {
		InstructorSeedProperties properties = new InstructorSeedProperties("instructor1@example.test", PASSWORD, null);

		seeder(properties).run(new DefaultApplicationArguments());
		seeder(properties).run(new DefaultApplicationArguments());

		assertThat(output).contains("Seeded instructor instructor1@example.test")
				.contains("a user with email instructor1@example.test already exists")
				.doesNotContain(PASSWORD);
	}

	private InstructorSeeder seeder(InstructorSeedProperties properties) {
		return new InstructorSeeder(properties, this.userRepository, this.passwordEncoder);
	}

}

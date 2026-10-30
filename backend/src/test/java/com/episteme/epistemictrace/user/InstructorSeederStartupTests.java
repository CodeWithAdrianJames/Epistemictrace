package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Start-up with seed values set. Kept apart from {@link InstructorSeederTests} because the instructor is created when
 * this context starts, and the users table is shared by every test context.
 */
@SpringBootTest(properties = {
		"epistemictrace.seed.instructor.email=Seed.Instructor@Example.test",
		"epistemictrace.seed.instructor.password=seed-instructor-password",
		"epistemictrace.seed.instructor.name=Seed Instructor" })
@ActiveProfiles("test")
class InstructorSeederStartupTests {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private InstructorSeeder seeder;

	@AfterEach
	void deleteUsers() {
		this.userRepository.deleteAll();
	}

	@Test
	void startupCreatesOneInstructorAndRunningAgainDoesNotCreateASecond() {
		assertThat(this.userRepository.findAll())
				.singleElement()
				.satisfies(user -> {
					assertThat(user.getEmail()).isEqualTo("seed.instructor@example.test");
					assertThat(user.getName()).isEqualTo("Seed Instructor");
					assertThat(user.getRole()).isEqualTo(Role.INSTRUCTOR);
				});

		this.seeder.run(new DefaultApplicationArguments());

		assertThat(this.userRepository.count()).isEqualTo(1);
	}

}

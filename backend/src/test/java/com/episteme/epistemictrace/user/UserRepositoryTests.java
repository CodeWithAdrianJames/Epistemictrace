package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

// Keep the H2 PostgreSQL-mode datasource from application-test.properties so Flyway's V1 runs
// and Hibernate validates against it, instead of letting @DataJpaTest swap in a plain embedded database.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class UserRepositoryTests {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private TestEntityManager entityManager;

	@Test
	void savedUserIsFoundByEmail() {
		User saved = this.userRepository.save(new User("Student One", "student1@example.test", "fake-hash", Role.STUDENT));
		this.entityManager.flush();
		this.entityManager.clear();

		assertThat(this.userRepository.findByEmail("student1@example.test")).hasValueSatisfying(user -> {
			assertThat(user.getId()).isEqualTo(saved.getId());
			assertThat(user.getName()).isEqualTo("Student One");
			assertThat(user.getPasswordHash()).isEqualTo("fake-hash");
			assertThat(user.getRole()).isEqualTo(Role.STUDENT);
			assertThat(user.getConsentAcceptedAt()).isNull();
			assertThat(user.getCreatedAt()).isNotNull();
		});
		assertThat(this.userRepository.existsByEmail("student1@example.test")).isTrue();
		assertThat(this.userRepository.findByEmail("nobody@example.test")).isEmpty();
		assertThat(this.userRepository.existsByEmail("nobody@example.test")).isFalse();
	}

	@Test
	void duplicateEmailThrows() {
		this.userRepository.saveAndFlush(new User("Student One", "student1@example.test", "fake-hash", Role.STUDENT));

		assertThatThrownBy(() -> this.userRepository
				.saveAndFlush(new User("Student Two", "student1@example.test", "fake-hash", Role.STUDENT)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

}

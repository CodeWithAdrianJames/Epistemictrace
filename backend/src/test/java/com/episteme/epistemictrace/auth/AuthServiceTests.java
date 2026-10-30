package com.episteme.epistemictrace.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

class AuthServiceTests {

	private final UserRepository userRepository = mock(UserRepository.class);

	private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);

	private final AuthService authService = new AuthService(this.userRepository, this.passwordEncoder);

	@Test
	void registerSavesNormalizedStudentWithHash() {
		when(this.passwordEncoder.encode("plain-password")).thenReturn("fake-hash");
		when(this.userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		this.authService.register(" Student One ", " Student1@Example.TEST ", "plain-password");

		ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
		verify(this.userRepository).existsByEmail("student1@example.test");
		verify(this.userRepository).saveAndFlush(saved.capture());
		assertThat(saved.getValue().getName()).isEqualTo("Student One");
		assertThat(saved.getValue().getEmail()).isEqualTo("student1@example.test");
		assertThat(saved.getValue().getPasswordHash()).isEqualTo("fake-hash");
		assertThat(saved.getValue().getRole()).isEqualTo(Role.STUDENT);
	}

	@Test
	void registerWithExistingEmailThrowsWithoutHashingOrSaving() {
		when(this.userRepository.existsByEmail("student1@example.test")).thenReturn(true);

		assertThatThrownBy(() -> this.authService.register("Student One", "STUDENT1@example.test", "plain-password"))
				.isInstanceOf(EmailAlreadyUsedException.class);
		verify(this.passwordEncoder, never()).encode(any());
		verify(this.userRepository, never()).saveAndFlush(any());
	}

	@Test
	void concurrentRegistrationOfSameEmailThrowsEmailAlreadyUsed() {
		// First check passes; another request inserts the email before this one is flushed.
		when(this.userRepository.existsByEmail("student1@example.test")).thenReturn(false, true);
		when(this.passwordEncoder.encode("plain-password")).thenReturn("fake-hash");
		when(this.userRepository.saveAndFlush(any(User.class)))
				.thenThrow(new DataIntegrityViolationException("uk_users_email"));

		assertThatThrownBy(() -> this.authService.register("Student One", "student1@example.test", "plain-password"))
				.isInstanceOf(EmailAlreadyUsedException.class);
	}

	@Test
	void otherIntegrityViolationIsRethrown() {
		when(this.userRepository.existsByEmail("student1@example.test")).thenReturn(false, false);
		when(this.passwordEncoder.encode("plain-password")).thenReturn("fake-hash");
		DataIntegrityViolationException failure = new DataIntegrityViolationException("other constraint");
		when(this.userRepository.saveAndFlush(any(User.class))).thenThrow(failure);

		assertThatThrownBy(() -> this.authService.register("Student One", "student1@example.test", "plain-password"))
				.isSameAs(failure);
	}

}

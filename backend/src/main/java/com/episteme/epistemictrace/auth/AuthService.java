package com.episteme.epistemictrace.auth;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

@Service
public class AuthService {

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	/**
	 * Creates a {@link Role#STUDENT} with a BCrypt password hash. Self-registration never creates an instructor.
	 * @throws EmailAlreadyUsedException if a user already has this email, in any letter case
	 */
	public User register(String name, String email, String password) {
		String normalizedEmail = normalizeEmail(email);
		if (this.userRepository.existsByEmail(normalizedEmail)) {
			throw new EmailAlreadyUsedException();
		}
		User user = new User(name.strip(), normalizedEmail, this.passwordEncoder.encode(password), Role.STUDENT);
		try {
			return this.userRepository.saveAndFlush(user);
		}
		catch (DataIntegrityViolationException ex) {
			// A concurrent request registered the same email between the check above and this insert;
			// uk_users_email rejected the second row.
			if (this.userRepository.existsByEmail(normalizedEmail)) {
				throw new EmailAlreadyUsedException();
			}
			throw ex;
		}
	}

	private static String normalizeEmail(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

}

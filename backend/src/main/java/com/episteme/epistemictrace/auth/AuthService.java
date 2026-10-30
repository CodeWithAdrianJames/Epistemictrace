package com.episteme.epistemictrace.auth;

import java.util.Locale;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

@Service
public class AuthService {

	/** Hashed once and checked when the email is unknown, so both login failures cost one BCrypt comparison. */
	private static final String UNKNOWN_USER_PASSWORD = "unknown-user-placeholder-password";

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	private final TokenService tokenService;

	private volatile String unknownUserHash;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, TokenService tokenService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.tokenService = tokenService;
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

	/**
	 * Checks the credentials and issues a token. The email is matched case-insensitively.
	 * @throws InvalidCredentialsException if the email is unknown or the password is wrong (same detail for both)
	 */
	public LoginResult login(String email, String password) {
		Optional<User> found = this.userRepository.findByEmail(normalizeEmail(email));
		if (found.isEmpty()) {
			this.passwordEncoder.matches(password, unknownUserHash());
			throw new InvalidCredentialsException();
		}
		User user = found.get();
		if (!this.passwordEncoder.matches(password, user.getPasswordHash())) {
			throw new InvalidCredentialsException();
		}
		return new LoginResult(user, this.tokenService.issue(user));
	}

	/**
	 * Reads the token's user fresh from the database.
	 * @param tokenSubject the {@code sub} claim of an already verified token
	 * @throws UnknownTokenUserException if the subject is not a user id or the user no longer exists
	 */
	public User currentUser(String tokenSubject) {
		long userId;
		try {
			userId = Long.parseLong(tokenSubject);
		}
		catch (NumberFormatException ex) {
			throw new UnknownTokenUserException();
		}
		return this.userRepository.findById(userId).orElseThrow(UnknownTokenUserException::new);
	}

	private String unknownUserHash() {
		String hash = this.unknownUserHash;
		if (hash == null) {
			// Computed on first use; a race only hashes the placeholder twice.
			hash = this.passwordEncoder.encode(UNKNOWN_USER_PASSWORD);
			this.unknownUserHash = hash;
		}
		return hash;
	}

	private static String normalizeEmail(String email) {
		return email.strip().toLowerCase(Locale.ROOT);
	}

	public record LoginResult(User user, Jwt token) {
	}

}

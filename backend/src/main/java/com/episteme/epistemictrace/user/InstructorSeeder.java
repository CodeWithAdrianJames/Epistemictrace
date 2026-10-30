package com.episteme.epistemictrace.user;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Creates the instructor account from {@link InstructorSeedProperties} at start-up. Does nothing when the values are
 * unset, and never changes an existing user. Logs the email only, never the password.
 */
@Component
@EnableConfigurationProperties(InstructorSeedProperties.class)
public class InstructorSeeder implements ApplicationRunner {

	private static final Logger logger = LoggerFactory.getLogger(InstructorSeeder.class);

	private final InstructorSeedProperties properties;

	private final UserRepository userRepository;

	private final PasswordEncoder passwordEncoder;

	public InstructorSeeder(InstructorSeedProperties properties, UserRepository userRepository,
			PasswordEncoder passwordEncoder) {
		this.properties = properties;
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (!this.properties.isComplete()) {
			if (StringUtils.hasText(this.properties.email()) || StringUtils.hasText(this.properties.password())) {
				logger.warn("Instructor seed skipped: INSTRUCTOR_SEED_EMAIL and INSTRUCTOR_SEED_PASSWORD must both be set");
			}
			return;
		}
		String email = this.properties.email().toLowerCase(Locale.ROOT);
		if (this.userRepository.existsByEmail(email)) {
			logger.info("Instructor seed skipped: a user with email {} already exists", email);
			return;
		}
		User instructor = new User(this.properties.name(), email,
				this.passwordEncoder.encode(this.properties.password()), Role.INSTRUCTOR);
		try {
			this.userRepository.saveAndFlush(instructor);
		}
		catch (DataIntegrityViolationException ex) {
			// Another instance seeded or registered the same email between the check above and this insert.
			if (this.userRepository.existsByEmail(email)) {
				logger.info("Instructor seed skipped: a user with email {} already exists", email);
				return;
			}
			throw ex;
		}
		logger.info("Seeded instructor {}", email);
	}

}

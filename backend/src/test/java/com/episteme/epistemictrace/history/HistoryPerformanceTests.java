package com.episteme.epistemictrace.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.episteme.epistemictrace.activity.Activity;
import com.episteme.epistemictrace.activity.ActivityRepository;
import com.episteme.epistemictrace.activity.ActivityStatus;
import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Spec 26 R4 timing check: 200 sessions and 10 000 events for one student, list endpoint under 500 ms. Run manually
 * with {@code ./mvnw test -Dtest=HistoryPerformanceTests -Depistemictrace.performance=true}; the measured time is
 * printed for the IMP-26 card.
 */
@Tag("performance")
@EnabledIfSystemProperty(named = "epistemictrace.performance", matches = "true")
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HistoryPerformanceTests {

	private static final Instant T0 = Instant.parse("2026-09-01T00:00:00Z");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@AfterEach
	void deleteData() {
		this.jdbcTemplate.update("delete from telemetry_events");
		this.jdbcTemplate.update("delete from coding_sessions");
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	@Test
	void theListAnswersWithinHalfASecond() throws Exception {
		User instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		User student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		Activity activity = this.activityRepository.save(
				new Activity(instructor.getId(), "Loops", "Print 1 to 5.", "", ActivityStatus.PUBLISHED));

		List<Object[]> sessions = new ArrayList<>();
		for (int i = 0; i < 200; i++) {
			Instant start = T0.plus(Duration.ofHours(i));
			sessions.add(new Object[] { student.getId(), activity.getId(), Timestamp.from(start),
					Timestamp.from(start.plusSeconds(1800)) });
		}
		this.jdbcTemplate.batchUpdate(
				"insert into coding_sessions (student_id, activity_id, started_at, ended_at, runner_locked) values (?, ?, ?, ?, false)",
				sessions);
		List<Long> ids = this.jdbcTemplate.queryForList("select id from coding_sessions", Long.class);
		List<Object[]> events = new ArrayList<>();
		for (int i = 0; i < 10_000; i++) {
			events.add(new Object[] { ids.get(i % ids.size()), UUID.randomUUID(), Timestamp.from(T0.plusSeconds(i)) });
		}
		this.jdbcTemplate.batchUpdate(
				"insert into telemetry_events (session_id, client_event_id, type, occurred_at, passed_count, total_count) values (?, ?, 'RUN', ?, 0, 1)",
				events);
		String token = token(student);
		// Warm-up request, so class loading and query plan caching are not part of the measurement.
		this.mockMvc.perform(get("/api/me/sessions").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk());

		long startNanos = System.nanoTime();
		this.mockMvc.perform(get("/api/me/sessions").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk());
		long millis = Duration.ofNanos(System.nanoTime() - startNanos).toMillis();

		System.out.println("HistoryPerformanceTests: GET /api/me/sessions with 200 sessions and 10 000 events took "
				+ millis + " ms");
		assertThat(millis).isLessThan(500);
	}

	private String token(User user) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(String.valueOf(user.getId()))
			.claim("role", user.getRole().name())
			.claim("email", user.getEmail())
			.issuedAt(now)
			.expiresAt(now.plus(5, ChronoUnit.MINUTES))
			.build();
		return this.jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
	}

}

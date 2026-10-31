package com.episteme.epistemictrace.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.episteme.epistemictrace.auth.UnknownTokenUserException;

/** Spec 15 Part A service rule: the first consent timestamp is kept. */
@SpringBootTest
@ActiveProfiles("test")
class ConsentServiceTests {

	private static final Instant FIRST = Instant.parse("2026-10-31T22:30:00Z");

	private static final Instant LATER = Instant.parse("2026-11-01T09:00:00Z");

	@Autowired
	private ConsentService consentService;

	@Autowired
	private UserRepository userRepository;

	private User student;

	@BeforeEach
	void createStudent() {
		this.student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
	}

	@AfterEach
	void deleteData() {
		this.userRepository.deleteAll();
	}

	@Test
	void firstCallStoresAndReturnsTheGivenInstant() {
		Instant accepted = this.consentService.accept(this.student.getId(), FIRST);

		assertThat(accepted).isEqualTo(FIRST);
		assertThat(stored()).isEqualTo(FIRST);
	}

	@Test
	void laterCallReturnsTheFirstInstantAndStoresNothingNew() {
		this.consentService.accept(this.student.getId(), FIRST);

		Instant accepted = this.consentService.accept(this.student.getId(), LATER);

		assertThat(accepted).isEqualTo(FIRST);
		assertThat(stored()).isEqualTo(FIRST);
	}

	@Test
	void unknownUserThrowsUnauthorized() {
		long missingId = this.student.getId() + 1000;

		assertThatThrownBy(() -> this.consentService.accept(missingId, FIRST))
			.isInstanceOf(UnknownTokenUserException.class);
	}

	@Test
	void concurrentFirstCallsAllReturnTheSameInstant() throws Exception {
		int callers = 8;
		ExecutorService pool = Executors.newFixedThreadPool(callers);
		try {
			CountDownLatch start = new CountDownLatch(1);
			List<Future<Instant>> futures = IntStream.range(0, callers).<Callable<Instant>>mapToObj(index -> () -> {
				start.await();
				return this.consentService.accept(this.student.getId(), FIRST.plusSeconds(index));
			}).map(pool::submit).toList();
			start.countDown();

			List<Instant> results = new ArrayList<>();
			for (Future<Instant> future : futures) {
				results.add(future.get(10, TimeUnit.SECONDS));
			}
			Instant stored = stored();
			assertThat(stored).isNotNull();
			assertThat(results).hasSize(callers).containsOnly(stored);
		}
		finally {
			pool.shutdownNow();
		}
	}

	private Instant stored() {
		return this.userRepository.findById(this.student.getId()).orElseThrow().getConsentAcceptedAt();
	}

}

package com.episteme.epistemictrace.reflection;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.breaker.BreakerService;
import com.episteme.epistemictrace.config.ReflectionProperties;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.SessionNotFoundException;
import com.episteme.epistemictrace.session.SessionService;

/**
 * Saves a reflection and unlocks the runner into its cooldown (spec 24 R1–R7). The session row is locked for the
 * transaction, so of two concurrent submits only the first finds the runner locked; the second gets a {@code 409}.
 */
@Service
public class ReflectionService {

	private final ReflectionRepository reflectionRepository;

	private final SessionService sessionService;

	private final SdiConfigRepository sdiConfigRepository;

	private final BreakerService breakerService;

	private final ReflectionProperties reflectionProperties;

	private final Clock clock;

	public ReflectionService(ReflectionRepository reflectionRepository, SessionService sessionService,
			SdiConfigRepository sdiConfigRepository, BreakerService breakerService,
			ReflectionProperties reflectionProperties, Clock clock) {
		this.reflectionRepository = reflectionRepository;
		this.sessionService = sessionService;
		this.sdiConfigRepository = sdiConfigRepository;
		this.breakerService = breakerService;
		this.reflectionProperties = reflectionProperties;
		this.clock = clock;
	}

	/**
	 * Stores the trimmed reflection with the SDI at lock and starts the activity's cooldown.
	 * @throws InvalidReflectionException if a trimmed field is shorter than the minimum or longer than the maximum
	 * @throws SessionNotFoundException if there is no session with this id
	 * @throws AccessDeniedException if the session belongs to another student
	 * @throws RunnerNotLockedException if the session's runner is not locked
	 */
	@Transactional
	public ReflectionResponse submit(long sessionId, long studentId, ReflectionRequest request) {
		String hypothesis = trim(request.hypothesis());
		String plannedFix = trim(request.plannedFix());
		checkLengths(hypothesis, plannedFix);

		CodingSession session = this.sessionService.lockOwnedSession(sessionId, studentId);
		if (!session.isRunnerLocked() || session.getSdiAtLock() == null) {
			throw new RunnerNotLockedException();
		}
		SdiConfig config = this.sdiConfigRepository.findByActivityId(session.getActivityId())
			.orElseThrow(() -> new IllegalStateException("Activity " + session.getActivityId() + " has no SDI config"));
		Instant now = this.clock.instant();
		Reflection reflection = this.reflectionRepository
			.save(new Reflection(session.getId(), hypothesis, plannedFix, session.getSdiAtLock(), now));
		this.breakerService.onReflection(session, Duration.ofSeconds(config.getCooldownSeconds()));
		return new ReflectionResponse(reflection.getId(), reflection.getSubmittedAt(),
				this.breakerService.payload(session));
	}

	private void checkLengths(String hypothesis, String plannedFix) {
		int min = this.reflectionProperties.minLength();
		int max = this.reflectionProperties.maxLength();
		Map<String, String> errors = new LinkedHashMap<>();
		lengthError(hypothesis, min, max).ifPresent(message -> errors.put("hypothesis", message));
		lengthError(plannedFix, min, max).ifPresent(message -> errors.put("plannedFix", message));
		if (!errors.isEmpty()) {
			throw new InvalidReflectionException(errors.values().iterator().next(), errors);
		}
	}

	private static Optional<String> lengthError(String value, int min, int max) {
		if (value.length() < min) {
			return Optional.of("Write at least " + min + " characters.");
		}
		if (value.length() > max) {
			return Optional.of("Write at most " + max + " characters.");
		}
		return Optional.empty();
	}

	private static String trim(String value) {
		return (value != null) ? value.strip() : "";
	}

}

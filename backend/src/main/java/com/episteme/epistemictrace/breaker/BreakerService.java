package com.episteme.epistemictrace.breaker;

import java.time.Clock;
import java.time.Duration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import com.episteme.epistemictrace.config.ReflectionProperties;
import com.episteme.epistemictrace.session.CodingSession;

/**
 * Applies {@link BreakerRules} to a session with server time (spec 22 R5–R9) and builds the breaker payload. Runs in
 * the caller's transaction: changes go onto the managed {@link CodingSession}, which the caller's transaction saves.
 */
@Service
@EnableConfigurationProperties(ReflectionProperties.class)
public class BreakerService {

	private final ReflectionProperties reflectionProperties;

	private final Clock clock;

	public BreakerService(ReflectionProperties reflectionProperties, Clock clock) {
		this.reflectionProperties = reflectionProperties;
		this.clock = clock;
	}

	/** R6: a scored RUN may lock the session; the threshold comes from the activity's {@code sdi_configs} row. */
	public void onRunScored(CodingSession session, int sdi, int threshold) {
		session.applyBreakerState(BreakerRules.onRunScored(session.breakerState(), sdi, threshold, this.clock.instant()));
	}

	/**
	 * A valid reflection unlocks the session and starts the cooldown (used by spec 24).
	 * @throws IllegalStateException if the session is not locked
	 */
	public void onReflection(CodingSession session, Duration cooldown) {
		session.applyBreakerState(BreakerRules.onReflection(session.breakerState(), cooldown, this.clock.instant()));
	}

	/** R7: the session's state now, without the SDI at lock. */
	public BreakerPayload payload(CodingSession session) {
		BreakerView view = BreakerRules.view(session.breakerState(), this.clock.instant());
		return new BreakerPayload(view.status(), view.cooldownEndsAt(), this.reflectionProperties.minLength());
	}

}

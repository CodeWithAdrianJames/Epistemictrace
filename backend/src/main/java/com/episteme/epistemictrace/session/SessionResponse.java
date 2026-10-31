package com.episteme.epistemictrace.session;

import java.time.Instant;

import com.episteme.epistemictrace.breaker.BreakerPayload;

/**
 * Response of {@code POST /api/sessions} (spec 16 R1); {@code resumed} is {@code true} when an earlier session was
 * reopened. {@code breaker} is the session's circuit-breaker state, so a resumed locked session stays locked (spec 22 R8).
 */
public record SessionResponse(long sessionId, long activityId, Instant startedAt, boolean resumed,
		BreakerPayload breaker) {

	public static SessionResponse from(SessionStart start) {
		CodingSession session = start.session();
		return new SessionResponse(session.getId(), session.getActivityId(), session.getStartedAt(), start.resumed(),
				start.breaker());
	}

}

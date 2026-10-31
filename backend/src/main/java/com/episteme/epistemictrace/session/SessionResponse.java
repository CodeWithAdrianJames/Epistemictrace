package com.episteme.epistemictrace.session;

import java.time.Instant;

/**
 * Response of {@code POST /api/sessions} (spec 16 R1); {@code resumed} is {@code true} when an earlier session was
 * reopened.
 */
public record SessionResponse(long sessionId, long activityId, Instant startedAt, boolean resumed) {

	public static SessionResponse from(SessionStart start) {
		CodingSession session = start.session();
		return new SessionResponse(session.getId(), session.getActivityId(), session.getStartedAt(), start.resumed());
	}

}

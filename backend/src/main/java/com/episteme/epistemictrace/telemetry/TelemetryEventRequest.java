package com.episteme.epistemictrace.telemetry;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;

/**
 * One event of a telemetry batch (spec 18 R1, Q4). Which of the optional fields must be present depends on
 * {@link #type()}; {@link ValidTelemetryEvent} checks that. {@code sdiValue} exists only so a client that sends one
 * gets a {@code 400}: the SDI is computed by the server (Q2).
 */
@ValidTelemetryEvent
public record TelemetryEventRequest(
		@NotNull UUID clientEventId,
		@NotNull EventType type,
		@NotNull Instant occurredAt,
		Integer charsAdded,
		Integer charsRemoved,
		Integer passedCount,
		Integer totalCount,
		String errorSignature,
		@Null(message = "is computed by the server and must not be sent") Object sdiValue) {

	/** The event as an entity of the given session. */
	TelemetryEvent toEntity(long sessionId) {
		TelemetryEvent event = new TelemetryEvent(sessionId, this.clientEventId, this.type, this.occurredAt);
		event.setCharsAdded(this.charsAdded);
		event.setCharsRemoved(this.charsRemoved);
		event.setPassedCount(this.passedCount);
		event.setTotalCount(this.totalCount);
		event.setErrorSignature(this.errorSignature);
		return event;
	}

}

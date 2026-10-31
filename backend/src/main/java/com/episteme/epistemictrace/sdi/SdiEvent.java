package com.episteme.epistemictrace.sdi;

import java.time.Instant;
import java.util.Objects;

import com.episteme.epistemictrace.telemetry.EventType;

/**
 * The fields of a telemetry event the SDI needs (spec 19 R2). {@code passedCount} is set for RUN events and
 * {@code errorSignature} for ERROR events; both are {@code null} otherwise.
 */
public record SdiEvent(long id, EventType type, Instant occurredAt, Integer passedCount, String errorSignature) {

	public SdiEvent {
		Objects.requireNonNull(type, "type");
		Objects.requireNonNull(occurredAt, "occurredAt");
	}

}

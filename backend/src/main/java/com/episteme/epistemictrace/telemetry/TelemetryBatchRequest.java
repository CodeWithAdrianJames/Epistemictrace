package com.episteme.epistemictrace.telemetry;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/sessions/{id}/events} (spec 18 R1, R2): 1–200 events. */
public record TelemetryBatchRequest(
		@NotNull @Size(min = 1, max = 200) List<@NotNull @Valid TelemetryEventRequest> events) {

}

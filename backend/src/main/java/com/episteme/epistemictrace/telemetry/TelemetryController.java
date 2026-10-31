package com.episteme.epistemictrace.telemetry;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/** Telemetry batch upload (spec 18). Role {@code STUDENT} is enforced by {@code SecurityConfig}. */
@RestController
public class TelemetryController {

	private final TelemetryService telemetryService;

	private final CurrentUser currentUser;

	public TelemetryController(TelemetryService telemetryService, CurrentUser currentUser) {
		this.telemetryService = telemetryService;
		this.currentUser = currentUser;
	}

	@PostMapping("/api/sessions/{id}/events")
	public TelemetryBatchResponse store(@PathVariable long id, @Valid @RequestBody TelemetryBatchRequest request) {
		return TelemetryBatchResponse.from(this.telemetryService.store(id, this.currentUser.id(), request.events()));
	}

}

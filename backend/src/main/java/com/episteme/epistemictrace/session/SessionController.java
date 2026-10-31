package com.episteme.epistemictrace.session;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/**
 * Coding session endpoints (spec 16 R1, R2). Role {@code STUDENT} is enforced by {@code SecurityConfig}. Starting
 * answers {@code 201} for a new session and {@code 200} for a resumed one.
 */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {

	private final SessionService sessionService;

	private final CurrentUser currentUser;

	public SessionController(SessionService sessionService, CurrentUser currentUser) {
		this.sessionService = sessionService;
		this.currentUser = currentUser;
	}

	@PostMapping
	public ResponseEntity<SessionResponse> start(@Valid @RequestBody StartSessionRequest request) {
		SessionStart start = this.sessionService.start(this.currentUser.id(), request.activityId());
		return ResponseEntity.status(start.resumed() ? HttpStatus.OK : HttpStatus.CREATED)
			.body(SessionResponse.from(start));
	}

	@PostMapping("/{id}/end")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void end(@PathVariable long id) {
		this.sessionService.end(id, this.currentUser.id());
	}

}

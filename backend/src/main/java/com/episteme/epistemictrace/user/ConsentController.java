package com.episteme.epistemictrace.user;

import java.time.Instant;

import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/** Consent endpoint (spec 15 R1). Role {@code STUDENT} is enforced by {@code SecurityConfig}. */
@RestController
@RequestMapping("/api/me")
public class ConsentController {

	private final ConsentService consentService;

	private final CurrentUser currentUser;

	public ConsentController(ConsentService consentService, CurrentUser currentUser) {
		this.consentService = consentService;
		this.currentUser = currentUser;
	}

	@PutMapping("/consent")
	public ConsentResponse accept() {
		return new ConsentResponse(this.consentService.accept(this.currentUser.id(), Instant.now()));
	}

}

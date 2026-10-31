package com.episteme.epistemictrace.reflection;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/** Reflection submission (spec 24). Role {@code STUDENT} is enforced by {@code SecurityConfig}. */
@RestController
public class ReflectionController {

	private final ReflectionService reflectionService;

	private final CurrentUser currentUser;

	public ReflectionController(ReflectionService reflectionService, CurrentUser currentUser) {
		this.reflectionService = reflectionService;
		this.currentUser = currentUser;
	}

	@PostMapping("/api/sessions/{id}/reflections")
	@ResponseStatus(HttpStatus.CREATED)
	public ReflectionResponse submit(@PathVariable long id, @RequestBody ReflectionRequest request) {
		return this.reflectionService.submit(id, this.currentUser.id(), request);
	}

}

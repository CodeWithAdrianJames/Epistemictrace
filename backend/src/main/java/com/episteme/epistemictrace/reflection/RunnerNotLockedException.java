package com.episteme.epistemictrace.reflection;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** A reflection for a session whose runner is not locked (spec 24 R3, R6). Rendered as a {@code 409}. */
public class RunnerNotLockedException extends ErrorResponseException {

	static final String DETAIL = "Tests aren't paused right now.";

	public RunnerNotLockedException() {
		super(HttpStatus.CONFLICT, ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, DETAIL), null);
	}

}

package com.episteme.epistemictrace.activity;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** The activity's status does not allow the requested change (spec 08 R3). Rendered as a {@code 409}. */
public class ActivityConflictException extends ErrorResponseException {

	public ActivityConflictException(String detail) {
		super(HttpStatus.CONFLICT, ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, detail), null);
	}

}

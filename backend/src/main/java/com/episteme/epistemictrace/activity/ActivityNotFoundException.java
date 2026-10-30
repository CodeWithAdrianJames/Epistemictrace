package com.episteme.epistemictrace.activity;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** No activity with the requested id. Rendered as a {@code 404} {@link ProblemDetail}. */
public class ActivityNotFoundException extends ErrorResponseException {

	static final String DETAIL = "Activity not found.";

	public ActivityNotFoundException() {
		super(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, DETAIL), null);
	}

}

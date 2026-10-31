package com.episteme.epistemictrace.session;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** No coding session with the requested id. Rendered as a {@code 404} {@link ProblemDetail}. */
public class SessionNotFoundException extends ErrorResponseException {

	static final String DETAIL = "Session not found.";

	public SessionNotFoundException() {
		super(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, DETAIL), null);
	}

}

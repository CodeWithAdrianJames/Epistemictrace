package com.episteme.epistemictrace.session;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** The student has not accepted the consent notice (invariant 2). Rendered as a {@code 403} {@link ProblemDetail}. */
public class ConsentRequiredException extends ErrorResponseException {

	static final String DETAIL = "Consent is required before tracking starts.";

	public ConsentRequiredException() {
		super(HttpStatus.FORBIDDEN, ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, DETAIL), null);
	}

}

package com.episteme.epistemictrace.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Registration with an email that already belongs to a user. As an {@link ErrorResponseException} it is
 * rendered as a {@code 409} {@link ProblemDetail} by {@code GlobalExceptionHandler}.
 */
public class EmailAlreadyUsedException extends ErrorResponseException {

	static final String DETAIL = "An account with this email already exists.";

	public EmailAlreadyUsedException() {
		super(HttpStatus.CONFLICT, ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, DETAIL), null);
	}

}

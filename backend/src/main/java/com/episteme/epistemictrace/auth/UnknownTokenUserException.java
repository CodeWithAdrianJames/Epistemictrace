package com.episteme.epistemictrace.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * A validly signed token whose {@code sub} does not name an existing user (for example, the user was deleted
 * after the token was issued). Rendered as a {@code 401} {@link ProblemDetail} by {@code GlobalExceptionHandler}.
 */
public class UnknownTokenUserException extends ErrorResponseException {

	static final String DETAIL = "The account for this token no longer exists. Please log in again.";

	public UnknownTokenUserException() {
		super(HttpStatus.UNAUTHORIZED, ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, DETAIL), null);
	}

}

package com.episteme.epistemictrace.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Login with an unknown email or a wrong password. Both cases share one detail so the response does not reveal
 * whether an account exists. Rendered as a {@code 401} {@link ProblemDetail} by {@code GlobalExceptionHandler}.
 */
public class InvalidCredentialsException extends ErrorResponseException {

	static final String DETAIL = "Email or password is incorrect.";

	public InvalidCredentialsException() {
		super(HttpStatus.UNAUTHORIZED, ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, DETAIL), null);
	}

}

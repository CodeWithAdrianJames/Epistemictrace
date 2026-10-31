package com.episteme.epistemictrace.activity;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * No test case with the requested id in this activity, including one that belongs to another activity (spec 08 R3).
 * Rendered as a {@code 404} {@link ProblemDetail}.
 */
public class TestCaseNotFoundException extends ErrorResponseException {

	static final String DETAIL = "Test case not found.";

	public TestCaseNotFoundException() {
		super(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, DETAIL), null);
	}

}

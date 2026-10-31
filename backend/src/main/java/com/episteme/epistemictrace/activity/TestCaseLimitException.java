package com.episteme.epistemictrace.activity;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * The activity already has the maximum number of test cases (spec 08 R2, Q16). Rendered as a {@code 400} with an
 * {@code errors} map, like body validation errors.
 */
public class TestCaseLimitException extends ErrorResponseException {

	public TestCaseLimitException(int maxTestCases) {
		super(HttpStatus.BAD_REQUEST, problem(maxTestCases), null);
	}

	private static ProblemDetail problem(int maxTestCases) {
		String message = "An activity can have at most " + maxTestCases + " test cases.";
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, message);
		problem.setProperty("errors", Map.of("testCases", message));
		return problem;
	}

}

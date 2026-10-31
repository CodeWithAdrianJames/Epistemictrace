package com.episteme.epistemictrace.reflection;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * A reflection field is too short or too long after trimming (spec 24 R1). Rendered as a {@code 400}
 * {@link ProblemDetail} with an {@code errors} map keyed {@code hypothesis} / {@code plannedFix}.
 */
public class InvalidReflectionException extends ErrorResponseException {

	public InvalidReflectionException(String detail, Map<String, String> errors) {
		super(HttpStatus.BAD_REQUEST, problem(detail, errors), null);
	}

	private static ProblemDetail problem(String detail, Map<String, String> errors) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
		problem.setProperty("errors", Map.copyOf(errors));
		return problem;
	}

}

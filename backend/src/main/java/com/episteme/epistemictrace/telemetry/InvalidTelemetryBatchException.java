package com.episteme.epistemictrace.telemetry;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * A batch that passed bean validation but breaks a rule that needs the session or the server clock (spec 18 R2).
 * Rendered as a {@code 400} {@link ProblemDetail} with the same {@code errors} map as other validation failures.
 */
public class InvalidTelemetryBatchException extends ErrorResponseException {

	static final String DETAIL = "Invalid request content.";

	public InvalidTelemetryBatchException(Map<String, String> errors) {
		super(HttpStatus.BAD_REQUEST, problem(errors), null);
	}

	private static ProblemDetail problem(Map<String, String> errors) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, DETAIL);
		problem.setProperty("errors", Map.copyOf(errors));
		return problem;
	}

}

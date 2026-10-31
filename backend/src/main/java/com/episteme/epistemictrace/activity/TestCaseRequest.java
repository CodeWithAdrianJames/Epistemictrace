package com.episteme.epistemictrace.activity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/instructor/activities/{id}/test-cases} and
 * {@code PUT /api/instructor/activities/{id}/test-cases/{testCaseId}} (spec 08 R1, R2). A missing input is stored as an
 * empty string and a missing {@code hidden} as {@code false}. The expected output must not be blank: output comparison
 * strips trailing whitespace, so a whitespace-only value would match a program that prints nothing.
 */
public record TestCaseRequest(
		@Size(max = 10_000) String input,
		@NotBlank @Size(max = 10_000) String expectedOutput,
		Boolean hidden) {

	public TestCaseRequest {
		input = (input != null) ? input : "";
		hidden = (hidden != null) ? hidden : Boolean.FALSE;
	}

}

package com.episteme.epistemictrace.activity;

/** One test case inside {@link ActivityDetail}. Hidden tests keep their data: the browser needs it to run them. */
public record TestCaseDto(Long id, int position, String input, String expectedOutput, boolean hidden) {

	static TestCaseDto from(TestCase testCase) {
		return new TestCaseDto(testCase.getId(), testCase.getPosition(), testCase.getInput(),
				testCase.getExpectedOutput(), testCase.isHidden());
	}

}

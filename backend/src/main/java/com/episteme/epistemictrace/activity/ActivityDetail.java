package com.episteme.epistemictrace.activity;

import java.time.Instant;
import java.util.List;

/** An activity with its test cases in position order. */
public record ActivityDetail(Long id, String title, String problemStatement, String starterCode,
		ActivityStatus status, List<TestCaseDto> testCases, Instant createdAt, Instant updatedAt) {

	/** The activity's test cases must already be loaded. */
	static ActivityDetail from(Activity activity) {
		List<TestCaseDto> testCases = activity.getTestCases().stream().map(TestCaseDto::from).toList();
		return new ActivityDetail(activity.getId(), activity.getTitle(), activity.getProblemStatement(),
				activity.getStarterCode(), activity.getStatus(), testCases, activity.getCreatedAt(),
				activity.getUpdatedAt());
	}

}

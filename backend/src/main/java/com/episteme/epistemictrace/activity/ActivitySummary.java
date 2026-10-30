package com.episteme.epistemictrace.activity;

import java.time.Instant;

/**
 * One row of an activity list. Built by {@link ActivityRepository} queries, so a list never loads test case data
 * just to count it.
 */
public record ActivitySummary(Long id, String title, ActivityStatus status, int testCaseCount, Instant updatedAt) {

}

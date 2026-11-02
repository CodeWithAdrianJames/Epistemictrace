package com.episteme.epistemictrace.analytics;

import java.time.Instant;

import com.episteme.epistemictrace.sdi.StruggleLevel;

/**
 * One student's row of the activity analytics (spec 29 R1, R2). {@code peakSdi} and {@code level} are {@code null}
 * when no run of the student was scored. Instructor-only: the raw SDI never reaches a student (R6, invariant 5).
 */
public record StudentAnalytics(long studentId, String name, String email, long sessionCount, long runCount,
		long sessionSeconds, Integer peakSdi, StruggleLevel level, long breakerTriggerCount, long reflectionCount,
		Instant lastActiveAt) {
}

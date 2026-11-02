package com.episteme.epistemictrace.analytics;

/** The totals of an activity's analytics (spec 29 R1); {@code peakSdi} is {@code null} when no run was scored. */
public record AnalyticsTotals(long studentCount, long sessionCount, long runCount, long sessionSeconds,
		long breakerTriggerCount, long reflectionCount, Integer peakSdi) {
}

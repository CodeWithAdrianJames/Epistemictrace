package com.episteme.epistemictrace.analytics;

/** The SDI threshold of one activity (its {@code sdi_configs} row), the upper level boundary (spec 29 R2, R8). */
public record ActivityThreshold(Long activityId, Integer threshold) {
}

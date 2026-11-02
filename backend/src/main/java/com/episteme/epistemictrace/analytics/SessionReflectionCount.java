package com.episteme.epistemictrace.analytics;

/** Reflection count of one session (spec 29 R2); sessions without reflections have no row. */
public record SessionReflectionCount(Long sessionId, Long reflectionCount) {
}

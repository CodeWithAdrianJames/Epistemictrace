package com.episteme.epistemictrace.reflection;

/**
 * Body of {@code POST /api/sessions/{id}/reflections} (spec 24 R1). The length rules depend on configuration
 * ({@code epistemictrace.reflection}), so {@link ReflectionService} checks them after trimming.
 */
public record ReflectionRequest(String hypothesis, String plannedFix) {

}

package com.episteme.epistemictrace.analytics;

/** The name and email an instructor sees for a student (spec 29 R1); never the password hash. */
public record StudentIdentity(Long studentId, String name, String email) {
}

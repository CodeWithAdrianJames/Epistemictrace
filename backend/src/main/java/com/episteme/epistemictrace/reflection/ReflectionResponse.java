package com.episteme.epistemictrace.reflection;

import java.time.Instant;

import com.episteme.epistemictrace.breaker.BreakerPayload;

/** {@code 201} body of a saved reflection (spec 24 R5). Never includes {@code sdi_at_trigger} (R7). */
public record ReflectionResponse(long reflectionId, Instant submittedAt, BreakerPayload breaker) {

}

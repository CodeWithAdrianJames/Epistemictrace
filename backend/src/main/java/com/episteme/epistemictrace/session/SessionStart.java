package com.episteme.epistemictrace.session;

import com.episteme.epistemictrace.breaker.BreakerPayload;

/**
 * Result of {@link SessionService#start}: the session, whether an earlier one was resumed, and its breaker state (spec
 * 22 R8).
 */
public record SessionStart(CodingSession session, boolean resumed, BreakerPayload breaker) {

}

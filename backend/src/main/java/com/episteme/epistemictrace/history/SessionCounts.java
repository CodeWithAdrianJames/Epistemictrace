package com.episteme.epistemictrace.history;

/** RUN event and reflection counts of one session (spec 26 R1). */
public record SessionCounts(Long sessionId, Long runCount, Long reflectionCount) {

}

package com.episteme.epistemictrace.session;

/** Result of {@link SessionService#start}: the session and whether an earlier one was resumed. */
public record SessionStart(CodingSession session, boolean resumed) {

}

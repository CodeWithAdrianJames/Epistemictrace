package com.episteme.epistemictrace.history;

import java.time.Instant;

/** A reflection as the student sees it in their history (spec 26 R2): no SDI at trigger (R3). */
public record ReflectionEntry(String hypothesis, String plannedFix, Instant submittedAt) {

}

package com.episteme.epistemictrace.session;

import jakarta.validation.constraints.NotNull;

/** Body of {@code POST /api/sessions} (spec 16 R1). */
public record StartSessionRequest(@NotNull Long activityId) {

}

package com.episteme.epistemictrace.user;

import java.time.Instant;

/** Body of {@code PUT /api/me/consent} (spec 15 R1). */
public record ConsentResponse(Instant consentAcceptedAt) {
}

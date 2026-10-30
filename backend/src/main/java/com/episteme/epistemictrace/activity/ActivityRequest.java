package com.episteme.epistemictrace.activity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /api/instructor/activities} and {@code PUT /api/instructor/activities/{id}} (spec 08 R1, R2).
 * The title is trimmed before validation so its limit applies to the stored value. A missing starter code is stored
 * as an empty string.
 */
public record ActivityRequest(
		@NotBlank @Size(max = 120) String title,
		@NotBlank @Size(max = 20_000) String problemStatement,
		@Size(max = 20_000) String starterCode) {

	public ActivityRequest {
		title = (title != null) ? title.strip() : null;
		starterCode = (starterCode != null) ? starterCode : "";
	}

}

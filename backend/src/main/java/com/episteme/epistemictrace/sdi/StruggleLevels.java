package com.episteme.epistemictrace.sdi;

/** Maps an SDI to its level (spec 20 R4). Both boundaries are configuration: {@code levels.medium-from} and the activity threshold. */
public final class StruggleLevels {

	private StruggleLevels() {
	}

	/** {@code HIGH} if {@code sdi ≥ threshold}; else {@code MEDIUM} if {@code sdi ≥ mediumFrom}; else {@code LOW}. */
	public static StruggleLevel of(int sdi, int mediumFrom, int threshold) {
		if (sdi >= threshold) {
			return StruggleLevel.HIGH;
		}
		if (sdi >= mediumFrom) {
			return StruggleLevel.MEDIUM;
		}
		return StruggleLevel.LOW;
	}

}

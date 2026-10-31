package com.episteme.epistemictrace.history;

import java.time.Instant;
import java.util.List;

/** Body of {@code GET /api/me/sessions/{id}} (spec 26 R2): the list item's fields plus the session's reflections. */
public record HistoryDetail(long sessionId, long activityId, String activityTitle, Instant startedAt, Instant endedAt,
		Long durationSeconds, long runCount, long reflectionCount, List<ReflectionEntry> reflections) {

	public HistoryDetail {
		reflections = List.copyOf(reflections);
	}

	static HistoryDetail of(HistoryItem item, List<ReflectionEntry> reflections) {
		return new HistoryDetail(item.sessionId(), item.activityId(), item.activityTitle(), item.startedAt(),
				item.endedAt(), item.durationSeconds(), item.runCount(), item.reflectionCount(), reflections);
	}

}

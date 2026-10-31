package com.episteme.epistemictrace.history;

import java.util.List;

/** Body of {@code GET /api/me/sessions} (spec 26 R1). */
public record HistoryPage(List<HistoryItem> items, int page, int size, long totalItems) {

	public HistoryPage {
		items = List.copyOf(items);
	}

}

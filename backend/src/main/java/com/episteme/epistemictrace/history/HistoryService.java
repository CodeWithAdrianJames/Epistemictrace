package com.episteme.epistemictrace.history;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.episteme.epistemictrace.session.SessionNotFoundException;
import com.episteme.epistemictrace.session.SessionService;
import com.episteme.epistemictrace.telemetry.EventType;

/** The student's own session history (spec 26). Read-only; never exposes an SDI value (R3). */
@Service
@Transactional(readOnly = true)
public class HistoryService {

	private final HistoryRepository historyRepository;

	private final SessionService sessionService;

	public HistoryService(HistoryRepository historyRepository, SessionService sessionService) {
		this.historyRepository = historyRepository;
		this.sessionService = sessionService;
	}

	/** R1, R4: one query for the page and one for the counts of its sessions. */
	public HistoryPage list(long studentId, int page, int size) {
		Page<SessionRow> rows = this.historyRepository.findSessionRows(studentId, PageRequest.of(page, size));
		Map<Long, SessionCounts> counts = counts(rows.getContent().stream().map(SessionRow::sessionId).toList());
		List<HistoryItem> items = rows.getContent()
			.stream()
			.map(row -> HistoryItem.of(row, counts.get(row.sessionId())))
			.toList();
		return new HistoryPage(items, page, size, rows.getTotalElements());
	}

	/**
	 * R2: one of the student's sessions with its reflections, oldest first.
	 * @throws SessionNotFoundException if there is no session with this id
	 * @throws AccessDeniedException if the session belongs to another student
	 */
	public HistoryDetail detail(long sessionId, long studentId) {
		this.sessionService.requireOwnedSession(sessionId, studentId);
		SessionRow row = this.historyRepository.findSessionRow(sessionId)
			.stream()
			.findFirst()
			.orElseThrow(SessionNotFoundException::new);
		HistoryItem item = HistoryItem.of(row, counts(List.of(sessionId)).get(sessionId));
		return HistoryDetail.of(item, this.historyRepository.findReflections(sessionId));
	}

	private Map<Long, SessionCounts> counts(List<Long> sessionIds) {
		if (sessionIds.isEmpty()) {
			return Map.of();
		}
		return this.historyRepository.countRunsAndReflections(sessionIds, EventType.RUN)
			.stream()
			.collect(Collectors.toMap(SessionCounts::sessionId, Function.identity()));
	}

}

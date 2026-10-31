package com.episteme.epistemictrace.telemetry;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.episteme.epistemictrace.sdi.SdiScoringService;
import com.episteme.epistemictrace.sdi.SdiScoringService.ScoredBatch;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.session.SessionNotFoundException;
import com.episteme.epistemictrace.session.SessionService;

/**
 * Stores telemetry batches (spec 18 R2–R7) and scores their new RUN events (spec 21). A batch is stored and scored in
 * one transaction; events whose client id the session already has are skipped, counted as duplicates and not
 * re-scored.
 */
@Service
public class TelemetryService {

	/** How far {@code occurredAt} may lie after server now or before the session start (spec 18 R2). */
	static final Duration CLOCK_TOLERANCE = Duration.ofMinutes(5);

	private static final Comparator<TelemetryEvent> BY_OCCURRED_AT = Comparator
		.comparing(TelemetryEvent::getOccurredAt)
		.thenComparing(TelemetryEvent::getId);

	private final TelemetryEventRepository telemetryEventRepository;

	private final SessionService sessionService;

	private final SdiScoringService sdiScoringService;

	private final TransactionTemplate transactionTemplate;

	private final Clock clock;

	public TelemetryService(TelemetryEventRepository telemetryEventRepository, SessionService sessionService,
			SdiScoringService sdiScoringService, PlatformTransactionManager transactionManager, Clock clock) {
		this.telemetryEventRepository = telemetryEventRepository;
		this.sessionService = sessionService;
		this.sdiScoringService = sdiScoringService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
		this.clock = clock;
	}

	/**
	 * Stores the events of the student's own session that it does not have yet. Ended sessions still accept events
	 * (R4). If a concurrent request stores one of the same client ids first, the unique key rejects this insert and
	 * the batch is retried once, so those events count as duplicates instead of failing.
	 * @throws SessionNotFoundException if there is no session with this id
	 * @throws AccessDeniedException if the session belongs to another student
	 * @throws InvalidTelemetryBatchException if an {@code occurredAt} is outside the accepted range
	 */
	public StoredBatch store(long sessionId, long studentId, List<TelemetryEventRequest> events) {
		try {
			return this.transactionTemplate.execute(status -> storeOnce(sessionId, studentId, events));
		}
		catch (DataIntegrityViolationException ex) {
			return this.transactionTemplate.execute(status -> storeOnce(sessionId, studentId, events));
		}
	}

	private StoredBatch storeOnce(long sessionId, long studentId, List<TelemetryEventRequest> events) {
		CodingSession session = this.sessionService.requireOwnedSession(sessionId, studentId);
		checkOccurredAt(events, session.getStartedAt(), this.clock.instant());
		List<UUID> ids = events.stream().map(TelemetryEventRequest::clientEventId).toList();
		Set<UUID> seen = new HashSet<>(this.telemetryEventRepository.findStoredClientEventIds(sessionId, ids));
		List<TelemetryEvent> newEvents = new ArrayList<>();
		for (TelemetryEventRequest event : events) {
			if (seen.add(event.clientEventId())) {
				newEvents.add(event.toEntity(sessionId));
			}
		}
		List<TelemetryEvent> saved = this.telemetryEventRepository.saveAllAndFlush(newEvents);
		List<TelemetryEvent> runs = saved.stream()
			.filter(event -> event.getType() == EventType.RUN)
			.sorted(BY_OCCURRED_AT)
			.toList();
		ScoredBatch scored = this.sdiScoringService.score(session, runs);
		return new StoredBatch(saved.size(), events.size() - saved.size(), runs, scored.struggleLevel());
	}

	private static void checkOccurredAt(List<TelemetryEventRequest> events, Instant startedAt, Instant now) {
		Instant earliest = startedAt.minus(CLOCK_TOLERANCE);
		Instant latest = now.plus(CLOCK_TOLERANCE);
		Map<String, String> errors = new LinkedHashMap<>();
		for (int i = 0; i < events.size(); i++) {
			Instant occurredAt = events.get(i).occurredAt();
			if (occurredAt.isBefore(earliest)) {
				errors.put("events[" + i + "].occurredAt", "must not be more than 5 minutes before the session start");
			}
			else if (occurredAt.isAfter(latest)) {
				errors.put("events[" + i + "].occurredAt", "must not be more than 5 minutes in the future");
			}
		}
		if (!errors.isEmpty()) {
			throw new InvalidTelemetryBatchException(errors);
		}
	}

}

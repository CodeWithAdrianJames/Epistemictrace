package com.episteme.epistemictrace.sdi;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.episteme.epistemictrace.activity.SdiConfig;
import com.episteme.epistemictrace.activity.SdiConfigRepository;
import com.episteme.epistemictrace.config.SdiProperties;
import com.episteme.epistemictrace.session.CodingSession;
import com.episteme.epistemictrace.telemetry.TelemetryEvent;
import com.episteme.epistemictrace.telemetry.TelemetryEventRepository;

/**
 * Scores newly stored RUN events (spec 21 R1–R3, R6). Runs inside the caller's transaction: it sets {@code sdi_value}
 * on each run and raises the session's {@code peak_sdi}; the caller's transaction saves both. Weights and caps come from
 * {@link SdiProperties}, the window and threshold from the activity's {@code sdi_configs} row.
 */
@Service
public class SdiScoringService {

	private final TelemetryEventRepository telemetryEventRepository;

	private final SdiConfigRepository sdiConfigRepository;

	private final SdiProperties sdiProperties;

	public SdiScoringService(TelemetryEventRepository telemetryEventRepository,
			SdiConfigRepository sdiConfigRepository, SdiProperties sdiProperties) {
		this.telemetryEventRepository = telemetryEventRepository;
		this.sdiConfigRepository = sdiConfigRepository;
		this.sdiProperties = sdiProperties;
	}

	/**
	 * Scores {@code newRuns} (already stored, so they have ids) in session order. Each run is scored with the session's
	 * events ordered before it, including events of the same batch; runs scored earlier are never recomputed.
	 * @return the scores in session order with the level of the latest one, or {@link ScoredBatch#NONE} for no runs
	 * @throws IllegalStateException if the activity has no {@code sdi_configs} row
	 */
	public ScoredBatch score(CodingSession session, List<TelemetryEvent> newRuns) {
		if (newRuns.isEmpty()) {
			return ScoredBatch.NONE;
		}
		SdiConfig config = this.sdiConfigRepository.findByActivityId(session.getActivityId())
			.orElseThrow(() -> new IllegalStateException("Activity " + session.getActivityId() + " has no SDI config"));
		Instant latest = newRuns.stream().map(TelemetryEvent::getOccurredAt).max(Comparator.naturalOrder()).orElseThrow();
		// R6: one query per batch for everything the latest run can see; the calculator drops what comes after each run.
		List<SdiEvent> sessionEvents = this.telemetryEventRepository
			.findBySessionIdAndOccurredAtLessThanEqual(session.getId(), latest)
			.stream()
			.map(SdiScoringService::toSdiEvent)
			.toList();

		List<TelemetryEvent> ordered = new ArrayList<>(newRuns);
		ordered.sort(Comparator.comparing(SdiScoringService::toSdiEvent, SignalCalculator.ORDER));
		Duration window = Duration.ofMinutes(config.getWindowMinutes());
		SdiWeights weights = this.sdiProperties.toWeights();
		SignalTuning tuning = this.sdiProperties.toTuning();

		List<Integer> scores = new ArrayList<>(ordered.size());
		for (TelemetryEvent run : ordered) {
			int sdi = SdiEngine.compute(sessionEvents, toSdiEvent(run), window, tuning, weights);
			run.setSdiValue(sdi);
			session.recordSdi(sdi);
			scores.add(sdi);
		}
		int last = scores.get(scores.size() - 1);
		StruggleLevel level = StruggleLevels.of(last, this.sdiProperties.levels().mediumFrom(), config.getThreshold());
		return new ScoredBatch(scores, level, config);
	}

	private static SdiEvent toSdiEvent(TelemetryEvent event) {
		return new SdiEvent(event.getId(), event.getType(), event.getOccurredAt(), event.getPassedCount(),
				event.getErrorSignature());
	}

	/**
	 * Scores of a batch's new runs in session order, the level of the latest one and the activity's SDI config the scores
	 * were computed with. Without new runs ({@link #NONE}) the level and the config are {@code null}.
	 */
	public record ScoredBatch(List<Integer> scores, StruggleLevel struggleLevel, SdiConfig config) {

		public static final ScoredBatch NONE = new ScoredBatch(List.of(), null, null);

		public ScoredBatch {
			scores = List.copyOf(scores);
		}

	}

}

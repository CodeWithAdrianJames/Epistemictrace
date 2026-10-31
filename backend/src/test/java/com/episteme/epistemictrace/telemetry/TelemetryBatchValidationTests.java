package com.episteme.epistemictrace.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Spec 18 Part 1: each bean-validation rule of R2. The clock-dependent {@code occurredAt} range is a service rule. */
class TelemetryBatchValidationTests {

	private static final Instant AT = Instant.parse("2026-11-03T02:15:04.120Z");

	private static ValidatorFactory factory;

	private static Validator validator;

	@BeforeAll
	static void createValidator() {
		factory = Validation.buildDefaultValidatorFactory();
		validator = factory.getValidator();
	}

	@AfterAll
	static void closeValidator() {
		factory.close();
	}

	@Test
	void aBatchOfTheThreeTypesIsValid() {
		assertThat(errors(batch(edit(3, 0), error("NameError@3"), run(1, 4)))).isEmpty();
	}

	@Test
	void eventsMustBePresentAndHoldOneTo200Items() {
		assertThat(errors(new TelemetryBatchRequest(null))).containsOnlyKeys("events");
		assertThat(errors(new TelemetryBatchRequest(List.of()))).containsOnlyKeys("events");
		assertThat(errors(new TelemetryBatchRequest(Collections.nCopies(200, edit(1, 0))))).isEmpty();
		assertThat(errors(new TelemetryBatchRequest(Collections.nCopies(201, edit(1, 0))))).containsOnlyKeys("events");
	}

	@Test
	void aNullEventIsInvalid() {
		List<TelemetryEventRequest> events = new ArrayList<>();
		events.add(null);
		assertThat(errors(new TelemetryBatchRequest(events))).containsOnlyKeys("events[0].<list element>");
	}

	@Test
	void clientEventIdTypeAndOccurredAtAreRequired() {
		TelemetryEventRequest event = new TelemetryEventRequest(null, null, null, null, null, null, null, null, null);
		assertThat(errors(batch(event))).containsOnlyKeys("events[0].clientEventId", "events[0].type",
				"events[0].occurredAt");
	}

	@Test
	void editNeedsNonNegativeCountsWithAtLeastOneAboveZero() {
		assertThat(errors(batch(edit(0, 2)))).isEmpty();
		assertThat(errors(batch(edit(null, 2)))).containsOnlyKeys("events[0].charsAdded");
		assertThat(errors(batch(edit(1, null)))).containsOnlyKeys("events[0].charsRemoved");
		assertThat(errors(batch(edit(-1, 2)))).containsOnlyKeys("events[0].charsAdded");
		assertThat(errors(batch(edit(2, -1)))).containsOnlyKeys("events[0].charsRemoved");
		assertThat(errors(batch(edit(0, 0)))).containsEntry("events[0].charsAdded",
				"charsAdded or charsRemoved must be greater than 0");
	}

	@Test
	void editMustNotCarryRunOrErrorFields() {
		TelemetryEventRequest event = new TelemetryEventRequest(UUID.randomUUID(), EventType.EDIT, AT, 1, 0, 0, 1,
				"NameError@3", null);
		assertThat(errors(batch(event))).containsOnlyKeys("events[0].passedCount", "events[0].totalCount",
				"events[0].errorSignature");
	}

	@Test
	void runNeedsTotalOfAtLeastOneAndPassedWithinTotal() {
		assertThat(errors(batch(run(0, 1)))).isEmpty();
		assertThat(errors(batch(run(4, 4)))).isEmpty();
		assertThat(errors(batch(run(0, 0)))).containsOnlyKeys("events[0].totalCount");
		assertThat(errors(batch(run(5, 4)))).containsOnlyKeys("events[0].passedCount");
		assertThat(errors(batch(run(-1, 4)))).containsOnlyKeys("events[0].passedCount");
		assertThat(errors(batch(run(null, 4)))).containsOnlyKeys("events[0].passedCount");
		assertThat(errors(batch(run(1, null)))).containsOnlyKeys("events[0].totalCount");
	}

	@Test
	void runMustNotCarryEditOrErrorFields() {
		TelemetryEventRequest event = new TelemetryEventRequest(UUID.randomUUID(), EventType.RUN, AT, 1, 0, 1, 1,
				"NameError@3", null);
		assertThat(errors(batch(event))).containsOnlyKeys("events[0].charsAdded", "events[0].charsRemoved",
				"events[0].errorSignature");
	}

	@Test
	void errorSignatureIsOneTo200Characters() {
		assertThat(errors(batch(error("x".repeat(200))))).isEmpty();
		assertThat(errors(batch(error("x".repeat(201))))).containsOnlyKeys("events[0].errorSignature");
		assertThat(errors(batch(error("")))).containsOnlyKeys("events[0].errorSignature");
		assertThat(errors(batch(error(null)))).containsOnlyKeys("events[0].errorSignature");
	}

	@Test
	void errorMustNotCarryEditOrRunFields() {
		TelemetryEventRequest event = new TelemetryEventRequest(UUID.randomUUID(), EventType.ERROR, AT, 1, 0, 1, 1,
				"NameError@3", null);
		assertThat(errors(batch(event))).containsOnlyKeys("events[0].charsAdded", "events[0].charsRemoved",
				"events[0].passedCount", "events[0].totalCount");
	}

	@Test
	void sdiValueIsNeverAccepted() {
		TelemetryEventRequest event = new TelemetryEventRequest(UUID.randomUUID(), EventType.RUN, AT, null, null, 1, 4,
				null, 42);
		assertThat(errors(batch(event))).containsOnlyKeys("events[0].sdiValue");
	}

	@Test
	void violationsNameTheIndexOfTheEvent() {
		assertThat(errors(batch(edit(1, 0), run(5, 4)))).containsOnlyKeys("events[1].passedCount");
	}

	private static Map<String, String> errors(TelemetryBatchRequest request) {
		Map<String, String> errors = new TreeMap<>();
		for (ConstraintViolation<TelemetryBatchRequest> violation : validator.validate(request)) {
			errors.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage());
		}
		return errors;
	}

	private static TelemetryBatchRequest batch(TelemetryEventRequest... events) {
		return new TelemetryBatchRequest(List.of(events));
	}

	private static TelemetryEventRequest edit(Integer added, Integer removed) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.EDIT, AT, added, removed, null, null, null, null);
	}

	private static TelemetryEventRequest run(Integer passed, Integer total) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.RUN, AT, null, null, passed, total, null, null);
	}

	private static TelemetryEventRequest error(String signature) {
		return new TelemetryEventRequest(UUID.randomUUID(), EventType.ERROR, AT, null, null, null, null, signature,
				null);
	}

}

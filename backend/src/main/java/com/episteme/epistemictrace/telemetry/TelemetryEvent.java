package com.episteme.epistemictrace.telemetry;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "telemetry_events")
public class TelemetryEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "session_id", nullable = false)
	private Long sessionId;

	/** Set by the browser; unique per session so batch retries are idempotent. */
	@Column(name = "client_event_id", nullable = false)
	private UUID clientEventId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 8)
	private EventType type;

	/** Client clock. */
	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	@Column(name = "chars_added")
	private Integer charsAdded;

	@Column(name = "chars_removed")
	private Integer charsRemoved;

	@Column(name = "passed_count")
	private Integer passedCount;

	@Column(name = "total_count")
	private Integer totalCount;

	@Column(name = "error_signature", length = 200)
	private String errorSignature;

	@Column(name = "sdi_value")
	private Integer sdiValue;

	protected TelemetryEvent() {
	}

	public TelemetryEvent(Long sessionId, UUID clientEventId, EventType type, Instant occurredAt) {
		this.sessionId = sessionId;
		this.clientEventId = clientEventId;
		this.type = type;
		this.occurredAt = occurredAt;
	}

	public Long getId() {
		return this.id;
	}

	public Long getSessionId() {
		return this.sessionId;
	}

	public UUID getClientEventId() {
		return this.clientEventId;
	}

	public EventType getType() {
		return this.type;
	}

	public Instant getOccurredAt() {
		return this.occurredAt;
	}

	public Integer getCharsAdded() {
		return this.charsAdded;
	}

	public void setCharsAdded(Integer charsAdded) {
		this.charsAdded = charsAdded;
	}

	public Integer getCharsRemoved() {
		return this.charsRemoved;
	}

	public void setCharsRemoved(Integer charsRemoved) {
		this.charsRemoved = charsRemoved;
	}

	public Integer getPassedCount() {
		return this.passedCount;
	}

	public void setPassedCount(Integer passedCount) {
		this.passedCount = passedCount;
	}

	public Integer getTotalCount() {
		return this.totalCount;
	}

	public void setTotalCount(Integer totalCount) {
		this.totalCount = totalCount;
	}

	public String getErrorSignature() {
		return this.errorSignature;
	}

	public void setErrorSignature(String errorSignature) {
		this.errorSignature = errorSignature;
	}

	public Integer getSdiValue() {
		return this.sdiValue;
	}

	public void setSdiValue(Integer sdiValue) {
		this.sdiValue = sdiValue;
	}

}

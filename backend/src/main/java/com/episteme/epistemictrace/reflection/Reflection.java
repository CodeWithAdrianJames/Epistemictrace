package com.episteme.epistemictrace.reflection;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "reflections")
public class Reflection {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "session_id", nullable = false)
	private Long sessionId;

	@Column(nullable = false, columnDefinition = "text")
	private String hypothesis;

	@Column(name = "planned_fix", nullable = false, columnDefinition = "text")
	private String plannedFix;

	@Column(name = "sdi_at_trigger", nullable = false)
	private int sdiAtTrigger;

	@Column(name = "submitted_at", nullable = false, updatable = false)
	private Instant submittedAt;

	protected Reflection() {
	}

	public Reflection(Long sessionId, String hypothesis, String plannedFix, int sdiAtTrigger, Instant submittedAt) {
		this.sessionId = sessionId;
		this.hypothesis = hypothesis;
		this.plannedFix = plannedFix;
		this.sdiAtTrigger = sdiAtTrigger;
		this.submittedAt = submittedAt;
	}

	public Long getId() {
		return this.id;
	}

	public Long getSessionId() {
		return this.sessionId;
	}

	public String getHypothesis() {
		return this.hypothesis;
	}

	public String getPlannedFix() {
		return this.plannedFix;
	}

	public int getSdiAtTrigger() {
		return this.sdiAtTrigger;
	}

	public Instant getSubmittedAt() {
		return this.submittedAt;
	}

}

package com.episteme.epistemictrace.session;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.episteme.epistemictrace.breaker.BreakerState;

@Entity
@Table(name = "coding_sessions")
public class CodingSession {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "student_id", nullable = false)
	private Long studentId;

	@Column(name = "activity_id", nullable = false)
	private Long activityId;

	@Column(name = "started_at", nullable = false, updatable = false)
	private Instant startedAt;

	@Column(name = "ended_at")
	private Instant endedAt;

	@Column(name = "peak_sdi")
	private Integer peakSdi;

	/** Circuit-breaker state, kept server-side so the lock survives a refresh. */
	@Column(name = "runner_locked", nullable = false)
	private boolean runnerLocked;

	@Column(name = "sdi_at_lock")
	private Integer sdiAtLock;

	@Column(name = "cooldown_ends_at")
	private Instant cooldownEndsAt;

	protected CodingSession() {
	}

	public CodingSession(Long studentId, Long activityId, Instant startedAt) {
		this.studentId = studentId;
		this.activityId = activityId;
		this.startedAt = startedAt;
	}

	/** Reopens the session (spec 16 R1): it counts as running again until the next {@link #end}. */
	public void resume() {
		this.endedAt = null;
	}

	/** Records the end of the session; a later call replaces an earlier end (spec 16 R2). */
	public void end(Instant endedAt) {
		this.endedAt = endedAt;
	}

	/** Raises {@code peak_sdi} to {@code sdi} if it is higher (spec 21 R1). */
	public void recordSdi(int sdi) {
		if (this.peakSdi == null || sdi > this.peakSdi) {
			this.peakSdi = sdi;
		}
	}

	/** The circuit-breaker columns as one value (spec 22 R1). */
	public BreakerState breakerState() {
		return new BreakerState(this.runnerLocked, this.sdiAtLock, this.cooldownEndsAt);
	}

	/** Stores a breaker state computed by {@code BreakerRules} (spec 22 R6). */
	public void applyBreakerState(BreakerState state) {
		this.runnerLocked = state.locked();
		this.sdiAtLock = state.sdiAtLock();
		this.cooldownEndsAt = state.cooldownEndsAt();
	}

	public Long getId() {
		return this.id;
	}

	public Long getStudentId() {
		return this.studentId;
	}

	public Long getActivityId() {
		return this.activityId;
	}

	public Instant getStartedAt() {
		return this.startedAt;
	}

	public Instant getEndedAt() {
		return this.endedAt;
	}

	public Integer getPeakSdi() {
		return this.peakSdi;
	}

	public boolean isRunnerLocked() {
		return this.runnerLocked;
	}

	public Integer getSdiAtLock() {
		return this.sdiAtLock;
	}

	public Instant getCooldownEndsAt() {
		return this.cooldownEndsAt;
	}

}

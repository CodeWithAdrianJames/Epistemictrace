package com.episteme.epistemictrace.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sdi_configs")
public class SdiConfig {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/** Deleted with its activity by the database ({@code on delete cascade}). */
	@Column(name = "activity_id", nullable = false, unique = true)
	private Long activityId;

	@Column(nullable = false)
	private int threshold;

	@Column(name = "cooldown_seconds", nullable = false)
	private int cooldownSeconds;

	@Column(name = "window_minutes", nullable = false)
	private int windowMinutes;

	protected SdiConfig() {
	}

	public SdiConfig(Long activityId, int threshold, int cooldownSeconds, int windowMinutes) {
		this.activityId = activityId;
		this.threshold = threshold;
		this.cooldownSeconds = cooldownSeconds;
		this.windowMinutes = windowMinutes;
	}

	public Long getId() {
		return this.id;
	}

	public Long getActivityId() {
		return this.activityId;
	}

	public int getThreshold() {
		return this.threshold;
	}

	public int getCooldownSeconds() {
		return this.cooldownSeconds;
	}

	public int getWindowMinutes() {
		return this.windowMinutes;
	}

}

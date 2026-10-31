package com.episteme.epistemictrace.config;

import java.time.Duration;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import com.episteme.epistemictrace.sdi.SdiWeights;
import com.episteme.epistemictrace.sdi.SignalTuning;

/**
 * SDI configuration (spec 20 R5, Q1), bound from {@code epistemictrace.sdi}. Every value is required and validated,
 * so a missing value, weights that do not sum to 1 or a zero cap stop the application from starting.
 * {@code defaults} are copied into each new activity's {@code sdi_configs} row (spec 08 R3).
 */
@Validated
@ConfigurationProperties("epistemictrace.sdi")
public record SdiProperties(
		@NotNull @Valid Weights weights,
		@NotNull @Valid Caps caps,
		@NotNull @Valid Levels levels,
		@NotNull @Valid Defaults defaults) {

	public SdiWeights toWeights() {
		return new SdiWeights(this.weights.runFrequency(), this.weights.editToRun(), this.weights.repeatedErrors(),
				this.weights.noProgress());
	}

	public SignalTuning toTuning() {
		return new SignalTuning(this.caps.runCount(), this.caps.gap(), this.caps.repeats());
	}

	/** Signal weights; each in {@code [0, 1]}, summing to {@code 1 ± 0.001}. */
	public record Weights(
			@NotNull @DecimalMin("0") @DecimalMax("1") Double runFrequency,
			@NotNull @DecimalMin("0") @DecimalMax("1") Double editToRun,
			@NotNull @DecimalMin("0") @DecimalMax("1") Double repeatedErrors,
			@NotNull @DecimalMin("0") @DecimalMax("1") Double noProgress) {

		@AssertTrue(message = "must sum to 1 (run-frequency + edit-to-run + repeated-errors + no-progress)")
		public boolean isSumOne() {
			if (this.runFrequency == null || this.editToRun == null || this.repeatedErrors == null
					|| this.noProgress == null) {
				return true;
			}
			double sum = this.runFrequency + this.editToRun + this.repeatedErrors + this.noProgress;
			return Math.abs(sum - 1.0) <= 0.001;
		}

	}

	/** Normalization caps; each greater than zero. */
	public record Caps(@NotNull @Min(1) Integer runCount, @NotNull Duration gap, @NotNull @Min(1) Integer repeats) {

		@AssertTrue(message = "gap must be greater than 0")
		public boolean isGapPositive() {
			return this.gap == null || (!this.gap.isNegative() && !this.gap.isZero());
		}

	}

	/** SDI from which the level is {@code MEDIUM}; {@code HIGH} starts at the activity threshold. */
	public record Levels(@NotNull @Min(0) @Max(100) Integer mediumFrom) {

	}

	/** Copied into a new activity's {@code sdi_configs} row; follows that table's check constraints. */
	public record Defaults(
			@NotNull @Min(0) @Max(100) Integer threshold,
			@NotNull @Min(0) Integer cooldownSeconds,
			@NotNull @Min(1) Integer windowMinutes) {

	}

}

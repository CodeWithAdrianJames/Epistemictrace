package com.episteme.epistemictrace.breaker;

import java.time.Instant;

import com.episteme.epistemictrace.breaker.BreakerView.Status;

/**
 * The {@code breaker} object of session and events responses (spec 22 R7). Never contains the SDI at lock (R10).
 * @param state {@code UNLOCKED}, {@code LOCKED} or {@code COOLDOWN}
 * @param cooldownEndsAt end of the running cooldown, {@code null} unless {@code state} is {@code COOLDOWN}
 * @param reflectionMinLength minimum reflection field length, from {@code epistemictrace.reflection.min-length}
 */
public record BreakerPayload(Status state, Instant cooldownEndsAt, int reflectionMinLength) {

}

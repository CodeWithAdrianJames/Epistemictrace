package com.episteme.epistemictrace.telemetry;

import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * The per-type field rules of spec 18 R2. Each violation is reported on the field it concerns, so the {@code errors}
 * map of the {@code 400} names it (for example {@code events[2].passedCount}). An event without a type is left to
 * {@code @NotNull}.
 */
@Documented
@Constraint(validatedBy = ValidTelemetryEvent.Validator.class)
@Target(TYPE)
@Retention(RUNTIME)
public @interface ValidTelemetryEvent {

	int MAX_ERROR_SIGNATURE_LENGTH = 200;

	String message() default "is not a valid telemetry event";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<ValidTelemetryEvent, TelemetryEventRequest> {

		@Override
		public boolean isValid(TelemetryEventRequest event, ConstraintValidatorContext context) {
			if (event == null || event.type() == null) {
				return true;
			}
			Violations violations = new Violations(context);
			switch (event.type()) {
				case EDIT -> {
					violations.require(event.charsAdded() != null && event.charsAdded() >= 0, "charsAdded",
							"must be an integer of at least 0");
					violations.require(event.charsRemoved() != null && event.charsRemoved() >= 0, "charsRemoved",
							"must be an integer of at least 0");
					if (event.charsAdded() != null && event.charsRemoved() != null) {
						violations.require(event.charsAdded() > 0 || event.charsRemoved() > 0, "charsAdded",
								"charsAdded or charsRemoved must be greater than 0");
					}
					violations.absent(event.passedCount(), "passedCount", "EDIT");
					violations.absent(event.totalCount(), "totalCount", "EDIT");
					violations.absent(event.errorSignature(), "errorSignature", "EDIT");
				}
				case RUN -> {
					violations.require(event.totalCount() != null && event.totalCount() >= 1, "totalCount",
							"must be an integer of at least 1");
					violations.require(event.passedCount() != null && event.passedCount() >= 0
							&& (event.totalCount() == null || event.passedCount() <= event.totalCount()),
							"passedCount", "must be between 0 and totalCount");
					violations.absent(event.charsAdded(), "charsAdded", "RUN");
					violations.absent(event.charsRemoved(), "charsRemoved", "RUN");
					violations.absent(event.errorSignature(), "errorSignature", "RUN");
				}
				case ERROR -> {
					violations.require(event.errorSignature() != null && !event.errorSignature().isEmpty()
							&& event.errorSignature().length() <= MAX_ERROR_SIGNATURE_LENGTH, "errorSignature",
							"must be 1-" + MAX_ERROR_SIGNATURE_LENGTH + " characters");
					violations.absent(event.charsAdded(), "charsAdded", "ERROR");
					violations.absent(event.charsRemoved(), "charsRemoved", "ERROR");
					violations.absent(event.passedCount(), "passedCount", "ERROR");
					violations.absent(event.totalCount(), "totalCount", "ERROR");
				}
			}
			return violations.none();
		}

	}

	/** Collects field violations in place of the constraint's default message. */
	final class Violations {

		private final ConstraintValidatorContext context;

		private boolean found;

		Violations(ConstraintValidatorContext context) {
			this.context = context;
		}

		void require(boolean condition, String field, String message) {
			if (!condition) {
				add(field, message);
			}
		}

		void absent(Object value, String field, String type) {
			require(value == null, field, "must not be sent with a " + type + " event");
		}

		boolean none() {
			return !this.found;
		}

		private void add(String field, String message) {
			if (!this.found) {
				this.context.disableDefaultConstraintViolation();
				this.found = true;
			}
			this.context.buildConstraintViolationWithTemplate(message).addPropertyNode(field).addConstraintViolation();
		}

	}

}

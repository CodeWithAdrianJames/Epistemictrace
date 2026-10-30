package com.episteme.epistemictrace.common;

import static java.lang.annotation.ElementType.ANNOTATION_TYPE;
import static java.lang.annotation.ElementType.CONSTRUCTOR;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.TYPE_USE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * The annotated string must be at most {@link #value()} bytes when UTF-8 encoded. {@code null} is valid.
 * BCrypt rejects passwords over 72 bytes, so a 72-character password with non-ASCII characters
 * passes {@code @Size(max = 72)} but cannot be hashed.
 */
@Documented
@Constraint(validatedBy = MaxUtf8Bytes.Validator.class)
@Target({ METHOD, FIELD, ANNOTATION_TYPE, CONSTRUCTOR, PARAMETER, TYPE_USE })
@Retention(RUNTIME)
public @interface MaxUtf8Bytes {

	int value();

	String message() default "must be at most {value} bytes when UTF-8 encoded";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<MaxUtf8Bytes, CharSequence> {

		private int max;

		@Override
		public void initialize(MaxUtf8Bytes annotation) {
			this.max = annotation.value();
		}

		@Override
		public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
			return value == null || value.toString().getBytes(StandardCharsets.UTF_8).length <= this.max;
		}

	}

}

package com.episteme.epistemictrace.config;

import java.io.IOException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Renders access denied in the security filter chain (an authenticated user without the required role) as a
 * {@code 403} {@code ProblemDetail}. The exception is handed to Spring MVC's exception resolvers, so the body
 * comes from {@code GlobalExceptionHandler} like every other error. Unauthenticated requests never reach this
 * handler; they stay {@code 401} through the resource server's entry point.
 */
@Component
public class ProblemDetailAccessDeniedHandler implements AccessDeniedHandler {

	private final HandlerExceptionResolver handlerExceptionResolver;

	public ProblemDetailAccessDeniedHandler(
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver handlerExceptionResolver) {
		this.handlerExceptionResolver = handlerExceptionResolver;
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response,
			AccessDeniedException accessDeniedException) throws IOException, ServletException {
		if (this.handlerExceptionResolver.resolveException(request, response, null, accessDeniedException) == null) {
			throw accessDeniedException;
		}
	}

}

package com.episteme.epistemictrace.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

@Configuration
public class SecurityConfig {

	/** BCrypt cost factor (log2 rounds), accepted with Q3. */
	static final int BCRYPT_STRENGTH = 10;

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(BCRYPT_STRENGTH);
	}

	/**
	 * Keeps the default principal (a {@link org.springframework.security.oauth2.jwt.Jwt}, name = {@code sub});
	 * role authorities come from {@link JwtRoleConverter}. Spring Security 7 also adds {@code FACTOR_BEARER}.
	 */
	@Bean
	public JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(new JwtRoleConverter());
		return converter;
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder,
			JwtAuthenticationConverter jwtAuthenticationConverter, AccessDeniedHandler accessDeniedHandler)
			throws Exception {
		http
				// Uses the corsConfigurationSource bean from CorsConfig; runs before authentication.
				.cors(Customizer.withDefaults())
				// Bearer tokens only, no cookies, so CSRF protection is not needed.
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/health").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
						.anyRequest().authenticated())
				// Overrides the resource server's default handler, which answers 403 with an empty body.
				.exceptionHandling(exceptions -> exceptions.accessDeniedHandler(accessDeniedHandler))
				.oauth2ResourceServer(resourceServer -> resourceServer.jwt(jwt -> jwt
						.decoder(jwtDecoder)
						.jwtAuthenticationConverter(jwtAuthenticationConverter)));
		return http.build();
	}

}

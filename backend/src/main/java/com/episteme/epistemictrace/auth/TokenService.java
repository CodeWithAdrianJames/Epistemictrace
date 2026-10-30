package com.episteme.epistemictrace.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import com.episteme.epistemictrace.config.JwtProperties;
import com.episteme.epistemictrace.user.User;

/**
 * Issues HS256 access tokens with the {@link JwtEncoder} from {@code JwtConfig}. The encoder is built with
 * {@code algorithm(HS256)}, so no explicit {@code JwsHeader} is needed.
 */
@Service
public class TokenService {

	static final String ROLE_CLAIM = "role";

	static final String EMAIL_CLAIM = "email";

	private final JwtEncoder jwtEncoder;

	private final JwtProperties jwtProperties;

	public TokenService(JwtEncoder jwtEncoder, JwtProperties jwtProperties) {
		this.jwtEncoder = jwtEncoder;
		this.jwtProperties = jwtProperties;
	}

	/**
	 * Claims: {@code sub} = user id, {@code role}, {@code email}, {@code iat} = now and
	 * {@code exp} = {@code iat} + {@code epistemictrace.jwt.ttl}.
	 */
	public Jwt issue(User user) {
		// JWT timestamps have whole-second precision; truncating keeps the returned expiry equal to the exp claim.
		Instant issuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS);
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.subject(String.valueOf(user.getId()))
				.claim(ROLE_CLAIM, user.getRole().name())
				.claim(EMAIL_CLAIM, user.getEmail())
				.issuedAt(issuedAt)
				.expiresAt(issuedAt.plus(this.jwtProperties.ttl()))
				.build();
		return this.jwtEncoder.encode(JwtEncoderParameters.from(claims));
	}

}

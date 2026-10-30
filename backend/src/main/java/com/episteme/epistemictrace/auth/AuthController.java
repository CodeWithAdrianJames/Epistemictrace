package com.episteme.epistemictrace.auth;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.auth.AuthService.LoginResult;
import com.episteme.epistemictrace.user.User;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
		User user = this.authService.register(request.name(), request.email(), request.password());
		return RegisterResponse.from(user);
	}

	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		LoginResult result = this.authService.login(request.email(), request.password());
		return new LoginResponse(result.token().getTokenValue(), result.token().getExpiresAt(),
				UserResponse.from(result.user()));
	}

	@GetMapping("/me")
	public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
		return UserResponse.from(this.authService.currentUser(jwt.getSubject()));
	}

}

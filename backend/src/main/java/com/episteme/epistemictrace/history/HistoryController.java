package com.episteme.epistemictrace.history;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.episteme.epistemictrace.config.CurrentUser;

/**
 * Student session history (spec 26). Role {@code STUDENT} is enforced by {@code SecurityConfig} ({@code /api/me/**});
 * an out-of-range {@code page} or {@code size} is a {@code 400}.
 */
@RestController
@RequestMapping("/api/me/sessions")
public class HistoryController {

	private final HistoryService historyService;

	private final CurrentUser currentUser;

	public HistoryController(HistoryService historyService, CurrentUser currentUser) {
		this.historyService = historyService;
		this.currentUser = currentUser;
	}

	@GetMapping
	public HistoryPage list(@RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
		return this.historyService.list(this.currentUser.id(), page, size);
	}

	@GetMapping("/{id}")
	public HistoryDetail detail(@PathVariable long id) {
		return this.historyService.detail(id, this.currentUser.id());
	}

}

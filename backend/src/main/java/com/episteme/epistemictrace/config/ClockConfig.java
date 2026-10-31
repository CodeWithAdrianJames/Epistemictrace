package com.episteme.epistemictrace.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Server time for services that store timestamps (spec 16 R4). Tests replace this bean to fix the time. */
@Configuration
public class ClockConfig {

	@Bean
	public Clock clock() {
		return Clock.systemUTC();
	}

}

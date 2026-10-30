package com.episteme.epistemictrace;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class EpistemictraceApplicationTests {

	@Test
	void contextLoads() {
		org.junit.jupiter.api.Assertions.fail("Deliberate failure for CI verification");
	}

}

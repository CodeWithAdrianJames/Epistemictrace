package com.episteme.epistemictrace.activity;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.episteme.epistemictrace.user.Role;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/** Spec 08 Part 4: student reads of published activities ({@code GET} list, {@code GET} one). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudentActivityControllerTests {

	private static final String BASE = "/api/activities";

	private static final String INSTRUCTOR_BASE = "/api/instructor/activities";

	private static final String DENIED_DETAIL = "You don't have access to this.";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	private User instructor;

	private User otherInstructor;

	private String studentToken;

	private String instructorToken;

	@BeforeEach
	void createUsers() {
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.otherInstructor = this.userRepository
			.save(new User("Instructor Two", "instructor2@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		User student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.studentToken = token(student);
		this.instructorToken = token(this.instructor);
	}

	@AfterEach
	void deleteData() {
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	// GET /api/activities

	@Test
	void listShowsOnlyPublishedActivitiesOfEveryInstructorByTitle() throws Exception {
		Activity loops = saveActivity(this.instructor, "Loops", ActivityStatus.PUBLISHED, 2);
		saveActivity(this.instructor, "A draft", ActivityStatus.DRAFT, 1);
		saveActivity(this.instructor, "An archived one", ActivityStatus.ARCHIVED, 1);
		Activity arrays = saveActivity(this.otherInstructor, "arrays", ActivityStatus.PUBLISHED, 3);
		Activity functions = saveActivity(this.instructor, "Functions", ActivityStatus.PUBLISHED, 1);

		perform(get(BASE), this.studentToken)
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[0].id").value(arrays.getId()))
			.andExpect(jsonPath("$[1].id").value(functions.getId()))
			.andExpect(jsonPath("$[2].id").value(loops.getId()))
			.andExpect(jsonPath("$[2].title").value("Loops"))
			.andExpect(jsonPath("$[2].status").value("PUBLISHED"))
			.andExpect(jsonPath("$[2].testCaseCount").value(2))
			.andExpect(jsonPath("$[2].updatedAt").isString())
			.andExpect(jsonPath("$[0].testCaseCount").value(3));
	}

	@Test
	void listOrdersEqualTitlesByOldestId() throws Exception {
		Activity first = saveActivity(this.instructor, "Sum", ActivityStatus.PUBLISHED, 1);
		Activity second = saveActivity(this.otherInstructor, "Sum", ActivityStatus.PUBLISHED, 1);

		perform(get(BASE), this.studentToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].id").value(first.getId()))
			.andExpect(jsonPath("$[1].id").value(second.getId()));
	}

	@Test
	void listIsEmptyWithoutPublishedActivities() throws Exception {
		saveActivity(this.instructor, "A draft", ActivityStatus.DRAFT, 1);
		saveActivity(this.instructor, "An archived one", ActivityStatus.ARCHIVED, 1);

		perform(get(BASE), this.studentToken)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void listFollowsPublishAndArchive() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 1);

		perform(get(BASE), this.studentToken).andExpect(jsonPath("$", hasSize(0)));
		perform(post(INSTRUCTOR_BASE + "/" + activity.getId() + "/publish"), this.instructorToken)
			.andExpect(status().isOk());
		perform(get(BASE), this.studentToken)
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].id").value(activity.getId()));
		perform(get(BASE + "/" + activity.getId()), this.studentToken).andExpect(status().isOk());
		perform(post(INSTRUCTOR_BASE + "/" + activity.getId() + "/archive"), this.instructorToken)
			.andExpect(status().isOk());
		perform(get(BASE), this.studentToken).andExpect(jsonPath("$", hasSize(0)));
		perform(get(BASE + "/" + activity.getId()), this.studentToken).andExpect(status().isNotFound());
	}

	@Test
	void listWithoutTokenIs401() throws Exception {
		perform(get(BASE), null).andExpect(status().isUnauthorized());
	}

	@Test
	void listAsInstructorIs403() throws Exception {
		perform(get(BASE), this.instructorToken)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	// GET /api/activities/{id}

	@Test
	void getPublishedReturnsDetailWithHiddenTestDataInPositionOrder() throws Exception {
		Activity activity = new Activity(this.otherInstructor.getId(), "Sum", "Print a + b.", "print()\n",
				ActivityStatus.PUBLISHED);
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		activity = this.activityRepository.save(activity);

		perform(get(BASE + "/" + activity.getId()), this.studentToken)
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").value(activity.getId()))
			.andExpect(jsonPath("$.title").value("Sum"))
			.andExpect(jsonPath("$.problemStatement").value("Print a + b."))
			.andExpect(jsonPath("$.starterCode").value("print()\n"))
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.createdAt").isString())
			.andExpect(jsonPath("$.updatedAt").isString())
			.andExpect(jsonPath("$.testCases", hasSize(2)))
			.andExpect(jsonPath("$.testCases[0].id").isNumber())
			.andExpect(jsonPath("$.testCases[0].position").value(1))
			.andExpect(jsonPath("$.testCases[0].input").value("1 2\n"))
			.andExpect(jsonPath("$.testCases[0].expectedOutput").value("3\n"))
			.andExpect(jsonPath("$.testCases[0].hidden").value(false))
			.andExpect(jsonPath("$.testCases[1].position").value(2))
			.andExpect(jsonPath("$.testCases[1].input").value("3 4\n"))
			.andExpect(jsonPath("$.testCases[1].expectedOutput").value("7\n"))
			.andExpect(jsonPath("$.testCases[1].hidden").value(true));
	}

	@Test
	void getDraftIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 1);

		assertActivityNotFound(perform(get(BASE + "/" + activity.getId()), this.studentToken));
	}

	@Test
	void getArchivedIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.ARCHIVED, 1);

		assertActivityNotFound(perform(get(BASE + "/" + activity.getId()), this.studentToken));
	}

	@Test
	void getMissingIs404() throws Exception {
		assertActivityNotFound(perform(get(BASE + "/999999"), this.studentToken));
	}

	@Test
	void getWithNonNumericIdIs400() throws Exception {
		perform(get(BASE + "/abc"), this.studentToken).andExpect(status().isBadRequest());
	}

	@Test
	void getWithoutTokenIs401() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.PUBLISHED, 1);

		perform(get(BASE + "/" + activity.getId()), null).andExpect(status().isUnauthorized());
	}

	@Test
	void getAsInstructorIs403EvenForOwnActivity() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.PUBLISHED, 1);

		perform(get(BASE + "/" + activity.getId()), this.instructorToken)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	private static void assertActivityNotFound(ResultActions result) throws Exception {
		result.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Activity not found."));
	}

	private ResultActions perform(MockHttpServletRequestBuilder request, String token) throws Exception {
		request.header(HttpHeaders.ACCEPT, "application/json, application/problem+json");
		if (token != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}
		return this.mockMvc.perform(request);
	}

	private Activity saveActivity(User owner, String title, ActivityStatus status, int testCaseCount) {
		Activity activity = new Activity(owner.getId(), title, "Statement for " + title, "", status);
		for (int position = 1; position <= testCaseCount; position++) {
			activity.addTestCase(new TestCase(position, "in " + position + "\n", "out " + position + "\n", false));
		}
		return this.activityRepository.save(activity);
	}

	private String token(User user) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.subject(String.valueOf(user.getId()))
			.claim("role", user.getRole().name())
			.claim("email", user.getEmail())
			.issuedAt(now)
			.expiresAt(now.plus(5, ChronoUnit.MINUTES))
			.build();
		return this.jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
	}

}

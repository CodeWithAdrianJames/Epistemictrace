package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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

import tools.jackson.databind.ObjectMapper;

/**
 * Spec 08 Parts 1–3: instructor activity CRUD ({@code GET}/{@code POST} list, {@code GET}/{@code PUT} one), the
 * publish and archive transitions, and the test-case endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InstructorActivityControllerTests {

	private static final String BASE = "/api/instructor/activities";

	private static final String DENIED_DETAIL = "You don't have access to this.";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ActivityRepository activityRepository;

	@Autowired
	private SdiConfigRepository sdiConfigRepository;

	private User instructor;

	private User otherInstructor;

	private String instructorToken;

	private String otherInstructorToken;

	private String studentToken;

	@BeforeEach
	void createUsers() {
		this.instructor = this.userRepository
			.save(new User("Instructor One", "instructor1@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		this.otherInstructor = this.userRepository
			.save(new User("Instructor Two", "instructor2@example.test", "not-a-real-hash", Role.INSTRUCTOR));
		User student = this.userRepository
			.save(new User("Student One", "student1@example.test", "not-a-real-hash", Role.STUDENT));
		this.instructorToken = token(this.instructor);
		this.otherInstructorToken = token(this.otherInstructor);
		this.studentToken = token(student);
	}

	@AfterEach
	void deleteData() {
		this.activityRepository.deleteAll();
		this.userRepository.deleteAll();
	}

	// POST /api/instructor/activities

	@Test
	void createReturns201WithDraftDetail() throws Exception {
		perform(post(BASE), this.instructorToken,
				body("  Sum two numbers  ", "Read two integers and print their sum.", "a, b = 0, 0\n"))
			.andExpect(status().isCreated())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.title").value("Sum two numbers"))
			.andExpect(jsonPath("$.problemStatement").value("Read two integers and print their sum."))
			.andExpect(jsonPath("$.starterCode").value("a, b = 0, 0\n"))
			.andExpect(jsonPath("$.status").value("DRAFT"))
			.andExpect(jsonPath("$.testCases", hasSize(0)))
			.andExpect(jsonPath("$.createdAt").isString())
			.andExpect(jsonPath("$.updatedAt").isString());

		assertThat(this.activityRepository.findAll()).singleElement().satisfies(activity -> {
			assertThat(activity.getInstructorId()).isEqualTo(this.instructor.getId());
			assertThat(activity.getTitle()).isEqualTo("Sum two numbers");
			assertThat(activity.getStatus()).isEqualTo(ActivityStatus.DRAFT);
		});
	}

	@Test
	void createAddsOneSdiConfigRowWithConfiguredDefaults() throws Exception {
		long id = createdId(perform(post(BASE), this.instructorToken, body("Loops", "Print 1 to 5.", ""))
			.andExpect(status().isCreated()));

		assertThat(this.sdiConfigRepository.findAll()).singleElement().satisfies(config -> {
			assertThat(config.getActivityId()).isEqualTo(id);
			assertThat(config.getThreshold()).isEqualTo(70);
			assertThat(config.getCooldownSeconds()).isEqualTo(600);
			assertThat(config.getWindowMinutes()).isEqualTo(5);
		});
	}

	@Test
	void createWithoutStarterCodeStoresEmptyString() throws Exception {
		perform(post(BASE), this.instructorToken, "{\"title\":\"Loops\",\"problemStatement\":\"Print 1 to 5.\"}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.starterCode").value(""));
	}

	@Test
	void createAcceptsValuesAtTheLimits() throws Exception {
		String title = "  " + "t".repeat(120) + "  ";
		perform(post(BASE), this.instructorToken, body(title, "s".repeat(20_000), "c".repeat(20_000)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.title").value("t".repeat(120)));

		perform(post(BASE), this.instructorToken, body("x", "s", ""))
			.andExpect(status().isCreated());
	}

	@Test
	void createRejectsMissingAndBlankFields() throws Exception {
		perform(post(BASE), this.instructorToken, "{}")
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors.title").exists())
			.andExpect(jsonPath("$.errors.problemStatement").exists())
			.andExpect(jsonPath("$.errors.starterCode").doesNotExist());

		perform(post(BASE), this.instructorToken, body("   ", "  \n ", ""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.title").exists())
			.andExpect(jsonPath("$.errors.problemStatement").exists());

		assertThat(this.activityRepository.count()).isZero();
		assertThat(this.sdiConfigRepository.count()).isZero();
	}

	@Test
	void createRejectsValuesOverTheLimits() throws Exception {
		perform(post(BASE), this.instructorToken, body("t".repeat(121), "s".repeat(20_001), "c".repeat(20_001)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.title").exists())
			.andExpect(jsonPath("$.errors.problemStatement").exists())
			.andExpect(jsonPath("$.errors.starterCode").exists());

		assertThat(this.activityRepository.count()).isZero();
	}

	@Test
	void createWithoutTokenIs401AndAsStudentIs403() throws Exception {
		perform(post(BASE), null, body("Loops", "Print 1 to 5.", "")).andExpect(status().isUnauthorized());
		perform(post(BASE), this.studentToken, body("Loops", "Print 1 to 5.", ""))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.activityRepository.count()).isZero();
	}

	// GET /api/instructor/activities

	@Test
	void listReturnsOwnActivitiesInEveryStatusMostRecentlyUpdatedFirst() throws Exception {
		Activity draft = saveActivity(this.instructor, "Draft one", ActivityStatus.DRAFT, 2);
		Activity published = saveActivity(this.instructor, "Published one", ActivityStatus.PUBLISHED, 1);
		Activity archived = saveActivity(this.instructor, "Archived one", ActivityStatus.ARCHIVED, 0);
		saveActivity(this.otherInstructor, "Not mine", ActivityStatus.PUBLISHED, 1);
		Instant base = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(published, base);
		setUpdatedAt(draft, base.plusSeconds(60));
		setUpdatedAt(archived, base.plusSeconds(30));

		perform(get(BASE), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[0].id").value(draft.getId()))
			.andExpect(jsonPath("$[0].title").value("Draft one"))
			.andExpect(jsonPath("$[0].status").value("DRAFT"))
			.andExpect(jsonPath("$[0].testCaseCount").value(2))
			.andExpect(jsonPath("$[0].updatedAt").value("2026-10-01T08:01:00Z"))
			.andExpect(jsonPath("$[1].id").value(archived.getId()))
			.andExpect(jsonPath("$[1].status").value("ARCHIVED"))
			.andExpect(jsonPath("$[1].testCaseCount").value(0))
			.andExpect(jsonPath("$[2].id").value(published.getId()))
			.andExpect(jsonPath("$[2].status").value("PUBLISHED"))
			.andExpect(jsonPath("$[2].testCaseCount").value(1))
			.andExpect(jsonPath("$[0].problemStatement").doesNotExist());
	}

	@Test
	void listIsEmptyWhenTheInstructorHasNoActivities() throws Exception {
		saveActivity(this.otherInstructor, "Not mine", ActivityStatus.DRAFT, 0);

		perform(get(BASE), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void listAfterUpdateMovesTheEditedActivityFirst() throws Exception {
		Activity older = saveActivity(this.instructor, "Older", ActivityStatus.DRAFT, 0);
		Activity newer = saveActivity(this.instructor, "Newer", ActivityStatus.DRAFT, 0);
		setUpdatedAt(older, Instant.parse("2026-10-01T08:00:00Z"));
		setUpdatedAt(newer, Instant.parse("2026-10-02T08:00:00Z"));

		perform(put(BASE + "/" + older.getId()), this.instructorToken, body("Older, edited", "Statement", ""))
			.andExpect(status().isOk());

		perform(get(BASE), this.instructorToken, null)
			.andExpect(jsonPath("$[0].id").value(older.getId()))
			.andExpect(jsonPath("$[0].title").value("Older, edited"))
			.andExpect(jsonPath("$[1].id").value(newer.getId()));
	}

	@Test
	void listAsStudentIs403() throws Exception {
		perform(get(BASE), this.studentToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	// GET /api/instructor/activities/{id}

	@Test
	void getReturnsDetailWithTestCasesInPositionOrderIncludingHiddenData() throws Exception {
		Activity activity = new Activity(this.instructor.getId(), "Sum", "Print a + b.", "print()\n",
				ActivityStatus.PUBLISHED);
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		activity = this.activityRepository.save(activity);

		perform(get(BASE + "/" + activity.getId()), this.instructorToken, null)
			.andExpect(status().isOk())
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
	void getAnotherInstructorsActivityIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);

		perform(get(BASE + "/" + activity.getId()), this.otherInstructorToken, null)
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(403))
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL))
			.andExpect(jsonPath("$.problemStatement").doesNotExist());
	}

	@Test
	void getMissingActivityIs404() throws Exception {
		perform(get(BASE + "/999999"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Activity not found."));
	}

	@Test
	void getWithNonNumericIdIs400() throws Exception {
		perform(get(BASE + "/abc"), this.instructorToken, null).andExpect(status().isBadRequest());
	}

	// PUT /api/instructor/activities/{id}

	@Test
	void updateReturns200WithNewValuesAndKeepsStatusAndTestCases() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old title", ActivityStatus.PUBLISHED, 2);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);
		// Read back rather than truncating the in-memory value: the database rounds to microseconds (H2 rounds half
		// up), so truncation fails whenever the sub-microsecond part of Instant.now() is 500 ns or more.
		Instant createdAt = this.activityRepository.findById(activity.getId()).orElseThrow().getCreatedAt();

		perform(put(BASE + "/" + activity.getId()), this.instructorToken,
				body("  New title ", "New statement.", "# new starter\n"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(activity.getId()))
			.andExpect(jsonPath("$.title").value("New title"))
			.andExpect(jsonPath("$.problemStatement").value("New statement."))
			.andExpect(jsonPath("$.starterCode").value("# new starter\n"))
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.testCases", hasSize(2)));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTitle()).isEqualTo("New title");
		assertThat(reloaded.getProblemStatement()).isEqualTo("New statement.");
		assertThat(reloaded.getStarterCode()).isEqualTo("# new starter\n");
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(reloaded.getTestCases()).hasSize(2);
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
		assertThat(reloaded.getCreatedAt()).isEqualTo(createdAt);
	}

	@Test
	void updateArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Archived", ActivityStatus.ARCHIVED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(put(BASE + "/" + activity.getId()), this.instructorToken, body("Changed", "Changed.", ""))
			.andExpect(status().isConflict())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));

		Activity reloaded = this.activityRepository.findById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTitle()).isEqualTo("Archived");
		assertThat(reloaded.getUpdatedAt()).isEqualTo(before);
	}

	@Test
	void updateAnotherInstructorsActivityIs403AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 0);

		perform(put(BASE + "/" + activity.getId()), this.otherInstructorToken, body("Taken", "Taken.", ""))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getTitle()).isEqualTo("Mine");
	}

	@Test
	void updateMissingActivityIs404() throws Exception {
		perform(put(BASE + "/999999"), this.instructorToken, body("Title", "Statement.", ""))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));
	}

	@Test
	void updateWithInvalidBodyIs400AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 0);

		perform(put(BASE + "/" + activity.getId()), this.instructorToken, body(" ", "s".repeat(20_001), ""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.title").exists())
			.andExpect(jsonPath("$.errors.problemStatement").exists());

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getTitle()).isEqualTo("Mine");
	}

	@Test
	void updateAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 0);

		perform(put(BASE + "/" + activity.getId()), this.studentToken, body("Taken", "Taken.", ""))
			.andExpect(status().isForbidden());

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getTitle()).isEqualTo("Mine");
	}

	// POST /api/instructor/activities/{id}/publish

	@Test
	void publishDraftWithTestCasesReturns200PublishedDetail() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 2);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/publish"), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").value(activity.getId()))
			.andExpect(jsonPath("$.title").value("Sum"))
			.andExpect(jsonPath("$.problemStatement").value("Statement for Sum"))
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.testCases", hasSize(2)))
			.andExpect(jsonPath("$.testCases[0].position").value(1))
			.andExpect(jsonPath("$.testCases[1].position").value(2))
			.andExpect(jsonPath("$.createdAt").isString())
			.andExpect(jsonPath("$.updatedAt").isString());

		Activity reloaded = this.activityRepository.findById(activity.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
	}

	@Test
	void publishDraftWithoutTestCasesIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Empty", ActivityStatus.DRAFT, 0);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/publish"), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(409))
			.andExpect(jsonPath("$.detail").value("Add at least one test case before publishing."));

		assertStatusAndUpdatedAt(activity, ActivityStatus.DRAFT, before);
	}

	@Test
	void publishAlreadyPublishedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Live", ActivityStatus.PUBLISHED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/publish"), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("This activity is already published."));

		assertStatusAndUpdatedAt(activity, ActivityStatus.PUBLISHED, before);
	}

	@Test
	void publishArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/publish"), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));

		assertStatusAndUpdatedAt(activity, ActivityStatus.ARCHIVED, before);
	}

	@Test
	void publishAnotherInstructorsActivityIs403AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/publish"), this.otherInstructorToken, null)
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertStatusAndUpdatedAt(activity, ActivityStatus.DRAFT, before);
	}

	@Test
	void publishMissingActivityIs404() throws Exception {
		perform(post(BASE + "/999999/publish"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Activity not found."));
	}

	@Test
	void publishWithNonNumericIdIs400() throws Exception {
		perform(post(BASE + "/abc/publish"), this.instructorToken, null).andExpect(status().isBadRequest());
	}

	@Test
	void publishWithoutTokenIs401AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);

		perform(post(BASE + "/" + activity.getId() + "/publish"), null, null).andExpect(status().isUnauthorized());
		perform(post(BASE + "/" + activity.getId() + "/publish"), this.studentToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getStatus())
			.isEqualTo(ActivityStatus.DRAFT);
	}

	// POST /api/instructor/activities/{id}/archive

	@Test
	void archiveDraftReturns200ArchivedDetail() throws Exception {
		Activity activity = saveActivity(this.instructor, "Draft", ActivityStatus.DRAFT, 0);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/archive"), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").value(activity.getId()))
			.andExpect(jsonPath("$.title").value("Draft"))
			.andExpect(jsonPath("$.status").value("ARCHIVED"))
			.andExpect(jsonPath("$.testCases", hasSize(0)));

		Activity reloaded = this.activityRepository.findById(activity.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.ARCHIVED);
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
	}

	@Test
	void archivePublishedReturns200ArchivedDetailWithTestCases() throws Exception {
		Activity activity = saveActivity(this.instructor, "Live", ActivityStatus.PUBLISHED, 2);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/archive"), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ARCHIVED"))
			.andExpect(jsonPath("$.testCases", hasSize(2)));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.ARCHIVED);
		assertThat(reloaded.getTestCases()).hasSize(2);
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
	}

	@Test
	void archiveAlreadyArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/archive"), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(409))
			.andExpect(jsonPath("$.detail").value("This activity is already archived."));

		assertStatusAndUpdatedAt(activity, ActivityStatus.ARCHIVED, before);
	}

	@Test
	void archiveAnotherInstructorsActivityIs403AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.PUBLISHED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(BASE + "/" + activity.getId() + "/archive"), this.otherInstructorToken, null)
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertStatusAndUpdatedAt(activity, ActivityStatus.PUBLISHED, before);
	}

	@Test
	void archiveMissingActivityIs404() throws Exception {
		perform(post(BASE + "/999999/archive"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Activity not found."));
	}

	@Test
	void archiveWithoutTokenIs401AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.PUBLISHED, 1);

		perform(post(BASE + "/" + activity.getId() + "/archive"), null, null).andExpect(status().isUnauthorized());
		perform(post(BASE + "/" + activity.getId() + "/archive"), this.studentToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getStatus())
			.isEqualTo(ActivityStatus.PUBLISHED);
	}

	@Test
	void archivedActivityRejectsUpdateAndPublishAfterArchive() throws Exception {
		Activity activity = saveActivity(this.instructor, "Live", ActivityStatus.PUBLISHED, 1);

		perform(post(BASE + "/" + activity.getId() + "/archive"), this.instructorToken, null)
			.andExpect(status().isOk());

		perform(put(BASE + "/" + activity.getId()), this.instructorToken, body("Changed", "Changed.", ""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));
		perform(post(BASE + "/" + activity.getId() + "/publish"), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));
		perform(get(BASE), this.instructorToken, null)
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].status").value("ARCHIVED"));
	}

	// GET /api/instructor/activities/{id}/test-cases

	@Test
	void listTestCasesReturnsPositionOrderIncludingHiddenData() throws Exception {
		Activity activity = new Activity(this.instructor.getId(), "Sum", "Print a + b.", "", ActivityStatus.DRAFT);
		activity.addTestCase(new TestCase(2, "3 4\n", "7\n", true));
		activity.addTestCase(new TestCase(1, "1 2\n", "3\n", false));
		activity = this.activityRepository.save(activity);

		perform(get(testCasesPath(activity)), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].id").isNumber())
			.andExpect(jsonPath("$[0].position").value(1))
			.andExpect(jsonPath("$[0].input").value("1 2\n"))
			.andExpect(jsonPath("$[0].expectedOutput").value("3\n"))
			.andExpect(jsonPath("$[0].hidden").value(false))
			.andExpect(jsonPath("$[1].position").value(2))
			.andExpect(jsonPath("$[1].input").value("3 4\n"))
			.andExpect(jsonPath("$[1].expectedOutput").value("7\n"))
			.andExpect(jsonPath("$[1].hidden").value(true));
	}

	@Test
	void listTestCasesOfArchivedActivityIs200AndEmptyActivityIsEmptyList() throws Exception {
		Activity archived = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 2);
		Activity empty = saveActivity(this.instructor, "Empty", ActivityStatus.DRAFT, 0);

		perform(get(testCasesPath(archived)), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)));
		perform(get(testCasesPath(empty)), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void listTestCasesOfAnotherInstructorsActivityIs403AndMissingIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);

		perform(get(testCasesPath(activity)), this.otherInstructorToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL))
			.andExpect(jsonPath("$[0]").doesNotExist());
		perform(get(BASE + "/999999/test-cases"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));
		perform(get(BASE + "/abc/test-cases"), this.instructorToken, null).andExpect(status().isBadRequest());
	}

	@Test
	void listTestCasesWithoutTokenIs401AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.PUBLISHED, 1);

		perform(get(testCasesPath(activity)), null, null).andExpect(status().isUnauthorized());
		perform(get(testCasesPath(activity)), this.studentToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
	}

	// POST /api/instructor/activities/{id}/test-cases

	@Test
	void addTestCaseReturns201AtNextPositionAndChangesUpdatedAt() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 2);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("5 6\n", "11\n", true))
			.andExpect(status().isCreated())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.position").value(3))
			.andExpect(jsonPath("$.input").value("5 6\n"))
			.andExpect(jsonPath("$.expectedOutput").value("11\n"))
			.andExpect(jsonPath("$.hidden").value(true));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTestCases()).extracting(TestCase::getPosition).containsExactly(1, 2, 3);
		assertThat(reloaded.getTestCases().get(2)).satisfies(testCase -> {
			assertThat(testCase.getInput()).isEqualTo("5 6\n");
			assertThat(testCase.getExpectedOutput()).isEqualTo("11\n");
			assertThat(testCase.isHidden()).isTrue();
		});
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
	}

	@Test
	void addTestCaseWithoutInputAndHiddenStoresEmptyInputAndVisibleTest() throws Exception {
		Activity activity = saveActivity(this.instructor, "Hello", ActivityStatus.DRAFT, 0);

		perform(post(testCasesPath(activity)), this.instructorToken, "{\"expectedOutput\":\"Hello\\n\"}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.position").value(1))
			.andExpect(jsonPath("$.input").value(""))
			.andExpect(jsonPath("$.expectedOutput").value("Hello\n"))
			.andExpect(jsonPath("$.hidden").value(false));
	}

	@Test
	void addTestCaseToPublishedActivityIs201() throws Exception {
		Activity activity = saveActivity(this.instructor, "Live", ActivityStatus.PUBLISHED, 1);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.position").value(2));

		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getStatus())
			.isEqualTo(ActivityStatus.PUBLISHED);
	}

	@Test
	void addTestCaseAcceptsValuesAtTheLimits() throws Exception {
		Activity activity = saveActivity(this.instructor, "Big", ActivityStatus.DRAFT, 0);

		perform(post(testCasesPath(activity)), this.instructorToken,
				testCaseBody("i".repeat(10_000), "o".repeat(10_000), false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.input").value("i".repeat(10_000)))
			.andExpect(jsonPath("$.expectedOutput").value("o".repeat(10_000)));
		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "o", false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.position").value(2));
	}

	@Test
	void addTestCaseRejectsInvalidBodiesAndSavesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 0);

		perform(post(testCasesPath(activity)), this.instructorToken, "{}")
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors.expectedOutput").exists())
			.andExpect(jsonPath("$.errors.input").doesNotExist())
			.andExpect(jsonPath("$.errors.hidden").doesNotExist());
		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("1\n", " \n ", false))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.expectedOutput").exists());
		perform(post(testCasesPath(activity)), this.instructorToken,
				testCaseBody("i".repeat(10_001), "o".repeat(10_001), false))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.input").exists())
			.andExpect(jsonPath("$.errors.expectedOutput").exists());

		assertThat(this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow().getTestCases())
			.isEmpty();
	}

	@Test
	void addFiftyFirstTestCaseIs400WithErrors() throws Exception {
		Activity activity = saveActivity(this.instructor, "Full", ActivityStatus.DRAFT, 50);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(400))
			.andExpect(jsonPath("$.detail").value("An activity can have at most 50 test cases."))
			.andExpect(jsonPath("$.errors.testCases").value("An activity can have at most 50 test cases."));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTestCases()).hasSize(50);
		assertThat(reloaded.getUpdatedAt()).isEqualTo(before);
	}

	@Test
	void addFiftiethTestCaseIs201() throws Exception {
		Activity activity = saveActivity(this.instructor, "Almost full", ActivityStatus.DRAFT, 49);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.position").value(50));
	}

	@Test
	void addTestCaseToArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isConflict())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));

		assertTestCaseCountAndUpdatedAt(activity, 1, before);
	}

	@Test
	void addTestCaseToAnotherInstructorsActivityIs403AndMissingIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(post(testCasesPath(activity)), this.otherInstructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
		perform(post(BASE + "/999999/test-cases"), this.instructorToken, testCaseBody("", "x\n", false))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));

		assertTestCaseCountAndUpdatedAt(activity, 1, before);
	}

	@Test
	void addTestCaseWithoutTokenIs401AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 0);

		perform(post(testCasesPath(activity)), null, testCaseBody("", "x\n", false))
			.andExpect(status().isUnauthorized());
		perform(post(testCasesPath(activity)), this.studentToken, testCaseBody("", "x\n", false))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));

		assertThat(this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow().getTestCases())
			.isEmpty();
	}

	// PUT /api/instructor/activities/{id}/test-cases/{testCaseId}

	@Test
	void updateTestCaseReturns200KeepsPositionAndChangesUpdatedAt() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.PUBLISHED, 3);
		TestCase second = activity.getTestCases().get(1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(put(testCasePath(activity, second)), this.instructorToken, testCaseBody("9 9\n", "18\n", true))
			.andExpect(status().isOk())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
			.andExpect(jsonPath("$.id").value(second.getId()))
			.andExpect(jsonPath("$.position").value(2))
			.andExpect(jsonPath("$.input").value("9 9\n"))
			.andExpect(jsonPath("$.expectedOutput").value("18\n"))
			.andExpect(jsonPath("$.hidden").value(true));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTestCases()).extracting(TestCase::getExpectedOutput)
			.containsExactly("out 1\n", "18\n", "out 3\n");
		assertThat(reloaded.getTestCases().get(1).isHidden()).isTrue();
		assertThat(reloaded.getStatus()).isEqualTo(ActivityStatus.PUBLISHED);
		assertThat(reloaded.getUpdatedAt()).isAfter(before);
	}

	@Test
	void updateTestCaseFromAnotherActivityOrMissingIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		Activity otherActivity = saveActivity(this.instructor, "Also mine", ActivityStatus.DRAFT, 1);
		TestCase foreign = otherActivity.getTestCases().get(0);

		perform(put(testCasePath(activity, foreign)), this.instructorToken, testCaseBody("", "changed\n", false))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("Test case not found."));
		perform(put(testCasesPath(activity) + "/999999"), this.instructorToken, testCaseBody("", "changed\n", false))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Test case not found."));

		assertThat(this.activityRepository.findWithTestCasesById(otherActivity.getId()).orElseThrow().getTestCases())
			.extracting(TestCase::getExpectedOutput)
			.containsExactly("out 1\n");
	}

	@Test
	void updateTestCaseOnArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 1);
		TestCase testCase = activity.getTestCases().get(0);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(put(testCasePath(activity, testCase)), this.instructorToken, testCaseBody("", "changed\n", false))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));

		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTestCases().get(0).getExpectedOutput()).isEqualTo("out 1\n");
		assertThat(reloaded.getUpdatedAt()).isEqualTo(before);
	}

	@Test
	void updateTestCaseWithInvalidBodyIs400AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		TestCase testCase = activity.getTestCases().get(0);

		perform(put(testCasePath(activity, testCase)), this.instructorToken,
				testCaseBody("i".repeat(10_001), "", false))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.input").exists())
			.andExpect(jsonPath("$.errors.expectedOutput").exists());

		assertThat(this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow().getTestCases())
			.extracting(TestCase::getExpectedOutput)
			.containsExactly("out 1\n");
	}

	@Test
	void updateTestCaseOfAnotherInstructorsActivityIs403AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		TestCase testCase = activity.getTestCases().get(0);

		perform(put(testCasePath(activity, testCase)), this.otherInstructorToken, testCaseBody("", "taken\n", false))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
		perform(put(testCasePath(activity, testCase)), this.studentToken, testCaseBody("", "taken\n", false))
			.andExpect(status().isForbidden());
		perform(put(testCasePath(activity, testCase)), null, testCaseBody("", "taken\n", false))
			.andExpect(status().isUnauthorized());

		assertThat(this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow().getTestCases())
			.extracting(TestCase::getExpectedOutput)
			.containsExactly("out 1\n");
	}

	// DELETE /api/instructor/activities/{id}/test-cases/{testCaseId}

	@Test
	void deleteTestCaseReturns204AndRenumbersRemainingPositions() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.PUBLISHED, 4);
		TestCase second = activity.getTestCases().get(1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(delete(testCasePath(activity, second)), this.instructorToken, null)
			.andExpect(status().isNoContent())
			.andExpect(content().string(""));

		perform(get(testCasesPath(activity)), this.instructorToken, null)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[0].position").value(1))
			.andExpect(jsonPath("$[0].expectedOutput").value("out 1\n"))
			.andExpect(jsonPath("$[1].position").value(2))
			.andExpect(jsonPath("$[1].expectedOutput").value("out 3\n"))
			.andExpect(jsonPath("$[2].position").value(3))
			.andExpect(jsonPath("$[2].expectedOutput").value("out 4\n"));
		assertThat(this.activityRepository.findById(activity.getId()).orElseThrow().getUpdatedAt()).isAfter(before);
	}

	@Test
	void addAfterDeleteUsesTheNextPositionAfterRenumbering() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 3);
		TestCase first = activity.getTestCases().get(0);

		perform(delete(testCasePath(activity, first)), this.instructorToken, null).andExpect(status().isNoContent());
		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("", "new\n", false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.position").value(3));

		perform(get(testCasesPath(activity)), this.instructorToken, null)
			.andExpect(jsonPath("$[0].expectedOutput").value("out 2\n"))
			.andExpect(jsonPath("$[1].expectedOutput").value("out 3\n"))
			.andExpect(jsonPath("$[2].expectedOutput").value("new\n"));
	}

	@Test
	void deleteLastTestCaseOfPublishedActivityIs409AndOfDraftIs204() throws Exception {
		Activity published = saveActivity(this.instructor, "Live", ActivityStatus.PUBLISHED, 1);
		Activity draft = saveActivity(this.instructor, "Draft", ActivityStatus.DRAFT, 1);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(published, before);

		perform(delete(testCasePath(published, published.getTestCases().get(0))), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("A published activity needs at least one test case."));
		perform(delete(testCasePath(draft, draft.getTestCases().get(0))), this.instructorToken, null)
			.andExpect(status().isNoContent());

		assertTestCaseCountAndUpdatedAt(published, 1, before);
		assertThat(this.activityRepository.findWithTestCasesById(draft.getId()).orElseThrow().getTestCases()).isEmpty();
	}

	@Test
	void deleteTestCaseOnArchivedActivityIs409AndChangesNothing() throws Exception {
		Activity activity = saveActivity(this.instructor, "Old", ActivityStatus.ARCHIVED, 2);
		Instant before = Instant.parse("2026-10-01T08:00:00Z");
		setUpdatedAt(activity, before);

		perform(delete(testCasePath(activity, activity.getTestCases().get(0))), this.instructorToken, null)
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value("Archived activities can't be changed."));

		assertTestCaseCountAndUpdatedAt(activity, 2, before);
	}

	@Test
	void deleteTestCaseFromAnotherActivityOrMissingIs404() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 1);
		Activity otherActivity = saveActivity(this.instructor, "Also mine", ActivityStatus.DRAFT, 1);

		perform(delete(testCasePath(activity, otherActivity.getTestCases().get(0))), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Test case not found."));
		perform(delete(testCasesPath(activity) + "/999999"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Test case not found."));
		perform(delete(BASE + "/999999/test-cases/1"), this.instructorToken, null)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("Activity not found."));

		assertThat(this.activityRepository.findWithTestCasesById(otherActivity.getId()).orElseThrow().getTestCases())
			.hasSize(1);
	}

	@Test
	void deleteTestCaseOfAnotherInstructorsActivityIs403AndAsStudentIs403() throws Exception {
		Activity activity = saveActivity(this.instructor, "Mine", ActivityStatus.DRAFT, 2);
		TestCase testCase = activity.getTestCases().get(0);

		perform(delete(testCasePath(activity, testCase)), this.otherInstructorToken, null)
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.detail").value(DENIED_DETAIL));
		perform(delete(testCasePath(activity, testCase)), this.studentToken, null)
			.andExpect(status().isForbidden());
		perform(delete(testCasePath(activity, testCase)), null, null).andExpect(status().isUnauthorized());

		assertThat(this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow().getTestCases())
			.hasSize(2);
	}

	@Test
	void testCaseChangesShowInTheActivityDetailAndSummary() throws Exception {
		Activity activity = saveActivity(this.instructor, "Sum", ActivityStatus.DRAFT, 1);

		perform(post(testCasesPath(activity)), this.instructorToken, testCaseBody("2 2\n", "4\n", true))
			.andExpect(status().isCreated());

		perform(get(BASE + "/" + activity.getId()), this.instructorToken, null)
			.andExpect(jsonPath("$.testCases", hasSize(2)))
			.andExpect(jsonPath("$.testCases[1].position").value(2))
			.andExpect(jsonPath("$.testCases[1].hidden").value(true));
		perform(get(BASE), this.instructorToken, null)
			.andExpect(jsonPath("$[0].id").value(activity.getId()))
			.andExpect(jsonPath("$[0].testCaseCount").value(2));
	}

	private void assertTestCaseCountAndUpdatedAt(Activity activity, int testCaseCount, Instant updatedAt) {
		Activity reloaded = this.activityRepository.findWithTestCasesById(activity.getId()).orElseThrow();
		assertThat(reloaded.getTestCases()).hasSize(testCaseCount);
		assertThat(reloaded.getUpdatedAt()).isEqualTo(updatedAt);
	}

	private static String testCasesPath(Activity activity) {
		return BASE + "/" + activity.getId() + "/test-cases";
	}

	private static String testCasePath(Activity activity, TestCase testCase) {
		return testCasesPath(activity) + "/" + testCase.getId();
	}

	private String testCaseBody(String input, String expectedOutput, boolean hidden) {
		return this.objectMapper
			.writeValueAsString(Map.of("input", input, "expectedOutput", expectedOutput, "hidden", hidden));
	}

	private void assertStatusAndUpdatedAt(Activity activity, ActivityStatus status, Instant updatedAt) {
		Activity reloaded = this.activityRepository.findById(activity.getId()).orElseThrow();
		assertThat(reloaded.getStatus()).isEqualTo(status);
		assertThat(reloaded.getUpdatedAt()).isEqualTo(updatedAt);
	}

	private ResultActions perform(MockHttpServletRequestBuilder request, String token, String json) throws Exception {
		request.header(HttpHeaders.ACCEPT, "application/json, application/problem+json");
		if (token != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}
		if (json != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(json);
		}
		return this.mockMvc.perform(request);
	}

	private String body(String title, String problemStatement, String starterCode) {
		return this.objectMapper.writeValueAsString(
				Map.of("title", title, "problemStatement", problemStatement, "starterCode", starterCode));
	}

	private long createdId(ResultActions result) throws Exception {
		String json = result.andReturn().getResponse().getContentAsString();
		return this.objectMapper.readTree(json).get("id").asLong();
	}

	private Activity saveActivity(User owner, String title, ActivityStatus status, int testCaseCount) {
		Activity activity = new Activity(owner.getId(), title, "Statement for " + title, "", status);
		for (int position = 1; position <= testCaseCount; position++) {
			activity.addTestCase(new TestCase(position, "in " + position + "\n", "out " + position + "\n", false));
		}
		return this.activityRepository.save(activity);
	}

	/** Sets {@code updated_at} directly, so ordering tests do not depend on clock resolution. */
	private void setUpdatedAt(Activity activity, Instant updatedAt) {
		this.jdbcTemplate.update("update activities set updated_at = ? where id = ?", Timestamp.from(updatedAt),
				activity.getId());
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

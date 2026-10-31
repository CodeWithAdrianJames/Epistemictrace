package com.episteme.epistemictrace.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
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
 * Spec 08 Parts 1–2: instructor activity CRUD ({@code GET}/{@code POST} list, {@code GET}/{@code PUT} one) and the
 * publish and archive transitions.
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
			assertThat(config.getCooldownSeconds()).isEqualTo(120);
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

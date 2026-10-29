package com.episteme.epistemictrace.activity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "activities")
public class Activity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "instructor_id", nullable = false)
	private Long instructorId;

	@Column(nullable = false, length = 120)
	private String title;

	@Column(name = "problem_statement", nullable = false, columnDefinition = "text")
	private String problemStatement;

	@Column(name = "starter_code", nullable = false, columnDefinition = "text")
	private String starterCode = "";

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private ActivityStatus status;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@OneToMany(mappedBy = "activity", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position")
	private List<TestCase> testCases = new ArrayList<>();

	protected Activity() {
	}

	public Activity(Long instructorId, String title, String problemStatement, String starterCode,
			ActivityStatus status) {
		this.instructorId = instructorId;
		this.title = title;
		this.problemStatement = problemStatement;
		this.starterCode = starterCode;
		this.status = status;
	}

	@PrePersist
	void onCreate() {
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	@PreUpdate
	void onUpdate() {
		this.updatedAt = Instant.now();
	}

	public void addTestCase(TestCase testCase) {
		testCase.setActivity(this);
		this.testCases.add(testCase);
	}

	public Long getId() {
		return this.id;
	}

	public Long getInstructorId() {
		return this.instructorId;
	}

	public String getTitle() {
		return this.title;
	}

	public String getProblemStatement() {
		return this.problemStatement;
	}

	public String getStarterCode() {
		return this.starterCode;
	}

	public ActivityStatus getStatus() {
		return this.status;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	public Instant getUpdatedAt() {
		return this.updatedAt;
	}

	public List<TestCase> getTestCases() {
		return Collections.unmodifiableList(this.testCases);
	}

}

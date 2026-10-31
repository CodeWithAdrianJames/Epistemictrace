package com.episteme.epistemictrace.activity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "test_cases")
public class TestCase {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "activity_id", nullable = false)
	private Activity activity;

	@Column(nullable = false)
	private int position;

	@Column(nullable = false, columnDefinition = "text")
	private String input = "";

	@Column(name = "expected_output", nullable = false, columnDefinition = "text")
	private String expectedOutput;

	@Column(name = "is_hidden", nullable = false)
	private boolean hidden;

	protected TestCase() {
	}

	public TestCase(int position, String input, String expectedOutput, boolean hidden) {
		this.position = position;
		this.input = input;
		this.expectedOutput = expectedOutput;
		this.hidden = hidden;
	}

	/** Set by {@link Activity#addTestCase(TestCase)} to keep both sides in sync. */
	void setActivity(Activity activity) {
		this.activity = activity;
	}

	/** Replaces the editable fields; the position stays as it is. */
	public void edit(String input, String expectedOutput, boolean hidden) {
		this.input = input;
		this.expectedOutput = expectedOutput;
		this.hidden = hidden;
	}

	/** Used by {@link ActivityService} to renumber positions 1..n after a delete. */
	void moveTo(int position) {
		this.position = position;
	}

	public Long getId() {
		return this.id;
	}

	public Activity getActivity() {
		return this.activity;
	}

	public int getPosition() {
		return this.position;
	}

	public String getInput() {
		return this.input;
	}

	public String getExpectedOutput() {
		return this.expectedOutput;
	}

	public boolean isHidden() {
		return this.hidden;
	}

}

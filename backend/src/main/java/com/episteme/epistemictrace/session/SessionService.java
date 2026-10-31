package com.episteme.epistemictrace.session;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.episteme.epistemictrace.activity.ActivityNotFoundException;
import com.episteme.epistemictrace.activity.ActivityService;
import com.episteme.epistemictrace.auth.UnknownTokenUserException;
import com.episteme.epistemictrace.breaker.BreakerService;
import com.episteme.epistemictrace.user.User;
import com.episteme.epistemictrace.user.UserRepository;

/**
 * Coding session rules (spec 16 R1–R4, Q15). Every method takes the caller's user id from the controller. Times come
 * from the injected {@link Clock}. A session that exists but belongs to another student is an
 * {@link AccessDeniedException} ({@code 403}), a missing one is a {@link SessionNotFoundException} ({@code 404}).
 */
@Service
@EnableConfigurationProperties(SessionProperties.class)
public class SessionService {

	private final CodingSessionRepository codingSessionRepository;

	private final ActivityService activityService;

	private final UserRepository userRepository;

	private final SessionProperties sessionProperties;

	private final BreakerService breakerService;

	private final Clock clock;

	public SessionService(CodingSessionRepository codingSessionRepository, ActivityService activityService,
			UserRepository userRepository, SessionProperties sessionProperties, BreakerService breakerService,
			Clock clock) {
		this.codingSessionRepository = codingSessionRepository;
		this.activityService = activityService;
		this.userRepository = userRepository;
		this.sessionProperties = sessionProperties;
		this.breakerService = breakerService;
		this.clock = clock;
	}

	/**
	 * Resumes the student's latest session for the activity if it was never ended or ended at most one resume window
	 * ago (its end is cleared); otherwise creates a new session that starts now.
	 * @throws ActivityNotFoundException if the activity is missing or not published
	 * @throws ConsentRequiredException if the student has not accepted the consent notice
	 * @throws UnknownTokenUserException if the student no longer exists
	 */
	@Transactional
	public SessionStart start(long studentId, long activityId) {
		this.activityService.getPublished(activityId);
		User student = this.userRepository.findById(studentId).orElseThrow(UnknownTokenUserException::new);
		if (student.getConsentAcceptedAt() == null) {
			throw new ConsentRequiredException();
		}
		Instant now = this.clock.instant();
		Optional<CodingSession> resumable = this.codingSessionRepository
			.findFirstByStudentIdAndActivityIdOrderByStartedAtDescIdDesc(studentId, activityId)
			.filter(latest -> isResumable(latest, now));
		if (resumable.isPresent()) {
			CodingSession session = resumable.get();
			session.resume();
			return new SessionStart(session, true, this.breakerService.payload(session));
		}
		CodingSession session = this.codingSessionRepository.save(new CodingSession(studentId, activityId, now));
		return new SessionStart(session, false, this.breakerService.payload(session));
	}

	/** Sets the end of the student's own session to now, replacing an earlier end. */
	@Transactional
	public void end(long sessionId, long studentId) {
		requireOwnedSession(sessionId, studentId).end(this.clock.instant());
	}

	/**
	 * The session if it belongs to the student. Reused by the event, breaker, reflection and history specs.
	 * @throws SessionNotFoundException if there is no session with this id
	 * @throws AccessDeniedException if the session belongs to another student
	 */
	public CodingSession requireOwnedSession(long sessionId, long studentId) {
		CodingSession session = this.codingSessionRepository.findById(sessionId)
			.orElseThrow(SessionNotFoundException::new);
		if (session.getStudentId() != studentId) {
			throw new AccessDeniedException("Session " + sessionId + " belongs to another student.");
		}
		return session;
	}

	private boolean isResumable(CodingSession session, Instant now) {
		Instant endedAt = session.getEndedAt();
		return endedAt == null || !endedAt.isBefore(now.minus(this.sessionProperties.resumeWindow()));
	}

}

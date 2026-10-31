package com.episteme.epistemictrace.user;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.episteme.epistemictrace.auth.UnknownTokenUserException;

@Service
public class ConsentService {

	private final UserRepository userRepository;

	public ConsentService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	/**
	 * Records that the user accepted the consent notice at {@code now}. The first acceptance wins: the write only
	 * touches a row whose timestamp is still {@code null}, so repeated or concurrent calls never overwrite it.
	 * @return the stored acceptance time, which is {@code now} on the first call and the earlier value afterwards
	 * @throws UnknownTokenUserException if the user no longer exists
	 */
	@Transactional
	public Instant accept(long userId, Instant now) {
		this.userRepository.setConsentAcceptedAtIfAbsent(userId, now);
		return this.userRepository.findById(userId)
			.orElseThrow(UnknownTokenUserException::new)
			.getConsentAcceptedAt();
	}

}

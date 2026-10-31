package com.episteme.epistemictrace.user;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByEmail(String email);

	boolean existsByEmail(String email);

	/**
	 * Sets {@code consent_accepted_at} only while it is {@code null}, in one statement, so the first value is never
	 * overwritten even by concurrent calls. Clears the persistence context so a following read sees the row.
	 * @return 1 if the timestamp was set, 0 if it was already set or the user does not exist
	 */
	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("update User u set u.consentAcceptedAt = :acceptedAt where u.id = :id and u.consentAcceptedAt is null")
	int setConsentAcceptedAtIfAbsent(@Param("id") long id, @Param("acceptedAt") Instant acceptedAt);

}

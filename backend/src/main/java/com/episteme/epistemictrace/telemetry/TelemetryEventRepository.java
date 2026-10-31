package com.episteme.epistemictrace.telemetry;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TelemetryEventRepository extends JpaRepository<TelemetryEvent, Long> {

	/** Which of the given client ids the session already has (spec 18 R5). */
	@Query("select e.clientEventId from TelemetryEvent e where e.sessionId = :sessionId and e.clientEventId in :ids")
	Set<UUID> findStoredClientEventIds(@Param("sessionId") Long sessionId, @Param("ids") Collection<UUID> ids);

	List<TelemetryEvent> findBySessionIdOrderByOccurredAtAscIdAsc(Long sessionId);

}

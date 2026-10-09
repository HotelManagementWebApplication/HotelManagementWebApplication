package com.hospitality.mis.service.room;

import com.hospitality.mis.dao.room.RoomMediaDatabase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;

/** Removes files that never acquired metadata, with a grace period for in-flight uploads. */
@Service
public class RoomImageOrphanCleanupService {
    private final RoomMediaDatabase images;
    private final RoomImageStorage storage;
    private final Clock clock;
    private final Duration gracePeriod;

    public RoomImageOrphanCleanupService(RoomMediaDatabase images, RoomImageStorage storage, Clock clock,
            @Value("${hotel.media.orphan-grace-minutes:60}") long graceMinutes) {
        this.images = images;
        this.storage = storage;
        this.clock = clock;
        this.gracePeriod = Duration.ofMinutes(Math.max(5, graceMinutes));
    }

    @Scheduled(fixedDelayString = "${hotel.media.orphan-cleanup-ms:3600000}",
            initialDelayString = "${hotel.media.orphan-cleanup-initial-delay-ms:0}")
    @Transactional(readOnly = true)
    public int cleanup() {
        return storage.deleteOrphans(new HashSet<>(images.allPaths()),
                Instant.now(clock).minus(gracePeriod));
    }
}

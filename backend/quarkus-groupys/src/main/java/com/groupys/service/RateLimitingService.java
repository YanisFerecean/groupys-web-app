package com.groupys.service;

import com.groupys.config.PerformanceFeatureFlags;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ClientErrorException;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for handling rate limiting across the application.
 * Supports both local (in-memory) and Redis-based rate limiting.
 */
@ApplicationScoped
public class RateLimitingService {

    /**
     * Maximum number of requests allowed within the rate limit window.
     */
    public static final int RATE_LIMIT_MAX = 20;

    /**
     * Rate limit window duration in milliseconds (10 seconds).
     */
    public static final long RATE_LIMIT_WINDOW_MS = 10_000;

    /**
     * Types of rate-limited operations.
     */
    public enum RateLimitType {
        MESSAGE_SEND,
        MESSAGE_DELETE,
        CONVERSATION_CREATE,
        FRIEND_REQUEST,
        POST_CREATE,
        COMMENT_CREATE
    }

    private static final ConcurrentHashMap<String, long[]> rateLimitMap = new ConcurrentHashMap<>();

    @Inject
    PerformanceFeatureFlags flags;

    @Inject
    ChatRedisStateService chatRedisStateService;

    /**
     * Checks if the user has exceeded their rate limit for the specified operation type.
     * Throws a 429 ClientErrorException if the rate limit is exceeded.
     *
     * @param userId   the user's UUID (can be null if clerkId is provided)
     * @param clerkId  the user's clerk ID (can be null if userId is provided)
     * @param rateType the type of rate-limited operation
     * @throws ClientErrorException if rate limit is exceeded (HTTP 429)
     */
    public void checkRateLimit(UUID userId, String clerkId, RateLimitType rateType) {
        if (rateType == RateLimitType.MESSAGE_SEND && redisRateLimitEnabled()) {
            boolean allowed = chatRedisStateService.allowMessageSend(userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
            if (!allowed) {
                throw new ClientErrorException("Rate limit exceeded: too many messages", 429);
            }
            return;
        }

        long now = System.currentTimeMillis();
        String key = buildRateLimitKey(userId, clerkId, rateType);

        long[] bucket = rateLimitMap.compute(key, (k, v) -> {
            if (v == null || now - v[1] >= RATE_LIMIT_WINDOW_MS) {
                return new long[]{1, now};
            }
            v[0]++;
            return v;
        });

        if (bucket[0] > RATE_LIMIT_MAX) {
            throw new ClientErrorException("Rate limit exceeded: too many messages", 429);
        }
    }

    /**
     * Checks if the user has exceeded their rate limit for message sending.
     * Convenience method that uses MESSAGE_SEND rate limit type.
     *
     * @param userId  the user's UUID (can be null if clerkId is provided)
     * @param clerkId the user's clerk ID (can be null if userId is provided)
     * @throws ClientErrorException if rate limit is exceeded (HTTP 429)
     * @deprecated Use {@link #checkRateLimit(UUID, String, RateLimitType)} instead
     */
    @Deprecated
    public void checkRateLimit(UUID userId, String clerkId) {
        checkRateLimit(userId, clerkId, RateLimitType.MESSAGE_SEND);
    }

    /**
     * Scheduled task to evict stale rate limit entries.
     * Runs every 60 seconds to clean up expired entries from the local rate limit map.
     */
    @Scheduled(every = "60s")
    void evictStaleRateLimitEntries() {
        long now = System.currentTimeMillis();
        rateLimitMap.entrySet().removeIf(e -> now - e.getValue()[1] >= RATE_LIMIT_WINDOW_MS);
    }

    /**
     * Builds a rate limit key from user identifiers and rate type.
     *
     * @param userId   the user's UUID
     * @param clerkId  the user's clerk ID
     * @param rateType the rate limit type
     * @return a unique key for rate limiting
     */
    private String buildRateLimitKey(UUID userId, String clerkId, RateLimitType rateType) {
        String userKey = userId != null ? userId.toString() : clerkId;
        return rateType.name() + ":" + userKey;
    }

    private boolean redisRateLimitEnabled() {
        return flags != null && flags.redisEnabled() && flags.redisChatRateLimitEnabled();
    }
}

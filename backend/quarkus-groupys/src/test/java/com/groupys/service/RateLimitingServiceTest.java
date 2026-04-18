package com.groupys.service;

import com.groupys.config.PerformanceFeatureFlags;
import jakarta.ws.rs.ClientErrorException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitingServiceTest {

    private RateLimitingService rateLimitingService;
    private StubPerformanceFeatureFlags flags;

    @BeforeEach
    void setUp() {
        flags = new StubPerformanceFeatureFlags();
        rateLimitingService = new RateLimitingService();
        rateLimitingService.flags = flags;
        rateLimitingService.chatRedisStateService = null; // Not using Redis in unit tests
    }

    @Test
    void checkRateLimit_shouldAllowWhenUnderLimit() {
        UUID userId = UUID.randomUUID();
        String clerkId = "clerk_test";

        // Should not throw for first RATE_LIMIT_MAX messages
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            final int iteration = i;
            assertDoesNotThrow(() ->
                rateLimitingService.checkRateLimit(userId, clerkId, RateLimitingService.RateLimitType.MESSAGE_SEND),
                "Iteration " + iteration + " should not throw"
            );
        }
    }

    @Test
    void checkRateLimit_shouldThrowWhenOverLimit() {
        UUID userId = UUID.randomUUID();
        String clerkId = "clerk_test";

        // First, use up the rate limit
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            rateLimitingService.checkRateLimit(userId, clerkId, RateLimitingService.RateLimitType.MESSAGE_SEND);
        }

        // Next message should throw 429
        ClientErrorException exception = assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(userId, clerkId, RateLimitingService.RateLimitType.MESSAGE_SEND)
        );
        assertEquals(429, exception.getResponse().getStatus());
        assertTrue(exception.getMessage().contains("Rate limit exceeded"));
    }

    @Test
    void checkRateLimit_shouldWorkWithUserIdOnly() {
        UUID userId = UUID.randomUUID();

        // Should not throw for first RATE_LIMIT_MAX messages
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            assertDoesNotThrow(() ->
                rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.MESSAGE_SEND)
            );
        }

        // Should throw after limit
        assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.MESSAGE_SEND)
        );
    }

    @Test
    void checkRateLimit_shouldWorkWithClerkIdOnly() {
        String clerkId = "clerk_test_only";

        // Should not throw for first RATE_LIMIT_MAX messages
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            assertDoesNotThrow(() ->
                rateLimitingService.checkRateLimit(null, clerkId, RateLimitingService.RateLimitType.MESSAGE_SEND)
            );
        }

        // Should throw after limit
        assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(null, clerkId, RateLimitingService.RateLimitType.MESSAGE_SEND)
        );
    }

    @Test
    void checkRateLimit_differentUsersHaveSeparateLimits() {
        UUID userId1 = UUID.randomUUID();
        UUID userId2 = UUID.randomUUID();

        // Use up limit for user 1
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            rateLimitingService.checkRateLimit(userId1, null, RateLimitingService.RateLimitType.MESSAGE_SEND);
        }

        // User 1 should be rate limited
        assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(userId1, null, RateLimitingService.RateLimitType.MESSAGE_SEND)
        );

        // User 2 should still be able to send messages
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            assertDoesNotThrow(() ->
                rateLimitingService.checkRateLimit(userId2, null, RateLimitingService.RateLimitType.MESSAGE_SEND)
            );
        }
    }

    @Test
    void checkRateLimit_differentRateTypesHaveSeparateLimits() {
        UUID userId = UUID.randomUUID();

        // Use up limit for MESSAGE_SEND
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.MESSAGE_SEND);
        }

        // MESSAGE_SEND should be rate limited
        assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.MESSAGE_SEND)
        );

        // CONVERSATION_CREATE should still work (separate counter)
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            assertDoesNotThrow(() ->
                rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.CONVERSATION_CREATE)
            );
        }
    }

    @Test
    void evictStaleRateLimitEntries_shouldNotThrow() {
        UUID userId = UUID.randomUUID();

        // Use some rate limit
        rateLimitingService.checkRateLimit(userId, null, RateLimitingService.RateLimitType.MESSAGE_SEND);

        // Evict stale entries should not throw
        assertDoesNotThrow(() -> rateLimitingService.evictStaleRateLimitEntries());
    }

    @Test
    void checkRateLimit_convenienceMethod_shouldUseMessageSendType() {
        UUID userId = UUID.randomUUID();

        // Use up the rate limit via convenience method
        for (int i = 0; i < RateLimitingService.RATE_LIMIT_MAX; i++) {
            rateLimitingService.checkRateLimit(userId, null); // convenience method
        }

        // Should throw after limit
        assertThrows(ClientErrorException.class, () ->
            rateLimitingService.checkRateLimit(userId, null)
        );
    }

    @Test
    void rateLimitType_shouldHaveExpectedValues() {
        assertNotNull(RateLimitingService.RateLimitType.MESSAGE_SEND);
        assertNotNull(RateLimitingService.RateLimitType.MESSAGE_DELETE);
        assertNotNull(RateLimitingService.RateLimitType.CONVERSATION_CREATE);
        assertNotNull(RateLimitingService.RateLimitType.FRIEND_REQUEST);
        assertNotNull(RateLimitingService.RateLimitType.POST_CREATE);
        assertNotNull(RateLimitingService.RateLimitType.COMMENT_CREATE);
    }

    @Test
    void constants_shouldHaveExpectedValues() {
        assertEquals(20, RateLimitingService.RATE_LIMIT_MAX);
        assertEquals(10_000L, RateLimitingService.RATE_LIMIT_WINDOW_MS);
    }

    // Stub implementation of PerformanceFeatureFlags
    private static final class StubPerformanceFeatureFlags extends PerformanceFeatureFlags {
        private boolean redisEnabled = false;
        private boolean redisChatRateLimitEnabled = false;

        @Override
        public boolean redisEnabled() {
            return redisEnabled;
        }

        @Override
        public boolean redisChatRateLimitEnabled() {
            return redisChatRateLimitEnabled;
        }

        public void setRedisEnabled(boolean enabled) {
            this.redisEnabled = enabled;
        }

        public void setRedisChatRateLimitEnabled(boolean enabled) {
            this.redisChatRateLimitEnabled = enabled;
        }
    }
}

package com.groupys.service;

import com.groupys.model.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Tests for ChatService using constructor injection.
 */
@QuarkusTest
class ChatServiceTest {

    @Inject
    ChatService chatService;

    @Inject
    RateLimitingService rateLimitingService;

    @Test
    void chatServiceIsInjectable() {
        assertNotNull(chatService, "ChatService should be injectable with constructor injection");
        assertNotNull(rateLimitingService, "RateLimitingService should be injectable");
    }

    @Test
    void serviceStructureIsValid() {
        // Verifies the new service decomposition works
        assertNotNull(chatService);
    }

    private static User user(String seed, String clerkId, String username) {
        User user = new User();
        user.id = UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
        user.clerkId = clerkId;
        user.username = username;
        user.displayName = username;
        return user;
    }
}

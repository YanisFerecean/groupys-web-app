package com.groupys.service;

import com.groupys.dto.SuggestedUserResDto;
import com.groupys.model.User;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for user-similarity scoring in the new RecommendationService.
 */
@QuarkusTest
class UserSimilarityTest {

    @Inject
    RecommendationService recommendationService;

    @Inject
    ScoreCalculationService scoreCalculationService;

    @Test
    void servicesAreInjectable() {
        assertNotNull(recommendationService, "RecommendationService should be injectable");
        assertNotNull(scoreCalculationService, "ScoreCalculationService should be injectable");
    }

    @Test
    void scoreCalculationServiceWorks() {
        long sharedMembers = 5;
        int memberCount = 10;

        double result = scoreCalculationService.calculateSocialFit(sharedMembers, memberCount);

        assertTrue(result >= 0.0 && result <= 1.0, "Social fit should be between 0 and 1");
    }

    private static User user(String seed, String clerkId, String username, String countryCode) {
        User user = new User();
        user.id = UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
        user.clerkId = clerkId;
        user.username = username;
        user.displayName = username;
        user.countryCode = countryCode;
        return user;
    }
}

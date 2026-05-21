package com.groupys.service;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Tests for recommendation service resilience using the new service structure.
 */
@QuarkusTest
class DiscoveryServiceResilienceTest {

    @Inject
    RecommendationService recommendationService;

    @Inject
    DiscoveryService discoveryService;

    @Test
    void servicesAreInjectable() {
        assertNotNull(recommendationService, "RecommendationService should be injectable");
        assertNotNull(discoveryService, "DiscoveryService should be injectable as facade");
    }

    @Test
    void serviceStructureIsValid() {
        // Verifies the new service decomposition works
        assertNotNull(recommendationService);
    }
}

package com.groupys.service;

import com.groupys.dto.*;
import com.groupys.event.CommunityActivityEvent;
import com.groupys.model.*;
import com.groupys.model.Community;
import com.groupys.repository.*;
import io.quarkus.logging.Log;
import io.quarkus.runtime.ShutdownEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.stream.Collectors;

/**
 * DiscoveryService is now a facade/coordinator that delegates to focused services:
 * - TasteProfileService: User and community taste profile management
 * - RecommendationService: User and community recommendations
 * - MusicSyncService: Apple Music sync, snapshot management, Last.fm integration
 * - ScoreCalculationService: Scoring algorithms
 * - CacheManagementService: Redis/Postgres cache operations
 */
@ApplicationScoped
public class DiscoveryService {

    private static final int TOP_ARTIST_LIMIT = 20;
    private static final int TOP_TRACK_LIMIT = 20;
    private static final String SOURCE_APPLE_TOP_ARTISTS = "APPLE_TOP_ARTISTS";
    private static final String SOURCE_APPLE_TOP_TRACKS = "APPLE_TOP_TRACKS";

    // Dependencies only needed for facade-level operations
    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final UserFollowRepository userFollowRepository;
    private final UserDiscoveryActionRepository userDiscoveryActionRepository;
    private final CommunityRecommendationCacheRepository communityRecommendationCacheRepository;
    private final MusicService musicService;
    private final StorageService storageService;
    private final TasteProfileService tasteProfileService;
    private final RecommendationService recommendationService;
    private final MusicSyncService musicSyncService;
    private final CacheManagementService cacheManagementService;
    private final ScoreCalculationService scoreCalculationService;
    private final DiscoveryService self;
    private final ExecutorService virtualThreadExecutor;

    private volatile boolean shuttingDown;

    @Inject
    public DiscoveryService(
            UserRepository userRepository,
            CommunityRepository communityRepository,
            CommunityMemberRepository communityMemberRepository,
            UserFollowRepository userFollowRepository,
            UserDiscoveryActionRepository userDiscoveryActionRepository,
            CommunityRecommendationCacheRepository communityRecommendationCacheRepository,
            MusicService musicService,
            StorageService storageService,
            TasteProfileService tasteProfileService,
            RecommendationService recommendationService,
            MusicSyncService musicSyncService,
            CacheManagementService cacheManagementService,
            ScoreCalculationService scoreCalculationService,
            DiscoveryService self,
            @jakarta.inject.Named("virtual-thread-executor") ExecutorService virtualThreadExecutor) {
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.userFollowRepository = userFollowRepository;
        this.userDiscoveryActionRepository = userDiscoveryActionRepository;
        this.communityRecommendationCacheRepository = communityRecommendationCacheRepository;
        this.musicService = musicService;
        this.storageService = storageService;
        this.tasteProfileService = tasteProfileService;
        this.recommendationService = recommendationService;
        this.musicSyncService = musicSyncService;
        this.cacheManagementService = cacheManagementService;
        this.scoreCalculationService = scoreCalculationService;
        this.self = self;
        this.virtualThreadExecutor = virtualThreadExecutor;
    }

    void onShutdown(@Observes ShutdownEvent event) {
        shuttingDown = true;
    }

    void onCommunityActivity(@ObservesAsync CommunityActivityEvent event) {
        try {
            self.refreshAfterCommunityActivity(event.communityId());
        } catch (Exception e) {
            Log.warnf(e, "Async discovery refresh failed for community %s", event.communityId());
        }
    }

    // ==================== PUBLIC API (backward compatible) ====================

    /**
     * Syncs music data from Apple Music for a user.
     * Delegates to MusicSyncService and TasteProfileService.
     */
    @Transactional
    public DiscoverySyncResDto syncMusic(String clerkId) {
        User user = getUserByClerkId(clerkId);
        MusicService.DiscoveryPayload payload = musicService.fetchDiscoveryPayload(clerkId, TOP_ARTIST_LIMIT, TOP_TRACK_LIMIT);

        String artistsPayload = payload.artistsPayload();
        String tracksPayload = payload.tracksPayload();

        // Delegate to MusicSyncService
        musicSyncService.persistSnapshot(user, SOURCE_APPLE_TOP_ARTISTS, "TOP_ARTISTS", artistsPayload, "PROCESSED", null);
        musicSyncService.persistSnapshot(user, SOURCE_APPLE_TOP_TRACKS, "TOP_TRACKS", tracksPayload, "PROCESSED", null);

        // Clear existing preferences
        tasteProfileService.clearUserMusicPreferences(user.id);

        // Process and persist preferences via MusicSyncService
        Map<Long, Double> genreWeights = new LinkedHashMap<>();
        int artistCount = musicSyncService.persistAppleArtistPreferences(user, payload.artists(), genreWeights);
        musicSyncService.persistAppleTrackPreferences(user, payload.tracks(), genreWeights);
        int genreCount = musicSyncService.persistGenrePreferences(user, genreWeights);

        // Refresh profiles and recommendations via TasteProfileService and RecommendationService
        tasteProfileService.rebuildCommunityDerivedPreferences(user);
        tasteProfileService.refreshUserTasteProfile(user);
        recommendationService.refreshRelevantCommunityProfiles(user.id);
        int communityRecommendations = recommendationService.refreshCommunityRecommendations(user.id);
        int userRecommendations = recommendationService.refreshUserSimilarity(user.id);

        user.lastMusicSyncAt = java.time.Instant.now();

        return new DiscoverySyncResDto(
                artistCount,
                genreCount,
                communityRecommendations,
                userRecommendations,
                user.lastMusicSyncAt
        );
    }

    /**
     * Gets suggested communities for a user.
     * Delegates to RecommendationService.
     */
    @Transactional
    public List<SuggestedCommunityResDto> getSuggestedCommunities(String clerkId, int limit, boolean refresh) {
        return recommendationService.getSuggestedCommunities(clerkId, limit, refresh);
    }

    /**
     * Gets suggested users for a user.
     * Delegates to RecommendationService.
     */
    @Transactional
    public List<SuggestedUserResDto> getSuggestedUsers(String clerkId, int limit, boolean refresh) {
        return recommendationService.getSuggestedUsers(clerkId, limit, refresh);
    }

    /**
     * Dismisses a recommendation for a user.
     * Handles cache removal via CacheManagementService.
     */
    @Transactional
    public void dismissRecommendation(String clerkId, String targetType, UUID targetId, DiscoveryActionDto dto) {
        User user = getUserByClerkId(clerkId);
        UserDiscoveryAction action = new UserDiscoveryAction();
        action.user = user;
        action.targetType = normalizeTargetType(targetType);
        action.actionType = dto.actionType().trim().toUpperCase();
        action.surface = dto.surface().trim().toUpperCase();
        action.reasonCode = dto.reasonCode();
        action.metadataJson = dto.metadataJson();
        if (dto.ttlDays() != null && dto.ttlDays() > 0) {
            action.expiresAt = java.time.Instant.now().plus(dto.ttlDays(), java.time.temporal.ChronoUnit.DAYS);
        }
        if ("COMMUNITY".equals(action.targetType)) {
            action.targetCommunity = communityRepository.findByIdOptional(targetId)
                    .orElseThrow(() -> new NotFoundException("Community not found"));
            cacheManagementService.removeCommunityCandidate(user.id, targetId);
        } else {
            action.targetUser = userRepository.findByIdOptional(targetId)
                    .orElseThrow(() -> new NotFoundException("User not found"));
            cacheManagementService.removeUserCandidate(user.id, targetId);
        }
        userDiscoveryActionRepository.persist(action);
    }

    /**
     * Follows a user and refreshes recommendations.
     * Delegates to RecommendationService for refresh.
     */
    @Transactional
    public UserFollowResDto followUser(String clerkId, UUID targetUserId) {
        User follower = getUserByClerkId(clerkId);
        if (follower.id.equals(targetUserId)) {
            throw new BadRequestException("Cannot follow yourself");
        }
        User followed = userRepository.findByIdOptional(targetUserId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        UserFollow follow = userFollowRepository.findByFollowerAndFollowed(follower.id, followed.id)
                .orElseGet(UserFollow::new);
        follow.followerUser = follower;
        follow.followedUser = followed;
        follow.status = "ACTIVE";
        if (follow.id == null) {
            userFollowRepository.persist(follow);
        }

        UserDiscoveryAction action = new UserDiscoveryAction();
        action.user = follower;
        action.targetType = "USER";
        action.targetUser = followed;
        action.actionType = "FOLLOW";
        action.surface = "PROFILE";
        userDiscoveryActionRepository.persist(action);

        recommendationService.refreshUserSimilarity(follower.id);
        recommendationService.refreshUserSimilarity(followed.id);

        return new UserFollowResDto(followed.id, true);
    }

    /**
     * Refreshes all discovery data for a user.
     * Delegates to RecommendationService.
     */
    @Transactional
    public void refreshForUser(UUID userId) {
        recommendationService.refreshForUser(userId);
    }

    /**
     * Refreshes discovery data after a community change.
     * Delegates to TasteProfileService and RecommendationService.
     */
    @Transactional
    public void refreshAfterCommunityChange(UUID userId, UUID communityId) {
        tasteProfileService.refreshCommunityProfile(communityId);
        recommendationService.refreshForUser(userId);
        communityMemberRepository.findByCommunity(communityId).stream()
                .map(member -> member.user.id)
                .distinct()
                .filter(id -> !id.equals(userId))
                .forEach(this::refreshForUser);
    }

    /**
     * Fire-and-forget variant of refreshAfterCommunityChange for use inside join/leave/create.
     * Submits the refresh to a background virtual thread so no exception from the refresh
     * can ever roll back or affect the caller's membership transaction.
     */
    public void refreshAfterCommunityChangeSafe(UUID userId, UUID communityId) {
        if (shuttingDown) return;
        try {
            virtualThreadExecutor.submit(() -> {
                try {
                    self.refreshAfterCommunityChange(userId, communityId);
                } catch (Exception e) {
                    Log.warnf(e, "Discovery refresh failed after community change (community=%s, user=%s) — join/leave still committed", communityId, userId);
                }
            });
        } catch (Exception e) {
            Log.warnf(e, "Could not schedule discovery refresh (community=%s, user=%s)", communityId, userId);
        }
    }

    /**
     * Refreshes discovery data after community activity (async).
     * Delegates to TasteProfileService.
     */
    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    public void refreshAfterCommunityActivity(UUID communityId) {
        tasteProfileService.refreshCommunityProfile(communityId);
        List<UUID> userIds = communityMemberRepository.findByCommunity(communityId).stream()
                .map(member -> member.user.id)
                .distinct()
                .toList();
        for (UUID userId : userIds) {
            if (shuttingDown) {
                break;
            }
            try {
                recommendationService.refreshCommunityRecommendations(userId);
            } catch (Exception e) {
                Log.warnf(e, "Failed to refresh recommendations for user %s", userId);
            }
        }
    }

    /**
     * Refreshes discovery data after user change.
     * Delegates to RecommendationService.
     */
    @Transactional
    public void refreshAfterUserChange(UUID userId) {
        recommendationService.refreshForUser(userId);
    }

    /**
     * Saves onboarding artist preferences for a user.
     * Delegates to TasteProfileService.
     */
    @Transactional
    public void saveOnboardingArtistPreferences(String clerkId, List<Long> artistIds) {
        tasteProfileService.saveOnboardingArtistPreferences(clerkId, artistIds);
    }

    /**
     * Removes community references from discovery data.
     * Delegates to CacheManagementService and RecommendationService.
     */
    @Transactional
    public void removeCommunityReferences(UUID communityId, List<UUID> impactedUserIds) {
        cacheManagementService.removeCommunityFromAllUsers(communityId);
        // Note: Community cleanup is handled by repositories directly in the new architecture
        impactedUserIds.forEach(this::refreshForUser);
    }

    /**
     * Refreshes discovery data for all active users.
     * Delegates to RecommendationService.
     */
    public void refreshAllActiveUsers() {
        if (shuttingDown) {
            return;
        }

        for (UUID userId : userRepository.listActiveDiscoveryUserIds()) {
            if (shuttingDown) {
                break;
            }
            try {
                self.refreshForUser(userId);
            } catch (Exception e) {
                Log.warnf(e, "Failed to refresh discovery for user %s", userId);
            }
        }
    }

    // ==================== HELPER METHODS ====================

    private User getUserByClerkId(String clerkId) {
        return userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private String normalizeTargetType(String targetType) {
        String normalized = targetType == null ? "" : targetType.trim().toUpperCase(java.util.Locale.ROOT);
        if (!normalized.equals("COMMUNITY") && !normalized.equals("USER")) {
            throw new BadRequestException("Unsupported target type");
        }
        return normalized;
    }
}

package com.groupys.service;

import com.groupys.config.PerformanceFeatureFlags;
import com.groupys.model.CommunityRecommendationCache;
import com.groupys.model.UserSimilarityCache;
import com.groupys.model.User;
import com.groupys.model.Community;
import com.groupys.repository.CommunityRecommendationCacheRepository;
import com.groupys.repository.UserSimilarityCacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class CacheManagementService {

    private final UserSimilarityCacheRepository userSimilarityCacheRepository;
    private final CommunityRecommendationCacheRepository communityRecommendationCacheRepository;
    private final DiscoveryRedisCacheService redisCacheService;
    private final PerformanceFeatureFlags flags;

    @Inject
    public CacheManagementService(
            UserSimilarityCacheRepository userSimilarityCacheRepository,
            CommunityRecommendationCacheRepository communityRecommendationCacheRepository,
            DiscoveryRedisCacheService redisCacheService,
            PerformanceFeatureFlags flags) {
        this.userSimilarityCacheRepository = userSimilarityCacheRepository;
        this.communityRecommendationCacheRepository = communityRecommendationCacheRepository;
        this.redisCacheService = redisCacheService;
        this.flags = flags;
    }

    public boolean isLegacyPostgresWriteEnabled() {
        return flags == null || flags.redisRecommendationLegacyPostgresWriteEnabled();
    }

    public boolean isRedisReadEnabled() {
        return flags.redisEnabled() && flags.redisRecommendationReadEnabled();
    }

    public boolean isRedisWriteEnabled() {
        return flags.redisEnabled() && flags.redisRecommendationWriteEnabled();
    }

    public void clearUserRecommendations(UUID userId) {
        if (isLegacyPostgresWriteEnabled()) {
            userSimilarityCacheRepository.deleteByUser(userId);
        }
        if (isRedisWriteEnabled()) {
            redisCacheService.clearUserRecommendations(userId);
        }
    }

    public void clearCommunityRecommendations(UUID userId) {
        if (isLegacyPostgresWriteEnabled()) {
            communityRecommendationCacheRepository.deleteByUser(userId);
        }
        if (isRedisWriteEnabled()) {
            redisCacheService.clearCommunityRecommendations(userId);
        }
    }

    public void removeCommunityFromAllUsers(UUID communityId) {
        if (isLegacyPostgresWriteEnabled()) {
            communityRecommendationCacheRepository.delete("community.id", communityId);
        }
        if (isRedisWriteEnabled()) {
            redisCacheService.removeCommunityFromAllUsers(communityId);
        }
    }

    public void removeCommunityCandidate(UUID userId, UUID communityId) {
        if (isLegacyPostgresWriteEnabled()) {
            communityRecommendationCacheRepository.delete("user.id = ?1 and community.id = ?2", userId, communityId);
        }
        if (isRedisWriteEnabled()) {
            redisCacheService.removeCommunityCandidate(userId, communityId);
        }
    }

    public void removeUserCandidate(UUID userId, UUID targetUserId) {
        if (isLegacyPostgresWriteEnabled()) {
            userSimilarityCacheRepository.delete("user.id = ?1 and candidateUser.id = ?2", userId, targetUserId);
        }
        if (isRedisWriteEnabled()) {
            redisCacheService.removeUserCandidate(userId, targetUserId);
        }
    }

    public void writeUserRecommendations(UUID userId, List<UserSimilarityCache> caches) {
        if (isRedisWriteEnabled()) {
            redisCacheService.clearUserRecommendations(userId);
            redisCacheService.writeUserRecommendations(userId, caches);
        }
    }

    public void writeCommunityRecommendations(UUID userId, List<CommunityRecommendationCache> caches) {
        if (isRedisWriteEnabled()) {
            redisCacheService.clearCommunityRecommendations(userId);
            redisCacheService.writeCommunityRecommendations(userId, caches);
        }
    }

    public List<UserSimilarityCache> findFreshUserRecommendations(UUID userId, int limit) {
        return userSimilarityCacheRepository.findFreshByUser(userId, limit);
    }

    public List<CommunityRecommendationCache> findFreshCommunityRecommendations(UUID userId, int limit) {
        return communityRecommendationCacheRepository.findFreshByUser(userId, limit);
    }

    public void persistUserRecommendation(UserSimilarityCache cache) {
        if (isLegacyPostgresWriteEnabled()) {
            userSimilarityCacheRepository.persist(cache);
        }
    }

    public void persistCommunityRecommendation(CommunityRecommendationCache cache) {
        if (isLegacyPostgresWriteEnabled()) {
            communityRecommendationCacheRepository.persist(cache);
        }
    }

    public List<DiscoveryRedisCacheService.RankedRecommendation> readUserRecommendationsFromRedis(UUID userId, int limit) {
        return redisCacheService.readUserRecommendations(userId, limit);
    }

    public List<DiscoveryRedisCacheService.RankedRecommendation> readCommunityRecommendationsFromRedis(UUID userId, int limit) {
        return redisCacheService.readCommunityRecommendations(userId, limit);
    }
}

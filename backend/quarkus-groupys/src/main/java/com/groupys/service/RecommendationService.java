package com.groupys.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupys.config.PerformanceFeatureFlags;
import com.groupys.dto.*;
import com.groupys.model.*;
import com.groupys.model.community.Community;
import com.groupys.repository.*;
import com.groupys.util.DiscoveryScoreUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class RecommendationService {

    private static final int CACHE_TTL_HOURS = 12;

    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final UserArtistPreferenceRepository userArtistPreferenceRepository;
    private final UserGenrePreferenceRepository userGenrePreferenceRepository;
    private final CommunityTasteProfileRepository communityTasteProfileRepository;
    private final CommunityArtistRepository communityArtistRepository;
    private final CommunityGenreRepository communityGenreRepository;
    private final UserFollowRepository userFollowRepository;
    private final FriendshipRepository friendshipRepository;
    private final ConversationRepository conversationRepository;
    private final UserLikeRepository userLikeRepository;
    private final UserDiscoveryActionRepository userDiscoveryActionRepository;
    private final TasteEmbeddingService tasteEmbeddingService;
    private final PerformanceFeatureFlags flags;
    private final CacheManagementService cacheManagementService;
    private final ScoreCalculationService scoreCalculationService;
    private final TasteProfileService tasteProfileService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public RecommendationService(
            UserRepository userRepository,
            CommunityRepository communityRepository,
            CommunityMemberRepository communityMemberRepository,
            UserArtistPreferenceRepository userArtistPreferenceRepository,
            UserGenrePreferenceRepository userGenrePreferenceRepository,
            CommunityTasteProfileRepository communityTasteProfileRepository,
            CommunityArtistRepository communityArtistRepository,
            CommunityGenreRepository communityGenreRepository,
            UserFollowRepository userFollowRepository,
            FriendshipRepository friendshipRepository,
            ConversationRepository conversationRepository,
            UserLikeRepository userLikeRepository,
            UserDiscoveryActionRepository userDiscoveryActionRepository,
            TasteEmbeddingService tasteEmbeddingService,
            PerformanceFeatureFlags flags,
            CacheManagementService cacheManagementService,
            ScoreCalculationService scoreCalculationService,
            TasteProfileService tasteProfileService) {
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.userArtistPreferenceRepository = userArtistPreferenceRepository;
        this.userGenrePreferenceRepository = userGenrePreferenceRepository;
        this.communityTasteProfileRepository = communityTasteProfileRepository;
        this.communityArtistRepository = communityArtistRepository;
        this.communityGenreRepository = communityGenreRepository;
        this.userFollowRepository = userFollowRepository;
        this.friendshipRepository = friendshipRepository;
        this.conversationRepository = conversationRepository;
        this.userLikeRepository = userLikeRepository;
        this.userDiscoveryActionRepository = userDiscoveryActionRepository;
        this.tasteEmbeddingService = tasteEmbeddingService;
        this.flags = flags;
        this.cacheManagementService = cacheManagementService;
        this.scoreCalculationService = scoreCalculationService;
        this.tasteProfileService = tasteProfileService;
    }

    @Transactional
    public List<SuggestedCommunityResDto> getSuggestedCommunities(String clerkId, int limit, boolean refresh) {
        User user = getUserByClerkId(clerkId);
        int pageSize = Math.max(limit, 1);
        if (refresh) {
            refreshForUser(user.id);
        }
        Set<UUID> friendIds = friendshipRepository.findAcceptedFriendIds(user.id);
        if (cacheManagementService.isRedisReadEnabled()) {
            List<SuggestedCommunityResDto> redisResult = loadCommunitySuggestionsFromRedis(user.id, pageSize, friendIds);
            if (!redisResult.isEmpty()) {
                return redisResult;
            }
        }
        if (cacheManagementService.isLegacyPostgresWriteEnabled()) {
            List<CommunityRecommendationCache> postgresCaches = cacheManagementService.findFreshCommunityRecommendations(user.id, pageSize);
            if (postgresCaches.isEmpty()) {
                refreshForUser(user.id);
                postgresCaches = cacheManagementService.findFreshCommunityRecommendations(user.id, pageSize);
            }
            if (!postgresCaches.isEmpty()) {
                return postgresCaches.stream()
                        .map(cache -> toSuggestedCommunity(cache, friendIds))
                        .toList();
            }
        }

        return computeCommunityRecommendationCaches(user.id).stream()
                .limit(pageSize)
                .map(cache -> toSuggestedCommunity(cache, friendIds))
                .toList();
    }

    @Transactional
    public List<SuggestedUserResDto> getSuggestedUsers(String clerkId, int limit, boolean refresh) {
        User user = getUserByClerkId(clerkId);
        int pageSize = Math.max(limit, 1);
        if (refresh) {
            refreshForUser(user.id);
        }
        Set<UUID> excludedUserIds = buildExcludedSuggestedUserIds(user.id);
        if (cacheManagementService.isRedisReadEnabled()) {
            List<SuggestedUserResDto> redisResult = loadUserSuggestionsFromRedis(user.id, pageSize, excludedUserIds);
            if (!redisResult.isEmpty()) {
                return redisResult;
            }
        }
        if (cacheManagementService.isLegacyPostgresWriteEnabled()) {
            List<UserSimilarityCache> postgresCaches = cacheManagementService.findFreshUserRecommendations(user.id, 100).stream()
                    .filter(cache -> !excludedUserIds.contains(cache.candidateUser.id))
                    .limit(pageSize)
                    .toList();
            if (postgresCaches.isEmpty()) {
                refreshForUser(user.id);
                postgresCaches = cacheManagementService.findFreshUserRecommendations(user.id, 100).stream()
                        .filter(cache -> !excludedUserIds.contains(cache.candidateUser.id))
                        .limit(pageSize)
                        .toList();
            }
            if (!postgresCaches.isEmpty()) {
                return postgresCaches.stream()
                        .map(this::toSuggestedUser)
                        .toList();
            }
        }

        return computeUserSimilarityCaches(user.id).stream()
                .limit(pageSize)
                .map(this::toSuggestedUser)
                .toList();
    }

    public List<User> userDiscoveryFeedCandidates(UUID userId) {
        if (flags.vectorReadEnabled() && tasteEmbeddingService.vectorReadyForUser(userId)) {
            List<UUID> candidateIds = tasteEmbeddingService.findTopKCandidates(userId, flags.vectorCandidateTopK());
            if (!candidateIds.isEmpty()) {
                Map<UUID, User> users = userRepository.findByIdsMap(candidateIds);
                return candidateIds.stream()
                        .map(users::get)
                        .filter(Objects::nonNull)
                        .toList();
            }
        }
        return userRepository.listDiscoveryVisible(userId);
    }

    @Transactional
    public void refreshForUser(UUID userId) {
        User user = userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        tasteProfileService.rebuildCommunityDerivedPreferences(user);
        tasteProfileService.refreshUserTasteProfile(user);
        refreshRelevantCommunityProfiles(userId);
        refreshCommunityRecommendations(userId);
        refreshUserSimilarity(userId);
    }

    @Transactional
    public int refreshCommunityRecommendations(UUID userId) {
        List<CommunityRecommendationCache> sortedCaches = computeCommunityRecommendationCaches(userId);

        if (cacheManagementService.isLegacyPostgresWriteEnabled()) {
            cacheManagementService.clearCommunityRecommendations(userId);
            sortedCaches.forEach(cacheManagementService::persistCommunityRecommendation);
        }
        if (cacheManagementService.isRedisWriteEnabled()) {
            cacheManagementService.writeCommunityRecommendations(userId, sortedCaches);
        }
        return sortedCaches.size();
    }

    @Transactional
    public int refreshUserSimilarity(UUID userId) {
        List<UserSimilarityCache> sortedCaches = computeUserSimilarityCaches(userId);

        if (cacheManagementService.isLegacyPostgresWriteEnabled()) {
            cacheManagementService.clearUserRecommendations(userId);
            sortedCaches.forEach(cacheManagementService::persistUserRecommendation);
        }
        if (cacheManagementService.isRedisWriteEnabled()) {
            cacheManagementService.writeUserRecommendations(userId, sortedCaches);
        }
        return sortedCaches.size();
    }

    @Transactional
    public void refreshRelevantCommunityProfiles(UUID userId) {
        Set<UUID> communityIds = new LinkedHashSet<>();
        communityMemberRepository.findByUser(userId).forEach(member -> communityIds.add(member.community.id));
        communityRepository.listDiscoverable().forEach(community -> communityIds.add(community.id));
        communityIds.forEach(tasteProfileService::refreshCommunityProfile);
    }

    Set<UUID> buildExcludedSuggestedUserIds(UUID userId) {
        Set<UUID> excluded = new HashSet<>();
        userFollowRepository.findActiveByFollower(userId).stream()
                .map(follow -> follow.followedUser.id)
                .forEach(excluded::add);
        conversationRepository.findDirectConversationPartnerIds(userId)
                .forEach(excluded::add);
        userDiscoveryActionRepository.findSuppressedUserIds(userId)
                .forEach(excluded::add);
        userLikeRepository.findLikedUserIds(userId)
                .forEach(excluded::add);
        friendshipRepository.findAcceptedFriendIds(userId)
                .forEach(excluded::add);
        return excluded;
    }

    User getUserByClerkId(String clerkId) {
        return userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    List<CommunityRecommendationCache> computeCommunityRecommendationCaches(UUID userId) {
        User user = userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Map<Long, UserArtistPreference> userArtists = userArtistPreferenceRepository.findByUser(userId).stream()
                .collect(Collectors.toMap(pref -> pref.artist.getId(), pref -> pref, (left, right) -> left, LinkedHashMap::new));
        Map<Long, UserGenrePreference> userGenres = userGenrePreferenceRepository.findByUser(userId).stream()
                .collect(Collectors.toMap(pref -> pref.genre.id, pref -> pref, (left, right) -> left, LinkedHashMap::new));
        List<UUID> joinedCommunityIds = communityMemberRepository.findByUser(userId).stream()
                .map(member -> member.community.id)
                .toList();
        Set<UUID> suppressedCommunityIds = userDiscoveryActionRepository.findSuppressedCommunityIds(userId);

        List<Community> allDiscoverable = communityRepository.listDiscoverable();
        List<UUID> candidateCommunityIds = allDiscoverable.stream()
                .map(c -> c.id)
                .filter(id -> !joinedCommunityIds.contains(id) && !suppressedCommunityIds.contains(id))
                .toList();
        Map<UUID, Long> sharedMembersMap = communityMemberRepository.batchCountSharedMembers(
                candidateCommunityIds, joinedCommunityIds);

        List<CommunityRecommendationCache> caches = new ArrayList<>();
        for (Community community : allDiscoverable) {
            if (joinedCommunityIds.contains(community.id) || suppressedCommunityIds.contains(community.id)) {
                continue;
            }

            CommunityTasteProfile profile = tasteProfileService.ensureCommunityProfile(community.id);
            Map<Long, CommunityArtist> communityArtists = communityArtistRepository.findByCommunity(community.id).stream()
                    .collect(Collectors.toMap(item -> item.artist.getId(), item -> item, (left, right) -> left, LinkedHashMap::new));
            Map<Long, CommunityGenre> communityGenres = communityGenreRepository.findByCommunity(community.id).stream()
                    .collect(Collectors.toMap(item -> item.genre.id, item -> item, (left, right) -> left, LinkedHashMap::new));

            double artistScore = scoreCalculationService.calculateArtistOverlapScore(userArtists, communityArtists);
            double genreScore = scoreCalculationService.calculateGenreOverlapScore(userGenres, communityGenres);
            long sharedMembers = sharedMembersMap.getOrDefault(community.id, 0L);
            double socialFit = scoreCalculationService.calculateSocialFit(sharedMembers, Math.max(1, community.memberCount));
            double activityFit = scoreCalculationService.calculateActivityFit(profile, community.memberCount);
            double countryScore = scoreCalculationService.calculateCountryScore(user, community);
            double novelty = scoreCalculationService.calculateNoveltyScore(community.memberCount);

            double finalScore = scoreCalculationService.calculateCommunityMatchScore(
                    artistScore, genreScore, socialFit, activityFit, countryScore, novelty);

            if (finalScore <= 0.05d) {
                continue;
            }

            CommunityRecommendationCache cache = new CommunityRecommendationCache();
            cache.user = user;
            cache.community = community;
            cache.score = finalScore;
            cache.artistOverlapScore = artistScore;
            cache.genreOverlapScore = genreScore;
            cache.socialFitScore = socialFit;
            cache.activityFitScore = activityFit;
            cache.countryScore = countryScore;
            cache.embeddingScore = 0d;

            ScoreCalculationService.Explanation explanation = scoreCalculationService.buildCommunityExplanation(
                    userArtists, userGenres, communityArtists, communityGenres,
                    (int) sharedMembers, countryScore > 0d);
            cache.primaryReasonCode = explanation.reasonCodes().isEmpty() ? null : explanation.reasonCodes().getFirst();
            cache.explanationJson = explanation.json();
            cache.expiresAt = Instant.now().plus(CACHE_TTL_HOURS, ChronoUnit.HOURS);
            caches.add(cache);
        }

        List<CommunityRecommendationCache> sortedCaches = caches.stream()
                .sorted(Comparator.comparingDouble((CommunityRecommendationCache item) -> item.score).reversed())
                .limit(100)
                .toList();
        for (int index = 0; index < sortedCaches.size(); index++) {
            CommunityRecommendationCache cache = sortedCaches.get(index);
            cache.rankPosition = index + 1;
        }
        return sortedCaches;
    }

    List<UserSimilarityCache> computeUserSimilarityCaches(UUID userId) {
        User user = userRepository.findByIdOptional(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Map<Long, UserArtistPreference> userArtists = userArtistPreferenceRepository.findByUser(userId).stream()
                .collect(Collectors.toMap(pref -> pref.artist.getId(), pref -> pref, (left, right) -> left, LinkedHashMap::new));
        Map<Long, UserGenrePreference> userGenres = userGenrePreferenceRepository.findByUser(userId).stream()
                .collect(Collectors.toMap(pref -> pref.genre.id, pref -> pref, (left, right) -> left, LinkedHashMap::new));
        Set<UUID> excludedUserIds = buildExcludedSuggestedUserIds(userId);
        Set<UUID> userFriendIds = friendshipRepository.findAcceptedFriendIds(userId);

        List<UserSimilarityCache> caches = new ArrayList<>();
        List<User> candidatePool = userDiscoveryFeedCandidates(userId);
        List<User> filteredCandidates = candidatePool.stream()
                .filter(c -> !excludedUserIds.contains(c.id))
                .toList();
        List<UUID> candidateIds = filteredCandidates.stream().map(c -> c.id).toList();

        long userCommunityCount = communityMemberRepository.countByUser(user.id);
        Map<UUID, Long> candidateCommunityCounts = communityMemberRepository.batchCountByUsers(candidateIds);
        Map<UUID, Long> sharedCommunitiesMap = communityMemberRepository.batchCountSharedCommunities(user.id, candidateIds);
        Map<UUID, Set<UUID>> candidateFriendIdsMap = friendshipRepository.batchFriendIdsByCandidates(candidateIds);

        for (User candidate : filteredCandidates) {
            tasteProfileService.rebuildCommunityDerivedPreferences(candidate);
            tasteProfileService.refreshUserTasteProfile(candidate);

            Map<Long, UserArtistPreference> candidateArtists = userArtistPreferenceRepository.findByUser(candidate.id).stream()
                    .collect(Collectors.toMap(pref -> pref.artist.getId(), pref -> pref, (left, right) -> left, LinkedHashMap::new));
            Map<Long, UserGenrePreference> candidateGenres = userGenrePreferenceRepository.findByUser(candidate.id).stream()
                    .collect(Collectors.toMap(pref -> pref.genre.id, pref -> pref, (left, right) -> left, LinkedHashMap::new));

            double artistScore = scoreCalculationService.calculateArtistOverlapScore(userArtists, candidateArtists);
            double genreScore = scoreCalculationService.calculateGenreOverlapScore(userGenres, candidateGenres);
            long sharedCommunities = sharedCommunitiesMap.getOrDefault(candidate.id, 0L);
            long maxCommunityCount = Math.max(1, Math.max(userCommunityCount,
                    candidateCommunityCounts.getOrDefault(candidate.id, 0L)));
            double sharedCommunityScore = DiscoveryScoreUtil.normalizedCount(sharedCommunities, maxCommunityCount);

            UserTasteProfile userProfile = tasteProfileService.ensureUserProfile(user.id);
            UserTasteProfile candidateProfile = tasteProfileService.ensureUserProfile(candidate.id);
            double activityScore = 1d - Math.abs(
                    safeScore(userProfile.communityActivityScore) - safeScore(candidateProfile.communityActivityScore));
            activityScore = DiscoveryScoreUtil.clamp01(activityScore);

            double countryScore = scoreCalculationService.calculateCountryScore(user, candidate);
            long mutualFollows = userFollowRepository.countMutualFollowers(user.id, candidate.id);
            double followGraphScore = DiscoveryScoreUtil.normalizedCount(mutualFollows, 5);
            Set<UUID> candidateFriendIds = candidateFriendIdsMap.getOrDefault(candidate.id, Set.of());
            long sharedFriends = userFriendIds.stream().filter(candidateFriendIds::contains).count();
            double friendsOfFriendsScore = DiscoveryScoreUtil.normalizedCount(sharedFriends, 5);

            double finalScore = scoreCalculationService.calculateUserMatchScore(
                    artistScore, genreScore, sharedCommunityScore, activityScore,
                    countryScore, followGraphScore, friendsOfFriendsScore);

            if (finalScore <= 0.05d) {
                continue;
            }

            UserSimilarityCache cache = new UserSimilarityCache();
            cache.user = user;
            cache.candidateUser = candidate;
            cache.score = finalScore;
            cache.artistOverlapScore = artistScore;
            cache.genreOverlapScore = genreScore;
            cache.sharedCommunitiesScore = sharedCommunityScore;
            cache.activityOverlapScore = activityScore;
            cache.countryScore = countryScore;
            cache.followGraphScore = followGraphScore;
            cache.friendsOfFriendsScore = friendsOfFriendsScore;
            cache.embeddingScore = 0d;

            ScoreCalculationService.Explanation explanation = scoreCalculationService.buildUserExplanation(
                    userArtists, userGenres, candidateArtists, candidateGenres,
                    (int) sharedCommunities, countryScore > 0d, (int) mutualFollows, (int) sharedFriends);
            cache.primaryReasonCode = explanation.reasonCodes().isEmpty() ? null : explanation.reasonCodes().getFirst();
            cache.explanationJson = explanation.json();
            cache.expiresAt = Instant.now().plus(CACHE_TTL_HOURS, ChronoUnit.HOURS);
            caches.add(cache);
        }

        List<UserSimilarityCache> sortedCaches = caches.stream()
                .sorted(Comparator.comparingDouble((UserSimilarityCache item) -> item.score).reversed())
                .limit(100)
                .toList();
        return sortedCaches;
    }

    List<SuggestedUserResDto> loadUserSuggestionsFromRedis(UUID userId, int pageSize, Set<UUID> excludedUserIds) {
        List<DiscoveryRedisCacheService.RankedRecommendation> ranked = cacheManagementService.readUserRecommendationsFromRedis(userId, 100);
        if (ranked.isEmpty()) {
            return List.of();
        }
        List<DiscoveryRedisCacheService.RankedRecommendation> filtered = ranked.stream()
                .filter(item -> !excludedUserIds.contains(item.id()))
                .limit(pageSize)
                .toList();
        if (filtered.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = filtered.stream().map(DiscoveryRedisCacheService.RankedRecommendation::id).toList();
        Map<UUID, User> usersById = userRepository.findByIdsMap(ids);
        return filtered.stream()
                .map(item -> toSuggestedUser(usersById.get(item.id()), item.score(), item.explanationJson()))
                .filter(Objects::nonNull)
                .toList();
    }

    List<SuggestedCommunityResDto> loadCommunitySuggestionsFromRedis(UUID userId, int pageSize, Set<UUID> friendIds) {
        List<DiscoveryRedisCacheService.RankedRecommendation> ranked = cacheManagementService.readCommunityRecommendationsFromRedis(userId, pageSize);
        if (ranked.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = ranked.stream().map(DiscoveryRedisCacheService.RankedRecommendation::id).toList();
        Map<UUID, Community> communitiesById = communityRepository.findByIdsMap(ids);
        return ranked.stream()
                .map(item -> toSuggestedCommunity(communitiesById.get(item.id()), item.score(), item.explanationJson(), friendIds))
                .filter(Objects::nonNull)
                .toList();
    }

    SuggestedCommunityResDto toSuggestedCommunity(CommunityRecommendationCache cache, Set<UUID> friendIds) {
        JsonNode explanation = readJson(cache.explanationJson);
        List<UserSnippetDto> friends = communityMemberRepository
                .findFriendsInCommunity(cache.community.id, friendIds, 3).stream()
                .map(u -> new UserSnippetDto(u.id, u.username, u.displayName, u.profileImage))
                .toList();
        List<DiscoveryMatchDto> topArtists = communityArtistRepository
                .findByCommunity(cache.community.id).stream()
                .limit(3)
                .map(ca -> new DiscoveryMatchDto(String.valueOf(ca.artist.getId()), ca.artist.getName()))
                .toList();
        return new SuggestedCommunityResDto(
                cache.community.id,
                cache.community.name,
                cache.community.description,
                cache.community.imageUrl,
                cache.community.bannerUrl,
                cache.community.iconType,
                cache.community.iconEmoji,
                cache.community.iconUrl,
                cache.community.memberCount,
                cache.score,
                explanation.path("explanation").asText("Recommended from your taste and activity"),
                readTextList(explanation, "reasonCodes"),
                readMatchList(explanation, "matchedArtists"),
                readMatchList(explanation, "matchedGenres"),
                explanation.path("sharedCommunityCount").asInt(0),
                explanation.path("countryMatch").asBoolean(false),
                cache.community.createdBy != null ? cache.community.createdBy.username : null,
                cache.community.createdBy != null ? cache.community.createdBy.displayName : null,
                cache.community.createdBy != null ? cache.community.createdBy.profileImage : null,
                friends,
                topArtists
        );
    }

    SuggestedCommunityResDto toSuggestedCommunity(Community community, double score, String explanationJson, Set<UUID> friendIds) {
        if (community == null) {
            return null;
        }
        JsonNode explanation = readJson(explanationJson);
        List<UserSnippetDto> friends = communityMemberRepository
                .findFriendsInCommunity(community.id, friendIds, 3).stream()
                .map(u -> new UserSnippetDto(u.id, u.username, u.displayName, u.profileImage))
                .toList();
        List<DiscoveryMatchDto> topArtists = communityArtistRepository
                .findByCommunity(community.id).stream()
                .limit(3)
                .map(ca -> new DiscoveryMatchDto(String.valueOf(ca.artist.getId()), ca.artist.getName()))
                .toList();
        return new SuggestedCommunityResDto(
                community.id,
                community.name,
                community.description,
                community.imageUrl,
                community.bannerUrl,
                community.iconType,
                community.iconEmoji,
                community.iconUrl,
                community.memberCount,
                score,
                explanation.path("explanation").asText("Recommended from your taste and activity"),
                readTextList(explanation, "reasonCodes"),
                readMatchList(explanation, "matchedArtists"),
                readMatchList(explanation, "matchedGenres"),
                explanation.path("sharedCommunityCount").asInt(0),
                explanation.path("countryMatch").asBoolean(false),
                community.createdBy != null ? community.createdBy.username : null,
                community.createdBy != null ? community.createdBy.displayName : null,
                community.createdBy != null ? community.createdBy.profileImage : null,
                friends,
                topArtists
        );
    }

    SuggestedUserResDto toSuggestedUser(UserSimilarityCache cache) {
        JsonNode explanation = readJson(cache.explanationJson);
        return new SuggestedUserResDto(
                cache.candidateUser.id,
                cache.candidateUser.username,
                cache.candidateUser.displayName,
                cache.candidateUser.profileImage,
                cache.score,
                explanation.path("explanation").asText("Recommended from your taste and activity"),
                readTextList(explanation, "reasonCodes"),
                readMatchList(explanation, "matchedArtists"),
                readMatchList(explanation, "matchedGenres"),
                explanation.path("sharedCommunityCount").asInt(0),
                explanation.path("countryMatch").asBoolean(false),
                explanation.path("mutualFollowCount").asInt(0),
                cache.candidateUser.bio,
                cache.candidateUser.widgets
        );
    }

    SuggestedUserResDto toSuggestedUser(User candidateUser, double score, String explanationJson) {
        if (candidateUser == null) {
            return null;
        }
        JsonNode explanation = readJson(explanationJson);
        return new SuggestedUserResDto(
                candidateUser.id,
                candidateUser.username,
                candidateUser.displayName,
                candidateUser.profileImage,
                score,
                explanation.path("explanation").asText("Recommended from your taste and activity"),
                readTextList(explanation, "reasonCodes"),
                readMatchList(explanation, "matchedArtists"),
                readMatchList(explanation, "matchedGenres"),
                explanation.path("sharedCommunityCount").asInt(0),
                explanation.path("countryMatch").asBoolean(false),
                explanation.path("mutualFollowCount").asInt(0),
                candidateUser.bio,
                candidateUser.widgets
        );
    }

    JsonNode readJson(String payload) {
        if (payload == null || payload.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(payload);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    List<String> readTextList(JsonNode node, String fieldName) {
        if (!node.has(fieldName) || !node.get(fieldName).isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.get(fieldName).forEach(item -> values.add(item.asText()));
        return values;
    }

    List<DiscoveryMatchDto> readMatchList(JsonNode node, String fieldName) {
        return readTextList(node, fieldName).stream()
                .map(value -> new DiscoveryMatchDto(value, value))
                .toList();
    }

    double safeScore(Double score) {
        return score == null ? 0d : score;
    }
}

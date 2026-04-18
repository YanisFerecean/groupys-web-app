package com.groupys.service;

import com.groupys.config.PerformanceFeatureFlags;
import com.groupys.model.*;
import com.groupys.model.community.Community;
import com.groupys.repository.*;
import com.groupys.util.CountryUtil;
import com.groupys.util.DiscoveryScoreUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;

import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class TasteProfileService {

    private static final String SOURCE_COMMUNITY_MEMBERSHIP = "COMMUNITY_MEMBERSHIP";

    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final UserArtistPreferenceRepository userArtistPreferenceRepository;
    private final UserGenrePreferenceRepository userGenrePreferenceRepository;
    private final CommunityTasteProfileRepository communityTasteProfileRepository;
    private final CommunityArtistRepository communityArtistRepository;
    private final CommunityGenreRepository communityGenreRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PostReactionRepository postReactionRepository;
    private final CommentReactionRepository commentReactionRepository;
    private final TasteEmbeddingService tasteEmbeddingService;
    private final PerformanceFeatureFlags flags;

    @Inject
    public TasteProfileService(
            UserRepository userRepository,
            CommunityRepository communityRepository,
            CommunityMemberRepository communityMemberRepository,
            ArtistRepository artistRepository,
            GenreRepository genreRepository,
            UserArtistPreferenceRepository userArtistPreferenceRepository,
            UserGenrePreferenceRepository userGenrePreferenceRepository,
            CommunityTasteProfileRepository communityTasteProfileRepository,
            CommunityArtistRepository communityArtistRepository,
            CommunityGenreRepository communityGenreRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            PostReactionRepository postReactionRepository,
            CommentReactionRepository commentReactionRepository,
            TasteEmbeddingService tasteEmbeddingService,
            PerformanceFeatureFlags flags) {
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.artistRepository = artistRepository;
        this.genreRepository = genreRepository;
        this.userArtistPreferenceRepository = userArtistPreferenceRepository;
        this.userGenrePreferenceRepository = userGenrePreferenceRepository;
        this.communityTasteProfileRepository = communityTasteProfileRepository;
        this.communityArtistRepository = communityArtistRepository;
        this.communityGenreRepository = communityGenreRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.postReactionRepository = postReactionRepository;
        this.commentReactionRepository = commentReactionRepository;
        this.tasteEmbeddingService = tasteEmbeddingService;
        this.flags = flags;
    }

    @Transactional
    public void refreshUserTasteProfile(User user) {
        UserTasteProfile profile = userTasteProfileRepository.findByUserId(user.id)
                .orElseGet(UserTasteProfile::new);
        List<UserArtistPreference> artists = userArtistPreferenceRepository.findByUser(user.id);
        List<UserGenrePreference> genres = userGenrePreferenceRepository.findByUser(user.id);
        List<CommunityMember> memberships = communityMemberRepository.findByUser(user.id);

        profile.user = user;
        profile.topArtistsCount = artists.size();
        profile.topGenresCount = genres.size();
        profile.topTracksCount = 0;
        profile.joinedCommunitiesCount = memberships.size();
        profile.musicActivityScore = DiscoveryScoreUtil.clamp01((artists.size() + genres.size()) / 20d);
        profile.communityActivityScore = DiscoveryScoreUtil.activityScore(
                postRepository.countByAuthor(user.id),
                commentRepository.countByAuthor(user.id),
                postReactionRepository.countByUser(user.id) + commentReactionRepository.countByUser(user.id)
        );
        String userCountryCode = CountryUtil.resolveCountryCode(user.countryCode, user.country);
        user.countryCode = userCountryCode;
        profile.countryCode = userCountryCode;
        profile.tasteSummaryText = DiscoveryScoreUtil.buildTasteSummary(
                artists.stream().map(pref -> pref.artist.getName()).limit(3).toList(),
                genres.stream().map(pref -> pref.genre.name).limit(3).toList()
        );
        profile.embeddingStatus = "NONE";
        profile.refreshedAt = Instant.now();
        if (profile.id == null) {
            userTasteProfileRepository.persist(profile);
        }

        user.tasteSummaryText = profile.tasteSummaryText;
        if (flags.vectorReadEnabled() || flags.vectorBootstrapEnabled()) {
            tasteEmbeddingService.refreshUserEmbedding(user.id);
        }
    }

    @Transactional
    public void refreshCommunityProfile(UUID communityId) {
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        List<CommunityMember> members = communityMemberRepository.findByCommunity(communityId);

        Map<Long, Double> artistWeights = new LinkedHashMap<>();
        Map<Long, Integer> artistSupport = new HashMap<>();
        Map<Long, Double> genreWeights = new LinkedHashMap<>();
        Map<Long, Integer> genreSupport = new HashMap<>();

        if (community.artist != null) {
            artistWeights.merge(community.artist.getId(), 2d, Double::sum);
            artistSupport.merge(community.artist.getId(), 1, Integer::sum);
        }

        findGenreForCommunity(community).ifPresent(genre -> {
            genreWeights.merge(genre.id, 2d, Double::sum);
            genreSupport.merge(genre.id, 1, Integer::sum);
        });

        for (CommunityMember member : members) {
            userArtistPreferenceRepository.findByUser(member.user.id).forEach(pref -> {
                artistWeights.merge(pref.artist.getId(), safeScore(pref.normalizedScore), Double::sum);
                artistSupport.merge(pref.artist.getId(), 1, Integer::sum);
            });
            userGenrePreferenceRepository.findByUser(member.user.id).forEach(pref -> {
                genreWeights.merge(pref.genre.id, safeScore(pref.normalizedScore), Double::sum);
                genreSupport.merge(pref.genre.id, 1, Integer::sum);
            });
        }

        communityArtistRepository.deleteByCommunity(communityId);
        communityGenreRepository.deleteByCommunity(communityId);

        Instant refreshedAt = Instant.now();
        artistWeights.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .limit(25)
                .forEach(entry -> {
                    Artist artist = artistRepository.findByIdOptional(entry.getKey()).orElse(null);
                    if (artist == null) {
                        return;
                    }
                    CommunityArtist communityArtist = new CommunityArtist();
                    communityArtist.community = community;
                    communityArtist.artist = artist;
                    communityArtist.source = "AGGREGATED";
                    communityArtist.memberSupportCount = artistSupport.getOrDefault(entry.getKey(), 0);
                    communityArtist.rawScore = entry.getValue();
                    communityArtist.normalizedScore = DiscoveryScoreUtil.clamp01(entry.getValue() / Math.max(1, members.size() + 2));
                    communityArtist.refreshedAt = refreshedAt;
                    communityArtistRepository.persist(communityArtist);
                });

        genreWeights.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .limit(25)
                .forEach(entry -> {
                    Genre genre = genreRepository.findByIdOptional(entry.getKey()).orElse(null);
                    if (genre == null) {
                        return;
                    }
                    CommunityGenre communityGenre = new CommunityGenre();
                    communityGenre.community = community;
                    communityGenre.genre = genre;
                    communityGenre.source = "AGGREGATED";
                    communityGenre.memberSupportCount = genreSupport.getOrDefault(entry.getKey(), 0);
                    communityGenre.rawScore = entry.getValue();
                    communityGenre.normalizedScore = DiscoveryScoreUtil.clamp01(entry.getValue() / Math.max(1, members.size() + 2));
                    communityGenre.refreshedAt = refreshedAt;
                    communityGenreRepository.persist(communityGenre);
                });

        CommunityTasteProfile profile = communityTasteProfileRepository.findByCommunityId(communityId)
                .orElseGet(CommunityTasteProfile::new);
        profile.community = community;
        profile.memberSampleSize = members.size();
        profile.topArtistsCount = Math.min(artistWeights.size(), 25);
        profile.topGenresCount = Math.min(genreWeights.size(), 25);
        profile.activityScore = DiscoveryScoreUtil.activityScore(
                postRepository.countByCommunity(communityId),
                commentRepository.countByCommunity(communityId),
                postReactionRepository.countByCommunity(communityId) + commentReactionRepository.countByCommunity(communityId)
        );
        String communityCountryCode = CountryUtil.resolveCountryCode(community.countryCode, community.country);
        community.countryCode = communityCountryCode;
        profile.countryCode = communityCountryCode;
        profile.tasteSummaryText = DiscoveryScoreUtil.buildTasteSummary(
                DiscoveryScoreUtil.topNames(resolveArtistNames(artistWeights), 3),
                DiscoveryScoreUtil.topNames(resolveGenreNames(genreWeights), 3)
        );
        profile.embeddingStatus = "NONE";
        profile.refreshedAt = refreshedAt;
        if (profile.id == null) {
            communityTasteProfileRepository.persist(profile);
        }

        community.lastProfileRefreshAt = refreshedAt;
        community.tasteSummaryText = profile.tasteSummaryText;
    }

    @Transactional
    public void rebuildCommunityDerivedPreferences(User user) {
        userArtistPreferenceRepository.delete("user.id = ?1 and source = ?2", user.id, SOURCE_COMMUNITY_MEMBERSHIP);
        userGenrePreferenceRepository.delete("user.id = ?1 and source = ?2", user.id, SOURCE_COMMUNITY_MEMBERSHIP);

        Map<Long, Double> artistWeights = new LinkedHashMap<>();
        Map<Long, Double> genreWeights = new LinkedHashMap<>();
        for (CommunityMember membership : communityMemberRepository.findByUser(user.id)) {
            Community community = membership.community;
            if (community.artist != null) {
                artistWeights.merge(community.artist.getId(), 1d, Double::sum);
            }
            findGenreForCommunity(community).ifPresent(genre -> genreWeights.merge(genre.id, 1d, Double::sum));
        }

        artistWeights.forEach((artistId, weight) -> {
            Artist artist = artistRepository.findByIdOptional(artistId).orElse(null);
            if (artist == null) {
                return;
            }
            UserArtistPreference pref = new UserArtistPreference();
            pref.user = user;
            pref.artist = artist;
            pref.source = SOURCE_COMMUNITY_MEMBERSHIP;
            pref.rawScore = weight;
            pref.normalizedScore = DiscoveryScoreUtil.clamp01(weight / Math.max(1, artistWeights.size()));
            pref.confidence = 0.7d;
            userArtistPreferenceRepository.persist(pref);
        });

        genreWeights.forEach((genreId, weight) -> {
            Genre genre = genreRepository.findByIdOptional(genreId).orElse(null);
            if (genre == null) {
                return;
            }
            UserGenrePreference pref = new UserGenrePreference();
            pref.user = user;
            pref.genre = genre;
            pref.source = SOURCE_COMMUNITY_MEMBERSHIP;
            pref.rawScore = weight;
            pref.normalizedScore = DiscoveryScoreUtil.clamp01(weight / Math.max(1, genreWeights.size()));
            pref.confidence = 0.7d;
            userGenrePreferenceRepository.persist(pref);
        });
    }

    @Transactional
    public void clearUserMusicPreferences(UUID userId) {
        userArtistPreferenceRepository.deleteByUser(userId);
        userGenrePreferenceRepository.deleteByUser(userId);
    }

    @Transactional
    public void saveOnboardingArtistPreferences(String clerkId, List<Long> artistIds) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        userArtistPreferenceRepository.delete("user.id = ?1 and source = ?2", user.id, "ONBOARDING");

        int total = artistIds.size();
        for (int index = 0; index < total; index++) {
            Long artistId = artistIds.get(index);
            Artist artist = artistRepository.findByIdOptional(artistId).orElse(null);
            if (artist == null) continue;

            double normalized = DiscoveryScoreUtil.normalizedRankScore(index + 1, total);

            UserArtistPreference pref = new UserArtistPreference();
            pref.user = user;
            pref.artist = artist;
            pref.source = "ONBOARDING";
            pref.sourceWindow = null;
            pref.rankPosition = index + 1;
            pref.rawScore = (double) (total - index);
            pref.normalizedScore = normalized;
            pref.confidence = 1.0;
            pref.explicitPreference = true;
            userArtistPreferenceRepository.persist(pref);
        }
    }

    public UserTasteProfile ensureUserProfile(UUID userId) {
        UserTasteProfile profile = userTasteProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            User user = userRepository.findByIdOptional(userId)
                    .orElseThrow(() -> new NotFoundException("User not found"));
            refreshUserTasteProfile(user);
            profile = userTasteProfileRepository.findByUserId(userId).orElse(null);
        }
        if (profile == null) {
            throw new NotFoundException("User profile not found");
        }
        return profile;
    }

    public CommunityTasteProfile ensureCommunityProfile(UUID communityId) {
        CommunityTasteProfile profile = communityTasteProfileRepository.findByCommunityId(communityId).orElse(null);
        if (profile == null) {
            refreshCommunityProfile(communityId);
            profile = communityTasteProfileRepository.findByCommunityId(communityId).orElse(null);
        }
        if (profile == null) {
            throw new NotFoundException("Community profile not found");
        }
        return profile;
    }

    Optional<Genre> findGenreForCommunity(Community community) {
        if (community.genre == null || community.genre.isBlank()) {
            return Optional.empty();
        }
        return genreRepository.findByNameIgnoreCase(community.genre.trim());
    }

    double safeScore(Double score) {
        return score == null ? 0d : score;
    }

    Map<String, Double> resolveArtistNames(Map<Long, Double> weights) {
        if (weights.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> artistNames = artistRepository.findNamesByIds(weights.keySet());
        Map<String, Double> names = new LinkedHashMap<>();
        weights.forEach((artistId, weight) -> {
            String artistName = artistNames.get(artistId);
            if (artistName != null) {
                names.put(artistName, weight);
            }
        });
        return names;
    }

    Map<String, Double> resolveGenreNames(Map<Long, Double> weights) {
        if (weights.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> genreNames = genreRepository.findNamesByIds(weights.keySet());
        Map<String, Double> names = new LinkedHashMap<>();
        weights.forEach((genreId, weight) -> {
            String name = genreNames.get(genreId);
            if (name != null) {
                names.put(name, weight);
            }
        });
        return names;
    }
}

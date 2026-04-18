package com.groupys.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupys.model.*;
import com.groupys.model.community.Community;
import com.groupys.repository.ArtistRepository;
import com.groupys.repository.GenreRepository;
import com.groupys.util.CountryUtil;
import com.groupys.util.DiscoveryScoreUtil;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class ScoreCalculationService {

    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public ScoreCalculationService(ArtistRepository artistRepository, GenreRepository genreRepository) {
        this.artistRepository = artistRepository;
        this.genreRepository = genreRepository;
    }

    public double calculateUserMatchScore(
            double artistScore,
            double genreScore,
            double sharedCommunityScore,
            double activityScore,
            double countryScore,
            double followGraphScore,
            double friendsOfFriendsScore) {
        return DiscoveryScoreUtil.userMatchScore(
                artistScore, genreScore, sharedCommunityScore, activityScore,
                countryScore, followGraphScore, friendsOfFriendsScore);
    }

    public double calculateCommunityMatchScore(
            double artistScore,
            double genreScore,
            double socialFit,
            double activityFit,
            double countryScore,
            double novelty) {
        return 0.35 * artistScore
                + 0.25 * genreScore
                + 0.15 * socialFit
                + 0.10 * activityFit
                + 0.10 * countryScore
                + 0.05 * novelty;
    }

    public double calculateArtistOverlapScore(
            Map<Long, UserArtistPreference> userArtists,
            Map<Long, UserArtistPreference> candidateArtists) {
        return DiscoveryScoreUtil.weightedOverlap(
                toScoreMap(userArtists, preference -> preference.normalizedScore),
                toScoreMap(candidateArtists, preference -> preference.normalizedScore));
    }

    public double calculateArtistOverlapScore(
            Map<Long, UserArtistPreference> userArtists,
            Map<Long, CommunityArtist> communityArtists) {
        return DiscoveryScoreUtil.weightedOverlap(
                toScoreMap(userArtists, preference -> preference.normalizedScore),
                toScoreMap(communityArtists, preference -> preference.normalizedScore));
    }

    public double calculateGenreOverlapScore(
            Map<Long, UserGenrePreference> userGenres,
            Map<Long, UserGenrePreference> candidateGenres) {
        return DiscoveryScoreUtil.weightedOverlap(
                toScoreMap(userGenres, preference -> preference.normalizedScore),
                toScoreMap(candidateGenres, preference -> preference.normalizedScore));
    }

    public double calculateGenreOverlapScore(
            Map<Long, UserGenrePreference> userGenres,
            Map<Long, CommunityGenre> communityGenres) {
        return DiscoveryScoreUtil.weightedOverlap(
                toScoreMap(userGenres, preference -> preference.normalizedScore),
                toScoreMap(communityGenres, preference -> preference.normalizedScore));
    }

    public double calculateSocialFit(long sharedMembers, int memberCount) {
        return DiscoveryScoreUtil.normalizedCount(sharedMembers, Math.max(1, memberCount));
    }

    public double calculateActivityFit(CommunityTasteProfile profile, int memberCount) {
        double activityFit = DiscoveryScoreUtil.clamp01(profile.activityScore != null ? profile.activityScore : 0d);
        if (memberCount > 0) {
            activityFit = Math.max(activityFit, DiscoveryScoreUtil.clamp01(memberCount / 25d) * 0.5d);
        }
        return activityFit;
    }

    public double calculateCountryScore(User user, Community community) {
        return DiscoveryScoreUtil.countryMatchScore(
                resolveCountryValue(user.countryCode, user.country),
                resolveCountryValue(community.countryCode, community.country));
    }

    public double calculateCountryScore(User left, User right) {
        return DiscoveryScoreUtil.countryMatchScore(
                resolveCountryValue(left.countryCode, left.country),
                resolveCountryValue(right.countryCode, right.country));
    }

    public double calculateNoveltyScore(int memberCount) {
        return memberCount <= 150 ? 1d : 0.6d;
    }

    public Explanation buildCommunityExplanation(
            Map<Long, UserArtistPreference> userArtists,
            Map<Long, UserGenrePreference> userGenres,
            Map<Long, CommunityArtist> communityArtists,
            Map<Long, CommunityGenre> communityGenres,
            int sharedCommunityCount,
            boolean countryMatch) {
        List<String> reasonCodes = new ArrayList<>();
        List<String> artistNames = intersectArtistNames(userArtists.keySet(), communityArtists.keySet());
        List<String> genreNames = intersectGenreNames(userGenres.keySet(), communityGenres.keySet());
        if (!artistNames.isEmpty()) {
            reasonCodes.add("SHARED_TOP_ARTISTS");
        }
        if (!genreNames.isEmpty()) {
            reasonCodes.add("SHARED_GENRES");
        }
        if (sharedCommunityCount > 0) {
            reasonCodes.add("SIMILAR_COMMUNITY_MEMBERS");
        }
        if (countryMatch) {
            reasonCodes.add("SAME_COUNTRY");
        }
        String explanation = buildExplanationText(artistNames, genreNames, sharedCommunityCount, countryMatch);
        return serializeExplanation(explanation, reasonCodes, artistNames, genreNames, sharedCommunityCount, countryMatch, 0, 0);
    }

    public Explanation buildUserExplanation(
            Map<Long, UserArtistPreference> userArtists,
            Map<Long, UserGenrePreference> userGenres,
            Map<Long, UserArtistPreference> candidateArtists,
            Map<Long, UserGenrePreference> candidateGenres,
            int sharedCommunityCount,
            boolean countryMatch,
            int mutualFollowCount,
            int sharedFriendsCount) {
        List<String> reasonCodes = new ArrayList<>();
        List<String> artistNames = intersectArtistNames(userArtists.keySet(), candidateArtists.keySet());
        List<String> genreNames = intersectGenreNames(userGenres.keySet(), candidateGenres.keySet());
        if (!artistNames.isEmpty()) {
            reasonCodes.add("SHARED_TOP_ARTISTS");
        }
        if (!genreNames.isEmpty()) {
            reasonCodes.add("SHARED_GENRES");
        }
        if (sharedCommunityCount > 0) {
            reasonCodes.add("SHARED_COMMUNITIES");
        }
        if (countryMatch) {
            reasonCodes.add("SAME_COUNTRY");
        }
        if (mutualFollowCount > 0) {
            reasonCodes.add("FOLLOW_GRAPH_PROXIMITY");
        }
        if (sharedFriendsCount > 0) {
            reasonCodes.add("FRIENDS_OF_FRIENDS");
        }
        String explanation = buildExplanationText(artistNames, genreNames, sharedCommunityCount, countryMatch);
        return serializeExplanation(explanation, reasonCodes, artistNames, genreNames, sharedCommunityCount, countryMatch, mutualFollowCount, sharedFriendsCount);
    }

    Explanation serializeExplanation(String explanation,
            List<String> reasonCodes,
            List<String> artistNames,
            List<String> genreNames,
            int sharedCommunityCount,
            boolean countryMatch,
            int mutualFollowCount,
            int sharedFriendsCount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("explanation", explanation);
        payload.put("reasonCodes", reasonCodes);
        payload.put("matchedArtists", artistNames);
        payload.put("matchedGenres", genreNames);
        payload.put("sharedCommunityCount", sharedCommunityCount);
        payload.put("countryMatch", countryMatch);
        payload.put("mutualFollowCount", mutualFollowCount);
        payload.put("sharedFriendsCount", sharedFriendsCount);
        try {
            return new Explanation(reasonCodes, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize explanation", e);
        }
    }

    String buildExplanationText(List<String> artistNames,
            List<String> genreNames,
            int sharedCommunityCount,
            boolean countryMatch) {
        if (!artistNames.isEmpty()) {
            return "Because you both like " + String.join(", ", artistNames);
        }
        if (!genreNames.isEmpty()) {
            return "Because you both lean " + String.join(", ", genreNames);
        }
        if (sharedCommunityCount > 0) {
            return "Because you already overlap on " + sharedCommunityCount + " communities";
        }
        if (countryMatch) {
            return "Relevant in your country";
        }
        return "Recommended from your taste and community activity";
    }

    List<String> intersectArtistNames(Set<Long> left, Set<Long> right) {
        Set<Long> intersection = new HashSet<>(left);
        intersection.retainAll(right);
        if (intersection.isEmpty()) {
            return List.of();
        }
        Map<Long, String> artistNames = artistRepository.findNamesByIds(
                intersection.stream().limit(3).toList()
        );
        return new ArrayList<>(artistNames.values());
    }

    List<String> intersectGenreNames(Set<Long> left, Set<Long> right) {
        Set<Long> intersection = new HashSet<>(left);
        intersection.retainAll(right);
        if (intersection.isEmpty()) {
            return List.of();
        }
        Map<Long, String> genreNames = genreRepository.findNamesByIds(
                intersection.stream().limit(3).toList()
        );
        return new ArrayList<>(genreNames.values());
    }

    <K, T> Map<K, Double> toScoreMap(Map<K, T> input, ScoreExtractor<T> extractor) {
        return input.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> safeScore(extractor.score(entry.getValue()))));
    }

    double safeScore(Double score) {
        return score == null ? 0d : score;
    }

    String resolveCountryValue(String primaryCode, String fallbackCountry) {
        String countryCode = CountryUtil.resolveCountryCode(primaryCode, fallbackCountry);
        return countryCode != null ? countryCode : firstNonBlank(primaryCode, fallbackCountry);
    }

    String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback.trim();
        }
        return null;
    }

    @FunctionalInterface
    public interface ScoreExtractor<T> {
        Double score(T value);
    }

    public record Explanation(List<String> reasonCodes, String json) {
    }
}

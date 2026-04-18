package com.groupys.service;

import com.groupys.dto.UserCreateDto;
import com.groupys.dto.UserResDto;
import com.groupys.dto.UserUpdateDto;
import com.groupys.model.User;
import com.groupys.repository.UserFollowRepository;
import com.groupys.repository.UserRepository;
import com.groupys.util.CountryUtil;
import com.groupys.util.UserUtil;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@ApplicationScoped
public class UserService {

    private final UserRepository userRepository;
    private final UserFollowRepository userFollowRepository;
    private final DiscoveryService discoveryService;

    @Inject
    public UserService(
            UserRepository userRepository,
            UserFollowRepository userFollowRepository,
            DiscoveryService discoveryService) {
        this.userRepository = userRepository;
        this.userFollowRepository = userFollowRepository;
        this.discoveryService = discoveryService;
    }

    public List<UserResDto> listAll() {
        return userRepository.listAll().stream()
                .map(this::mapUser)
                .toList();
    }

    public UserResDto getById(UUID id) {
        User user = userRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return mapUser(user);
    }

    public UserResDto getByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return mapUser(user);
    }

    public UserResDto getByClerkId(String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return mapUser(user);
    }

    public Optional<UserResDto> findByClerkId(String clerkId) {
        return userRepository.findByClerkId(clerkId).map(this::mapUser);
    }

    public List<UserResDto> search(String clerkId, String query, int limit) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            return List.of();
        }

        int cappedLimit = Math.max(1, Math.min(limit, 20));
        UUID excludeUserId = userRepository.findByClerkId(clerkId)
                .map(user -> user.id)
                .orElse(null);
        return userRepository.searchByUsernameOrDisplayName(normalizedQuery, excludeUserId, cappedLimit)
                .stream()
                .map(this::mapUser)
                .toList();
    }

    UserResDto mapUser(User user) {
        long followers = userFollowRepository.countFollowers(user.id);
        long following = userFollowRepository.countFollowing(user.id);
        return UserUtil.toDto(user, followers, following);
    }

    @Transactional
    public UserResDto create(UserCreateDto dto) {
        User user = new User();
        user.clerkId = dto.clerkId();
        user.username = dto.username();
        user.displayName = dto.displayName();
        user.bio = dto.bio();
        user.profileImage = dto.profileImage();
        user.country = dto.country();
        user.countryCode = CountryUtil.resolveCountryCode(dto.countryCode(), dto.country());
        user.tasteSummaryText = dto.tasteSummaryText();
        if (dto.recommendationOptOut() != null) {
            user.recommendationOptOut = dto.recommendationOptOut();
        }
        if (dto.discoveryVisible() != null) {
            user.discoveryVisible = dto.discoveryVisible();
        }
        userRepository.persist(user);
        discoveryService.refreshAfterUserChange(user.id);
        return mapUser(user);
    }

    @Transactional
    public UserResDto update(UUID id, UserUpdateDto dto) {
        User user = userRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        user.displayName = dto.displayName();
        user.bio = dto.bio();
        user.country = dto.country();
        user.countryCode = CountryUtil.resolveCountryCode(dto.countryCode(), dto.country());
        user.bannerUrl = dto.bannerUrl();
        user.bannerText = dto.bannerText();
        user.accentColor = dto.accentColor();
        user.nameColor = dto.nameColor();
        if (dto.profileImage() != null) {
            user.profileImage = dto.profileImage();
        }
        if (dto.widgets() != null) {
            user.widgets = dto.widgets();
        }
        if (dto.tags() != null) {
            user.tags = dto.tags();
        }
        if (dto.website() != null) {
            user.website = dto.website();
        }
        if (dto.jobTitle() != null) {
            user.jobTitle = dto.jobTitle();
        }
        if (dto.location() != null) {
            user.location = dto.location();
        }
        if (dto.tasteSummaryText() != null) {
            user.tasteSummaryText = dto.tasteSummaryText();
        }
        if (dto.recommendationOptOut() != null) {
            user.recommendationOptOut = dto.recommendationOptOut();
        }
        if (dto.discoveryVisible() != null) {
            user.discoveryVisible = dto.discoveryVisible();
        }
        final UUID userId = user.id;
        CompletableFuture.runAsync(() -> {
            try {
                discoveryService.refreshAfterUserChange(userId);
            } catch (Exception e) {
                Log.warnf(e, "Background discovery refresh failed for user %s", userId);
            }
        });
        return mapUser(user);
    }

    @Transactional
    public void delete(UUID id) {
        User user = userRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
        userRepository.delete(user);
    }

    @Transactional
    public void deleteOwnAccount(String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        purgeUserData(user.id);
        userRepository.delete(user);
    }

    public String getPublicKeyByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (user.publicKey == null) throw new NotFoundException("Public key not set");
        return user.publicKey;
    }

    @Transactional
    public void savePublicKey(String clerkId, String publicKey) {
        User user = userRepository.findByClerkId(clerkId)
            .orElseThrow(() -> new NotFoundException("User not found"));
        user.publicKey = publicKey;
    }

    @Transactional
    public UserResDto updateBanner(String clerkId, String bannerUrl) {
        User user = userRepository.findByClerkId(clerkId)
            .orElseThrow(() -> new NotFoundException("User not found"));
        user.bannerUrl = bannerUrl;
        // Initialize lazy collections before the session closes
        user.tags.size();
        discoveryService.refreshAfterUserChange(user.id);
        return mapUser(user);
    }

    void purgeUserData(UUID userId) {
        EntityManager em = userRepository.getEntityManager();

        // Recommendation/discovery data
        nativeUpdate(em, "DELETE FROM user_similarity_cache WHERE user_id = :userId OR candidate_user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM community_recommendation_cache WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM user_discovery_action WHERE user_id = :userId OR target_user_id = :userId", userId);

        // Relationship graph
        nativeUpdate(em, "DELETE FROM user_follow WHERE follower_user_id = :userId OR followed_user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM friendships WHERE requester_id = :userId OR recipient_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM user_likes WHERE from_user_id = :userId OR to_user_id = :userId", userId);

        // Match/chat references
        nativeUpdate(em, "UPDATE conversations SET requested_by_user_id = NULL WHERE requested_by_user_id = :userId", userId);
        nativeUpdate(em, """
                UPDATE conversations
                SET match_id = NULL
                WHERE match_id IN (
                    SELECT id
                    FROM user_matches
                    WHERE user_a_id = :userId OR user_b_id = :userId
                )
                """, userId);
        nativeUpdate(em, "DELETE FROM user_matches WHERE user_a_id = :userId OR user_b_id = :userId", userId);

        // User-generated content and interactions
        nativeUpdate(em, "DELETE FROM post_reactions WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM comment_reactions WHERE user_id = :userId", userId);

        nativeUpdate(em, """
                DELETE FROM post_reactions
                WHERE post_id IN (
                    SELECT id
                    FROM posts
                    WHERE author_id = :userId
                )
                """, userId);
        nativeUpdate(em, """
                DELETE FROM comment_reactions
                WHERE comment_id IN (
                    SELECT id
                    FROM comments
                    WHERE author_id = :userId
                       OR post_id IN (SELECT id FROM posts WHERE author_id = :userId)
                )
                """, userId);

        nativeUpdate(em, """
                UPDATE comments
                SET parent_comment_id = NULL
                WHERE parent_comment_id IN (
                    SELECT id
                    FROM comments
                    WHERE author_id = :userId
                       OR post_id IN (SELECT id FROM posts WHERE author_id = :userId)
                )
                """, userId);
        nativeUpdate(em, """
                DELETE FROM comments
                WHERE author_id = :userId
                   OR post_id IN (SELECT id FROM posts WHERE author_id = :userId)
                """, userId);

        nativeUpdate(em, """
                DELETE FROM post_media
                WHERE post_id IN (
                    SELECT id
                    FROM posts
                    WHERE author_id = :userId
                )
                """, userId);
        nativeUpdate(em, "DELETE FROM posts WHERE author_id = :userId", userId);

        nativeUpdate(em, "DELETE FROM hot_take_answers WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM album_ratings WHERE user_id = :userId", userId);

        // Discovery/music profile data
        nativeUpdate(em, "DELETE FROM user_artist_preference WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM user_genre_preference WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM user_track_preference WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM user_taste_profile WHERE user_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM music_source_snapshot WHERE user_id = :userId", userId);

        // Communities
        nativeUpdate(em, "UPDATE communities SET created_by = NULL WHERE created_by = :userId", userId);
        nativeUpdate(em, """
                UPDATE communities
                SET member_count = GREATEST(member_count - 1, 0)
                WHERE id IN (
                    SELECT community_id
                    FROM community_members
                    WHERE user_id = :userId
                )
                """, userId);
        nativeUpdate(em, "DELETE FROM community_members WHERE user_id = :userId", userId);

        // Conversations and messages
        nativeUpdate(em, "DELETE FROM messages WHERE sender_id = :userId", userId);
        nativeUpdate(em, "DELETE FROM conversation_participants WHERE user_id = :userId", userId);
        nativeUpdate(em, """
                DELETE FROM messages
                WHERE conversation_id IN (
                    SELECT c.id
                    FROM conversations c
                    LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
                    GROUP BY c.id, c.is_group
                    HAVING COUNT(cp.id) = 0 OR (c.is_group = false AND COUNT(cp.id) < 2)
                )
                """);
        nativeUpdate(em, """
                DELETE FROM conversations
                WHERE id IN (
                    SELECT c.id
                    FROM conversations c
                    LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
                    GROUP BY c.id, c.is_group
                    HAVING COUNT(cp.id) = 0 OR (c.is_group = false AND COUNT(cp.id) < 2)
                )
                """);

        // Embedded collections
        nativeUpdate(em, "DELETE FROM user_tags WHERE user_id = :userId", userId);
    }

    void nativeUpdate(EntityManager em, String sql, UUID userId) {
        try {
            em.createNativeQuery(sql)
            .setParameter("userId", userId)
            .executeUpdate();
        } catch (Exception e) {
            // Log without including the SQL to prevent log injection
            Log.warnf(e, "Account deletion cleanup query failed for user %s", userId);
            throw e;
        }
    }

    void nativeUpdate(EntityManager em, String sql) {
        try {
            em.createNativeQuery(sql).executeUpdate();
        } catch (Exception e) {
            // Log without including the SQL to prevent log injection
            Log.warnf(e, "Account deletion cleanup query failed");
            throw e;
        }
    }
}

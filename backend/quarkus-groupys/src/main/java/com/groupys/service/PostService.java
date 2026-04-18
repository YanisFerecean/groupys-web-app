package com.groupys.service;

import com.groupys.config.PerformanceFeatureFlags;
import com.groupys.dto.PostResDto;
import com.groupys.event.CommunityActivityEvent;
import com.groupys.model.Community;
import com.groupys.model.CommunityRecommendationCache;
import com.groupys.model.Post;
import com.groupys.model.PostMedia;
import com.groupys.model.PostReaction;
import com.groupys.model.User;
import com.groupys.repository.*;
import io.quarkus.cache.CacheInvalidateAll;
import io.quarkus.cache.CacheResult;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class PostService {

    private final PostRepository postRepository;
    private final CommunityRepository communityRepository;
    private final UserRepository userRepository;
    private final PostReactionRepository postReactionRepository;
    private final CommentRepository commentRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final CommunityRecommendationCacheRepository communityRecommendationCacheRepository;
    private final FriendshipRepository friendshipRepository;
    private final CommentService commentService;
    private final StorageService storageService;
    private final Event<CommunityActivityEvent> communityActivityEvent;
    private final PerformanceFeatureFlags flags;

    @Inject
    public PostService(
            PostRepository postRepository,
            CommunityRepository communityRepository,
            UserRepository userRepository,
            PostReactionRepository postReactionRepository,
            CommentRepository commentRepository,
            CommunityMemberRepository communityMemberRepository,
            CommunityRecommendationCacheRepository communityRecommendationCacheRepository,
            FriendshipRepository friendshipRepository,
            CommentService commentService,
            StorageService storageService,
            Event<CommunityActivityEvent> communityActivityEvent,
            PerformanceFeatureFlags flags) {
        this.postRepository = postRepository;
        this.communityRepository = communityRepository;
        this.userRepository = userRepository;
        this.postReactionRepository = postReactionRepository;
        this.commentRepository = commentRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.communityRecommendationCacheRepository = communityRecommendationCacheRepository;
        this.friendshipRepository = friendshipRepository;
        this.commentService = commentService;
        this.storageService = storageService;
        this.communityActivityEvent = communityActivityEvent;
        this.flags = flags;
    }

    @CacheResult(cacheName = "feed")
    public List<PostResDto> getFeed(String clerkId, int page, int size) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        // Joined community posts
        List<UUID> joinedIds = communityMemberRepository.findByUserLimited(user.id, 200).stream()
                .map(m -> m.community.id)
                .toList();

        // Recommended communities the user hasn't joined yet (score >= 0.35)
        Set<UUID> joinedSet = new HashSet<>(joinedIds);
        List<CommunityRecommendationCache> recCaches = communityRecommendationCacheRepository
                .findFreshByUser(user.id, 30).stream()
                .filter(c -> !joinedSet.contains(c.community.id) && c.score >= 0.35)
                .toList();
        List<UUID> recIds = recCaches.stream().map(c -> c.community.id).toList();
        Map<UUID, Double> recScoreMap = recCaches.stream()
                .collect(Collectors.toMap(c -> c.community.id, c -> c.score));

        // Friend signals: posts authored by friends / liked by friends in non-joined communities
        Set<UUID> friendIds = friendshipRepository.findAcceptedFriendIds(user.id);

        // Fetch recent posts from all sources (3x pool for accurate pagination, capped at 300)
        int poolSize = Math.min((page + 1) * size * 3, 300);
        List<Post> joinedPosts = joinedIds.isEmpty() ? List.of()
                : postRepository.findByCommunitiesRecentLimited(joinedIds, poolSize);
        List<Post> recPosts = recIds.isEmpty() ? List.of()
                : postRepository.findByCommunitiesRecentLimited(recIds, poolSize / 2);
        List<Post> friendAuthoredPosts = friendIds.isEmpty() ? List.of()
                : postRepository.findByAuthorsInNonJoinedCommunities(friendIds, joinedSet, poolSize / 2);
        List<Object[]> friendLikedRows = friendIds.isEmpty() ? List.of()
                : postRepository.findLikedByFriendsInNonJoinedCommunities(friendIds, joinedSet, poolSize / 2);
        List<Post> friendLikedPosts = friendLikedRows.stream().map(row -> (Post) row[0]).toList();
        // Map post ID → first friend who liked it (for the "liked by @..." label)
        Map<UUID, User> friendLikerMap = new java.util.HashMap<>();
        for (Object[] row : friendLikedRows) {
            friendLikerMap.putIfAbsent(((Post) row[0]).id, (User) row[1]);
        }

        // Score: recency decay * community weight
        // Joined = 1.0 | friend authored = 0.80 | friend liked = 0.60 | recommended = score * 0.65
        record ScoredPost(Post post, double score) {}
        Instant now = Instant.now();
        List<ScoredPost> scored = new ArrayList<>(
                joinedPosts.size() + recPosts.size() + friendAuthoredPosts.size() + friendLikedPosts.size());
        for (Post p : joinedPosts) {
            double hoursAgo = Duration.between(p.createdAt, now).toHours();
            double recency = 1.0 / (1.0 + hoursAgo / 24.0);
            scored.add(new ScoredPost(p, recency));
        }
        for (Post p : recPosts) {
            double communityScore = recScoreMap.getOrDefault(p.community.id, 0.35);
            double hoursAgo = Duration.between(p.createdAt, now).toHours();
            double recency = 1.0 / (1.0 + hoursAgo / 24.0);
            scored.add(new ScoredPost(p, recency * communityScore * 0.65));
        }
        for (Post p : friendAuthoredPosts) {
            double hoursAgo = Duration.between(p.createdAt, now).toHours();
            double recency = 1.0 / (1.0 + hoursAgo / 24.0);
            scored.add(new ScoredPost(p, recency * 0.80));
        }
        for (Post p : friendLikedPosts) {
            double hoursAgo = Duration.between(p.createdAt, now).toHours();
            double recency = 1.0 / (1.0 + hoursAgo / 24.0);
            scored.add(new ScoredPost(p, recency * 0.60));
        }

        // Reason map: priority FRIEND_POSTED > FRIEND_LIKED > RECOMMENDED_COMMUNITY
        Map<UUID, String> reasonMap = new java.util.HashMap<>();
        for (Post p : recPosts) reasonMap.putIfAbsent(p.id, "RECOMMENDED_COMMUNITY");
        for (Post p : friendLikedPosts) {
            if (!"FRIEND_POSTED".equals(reasonMap.get(p.id))) reasonMap.put(p.id, "FRIEND_LIKED");
        }
        for (Post p : friendAuthoredPosts) reasonMap.put(p.id, "FRIEND_POSTED");

        // Sort, deduplicate, paginate
        Set<UUID> seen = new HashSet<>();
        List<Post> result = scored.stream()
                .sorted(Comparator.comparingDouble(ScoredPost::score).reversed())
                .filter(sp -> seen.add(sp.post.id))
                .map(ScoredPost::post)
                .skip((long) page * size)
                .limit(size)
                .toList();

        return toDtoList(result, user, reasonMap, friendLikerMap);
    }

    public List<PostResDto> getByCommunity(UUID communityId, String clerkId, int page, int size) {
        User user = userRepository.findByClerkId(clerkId).orElse(null);
        List<Post> posts = postRepository.findByCommunityPaged(communityId, page, size);
        return toDtoList(posts, user);
    }

    public List<PostResDto> getAccountPosts(String clerkId, int page, int size) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        List<Post> posts = postRepository.findByAuthorPaged(user.id, page, size);
        return toDtoList(posts, user);
    }

    public List<PostResDto> getLikedPosts(String clerkId, int page, int size) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        List<Post> posts = postRepository.findLikedByUserPaged(user.id, page, size);
        return toDtoList(posts, user);
    }

    public List<PostResDto> getByAuthor(UUID authorId, String clerkId) {
        User currentUser = userRepository.findByClerkId(clerkId).orElse(null);
        User author = userRepository.findByIdOptional(authorId).orElse(null);

        // Check privacy: only return posts if the author's profile is public or the current user is following them
        if (author != null && currentUser != null && !author.id.equals(currentUser.id)) {
            // Check if current user can view this author's posts (friendship exists)
            boolean canView = friendshipRepository.isFriend(author.id, currentUser.id);
            if (!canView) {
                // Return empty list if not friends - can be customized based on privacy settings
                return List.of();
            }
        }

        return postRepository.findByAuthor(authorId).stream()
            .map(post -> toDto(post, currentUser))
            .toList();
    }

    public PostResDto getById(UUID postId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId).orElse(null);
        Post post = postRepository.findByIdOptional(postId)
                .orElseThrow(() -> new NotFoundException("Post not found"));
        return toDtoList(List.of(post), user).get(0);
    }

    @Transactional
    @CacheInvalidateAll(cacheName = "feed")
    public PostResDto create(UUID communityId, String title, String content, List<PostMedia> mediaList, String clerkId) {
        User author = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));

        Post post = new Post();
        post.title = title;
        post.content = content;
        if (mediaList != null) {
            post.media = new java.util.ArrayList<>(mediaList);
        }
        post.community = community;
        post.author = author;
        post.likeCount = 0L;
        post.dislikeCount = 0L;
        post.commentCount = 0L;
        postRepository.persist(post);
        communityActivityEvent.fireAsync(new CommunityActivityEvent(communityId))
                .exceptionally(e -> { Log.warnf(e, "Async discovery refresh failed after post in community %s", communityId); return null; });

        return toDtoList(List.of(post), author).get(0);
    }

    @Transactional
    @CacheInvalidateAll(cacheName = "feed")
    public PostResDto react(UUID postId, String reactionType, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Post post = postRepository.findByIdOptional(postId)
                .orElseThrow(() -> new NotFoundException("Post not found"));
        String normalizedReaction = reactionType == null ? "" : reactionType.trim().toLowerCase();
        if (!"like".equals(normalizedReaction) && !"dislike".equals(normalizedReaction)) {
            throw new jakarta.ws.rs.BadRequestException("Reaction type must be 'like' or 'dislike'");
        }

        var existing = postReactionRepository.findByPostAndUser(postId, user.id);

        if (existing.isPresent()) {
            PostReaction reaction = existing.get();
            String oldType = reaction.reactionType == null ? "" : reaction.reactionType.toLowerCase();
            if (oldType.equals(normalizedReaction)) {
                postReactionRepository.delete(reaction);
                applyPostReactionDelta(post, oldType, -1);
            } else {
                reaction.reactionType = normalizedReaction;
                applyPostReactionDelta(post, oldType, -1);
                applyPostReactionDelta(post, normalizedReaction, 1);
            }
        } else {
            PostReaction reaction = new PostReaction();
            reaction.post = post;
            reaction.user = user;
            reaction.reactionType = normalizedReaction;
            postReactionRepository.persist(reaction);
            applyPostReactionDelta(post, normalizedReaction, 1);
        }

        communityActivityEvent.fireAsync(new CommunityActivityEvent(post.community.id))
                .exceptionally(e -> { Log.warnf(e, "Async discovery refresh failed after reaction on post %s", postId); return null; });

        return toDtoList(List.of(post), user).get(0);
    }

    @Transactional
    public void delete(UUID postId, String clerkId) {
        Post post = postRepository.findByIdOptional(postId)
                .orElseThrow(() -> new NotFoundException("Post not found"));
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        boolean isAuthor = post.author.id.equals(user.id);
        boolean isCommunityOwner = post.community.createdBy != null
                && post.community.createdBy.id.equals(user.id);
        if (!isAuthor && !isCommunityOwner) {
            throw new jakarta.ws.rs.ForbiddenException("Not authorized to delete this post");
        }
        UUID communityId = post.community.id;
        commentService.deleteAllByPost(postId);
        postReactionRepository.delete("post.id", postId);
        if (post.media != null && !post.media.isEmpty()) {
            for (PostMedia pm : post.media) {
                storageService.delete(pm.url);
            }
        }
        postRepository.delete(post);
        communityActivityEvent.fireAsync(new CommunityActivityEvent(communityId))
                .exceptionally(e -> { Log.warnf(e, "Async discovery refresh failed after delete of post %s in community %s", postId, communityId); return null; });
    }

    /**
     * Converts a list of posts to DTOs using 4 batch queries total regardless of list size,
     * eliminating the previous N×4 query pattern.
     */
    List<PostResDto> toDtoList(List<Post> posts, User currentUser) {
        return toDtoList(posts, currentUser, Map.of(), Map.of());
    }

    List<PostResDto> toDtoList(List<Post> posts, User currentUser, Map<UUID, String> reasonMap) {
        return toDtoList(posts, currentUser, reasonMap, Map.of());
    }

    List<PostResDto> toDtoList(List<Post> posts, User currentUser, Map<UUID, String> reasonMap,
                                       Map<UUID, User> friendLikerMap) {
        if (posts.isEmpty()) return List.of();

        List<UUID> postIds = posts.stream().map(p -> p.id).toList();
        Map<UUID, String> userReactionMap = currentUser != null
                ? postReactionRepository.findUserReactionsByPostIds(postIds, currentUser.id)
                : Map.of();

        Map<UUID, long[]> reactionCountsTmp = Map.of();
        Map<UUID, Long> commentMapTmp = Map.of();
        boolean readModelRead = readModelReadEnabled();
        if (!readModelRead) {
            reactionCountsTmp = postReactionRepository.countAllReactionsByPostIds(postIds);
            commentMapTmp = commentRepository.countsByPostIds(postIds);
        }
        final Map<UUID, long[]> reactionCounts = reactionCountsTmp;
        final Map<UUID, Long> commentMap = commentMapTmp;
        final boolean readModelEnabled = readModelRead;

        return posts.stream().map(post -> {
            List<PostResDto.PostMediaDto> mediaDtos = new ArrayList<>();
            if (post.media != null) {
                for (int i = 0; i < post.media.size(); i++) {
                    PostMedia m = post.media.get(i);
                    mediaDtos.add(new PostResDto.PostMediaDto(m.url, m.type, i));
                }
            }
            String reason = reasonMap.get(post.id);
            User liker = "FRIEND_LIKED".equals(reason) ? friendLikerMap.get(post.id) : null;
            long[] rc = reactionCounts.get(post.id);
            return new PostResDto(
                    post.id,
                    post.content,
                    mediaDtos,
                    post.community.id,
                    post.community.name,
                    post.author.id,
                    post.author.username,
                    post.author.displayName,
                    post.author.profileImage,
                    post.author.clerkId,
                    post.createdAt,
                    readModelEnabled ? Math.max(0L, post.likeCount) : (rc != null ? rc[0] : 0L),
                    readModelEnabled ? Math.max(0L, post.dislikeCount) : (rc != null ? rc[1] : 0L),
                    userReactionMap.get(post.id),
                    readModelEnabled ? Math.max(0L, post.commentCount) : commentMap.getOrDefault(post.id, 0L),
                    post.title,
                    reason,
                    liker != null ? liker.username : null,
                    liker != null ? liker.profileImage : null
            );
        }).toList();
    }

    PostResDto toDto(Post post, User currentUser) {
        return toDtoList(List.of(post), currentUser).get(0);
    }

    void applyPostReactionDelta(Post post, String reactionType, int delta) {
        if (!readModelWriteEnabled()) {
            return;
        }
        if ("like".equals(reactionType)) {
            post.likeCount = Math.max(0L, post.likeCount + delta);
        } else if ("dislike".equals(reactionType)) {
            post.dislikeCount = Math.max(0L, post.dislikeCount + delta);
        }
    }

    boolean readModelReadEnabled() {
        return flags != null && flags.readModelReadEnabled();
    }

    boolean readModelWriteEnabled() {
        return flags != null && flags.readModelWriteEnabled();
    }
}

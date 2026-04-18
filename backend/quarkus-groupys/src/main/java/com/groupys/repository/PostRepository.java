package com.groupys.repository;

import com.groupys.model.Post;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class PostRepository implements PanacheRepositoryBase<Post, UUID> {

    public List<Post> findByCommunity(UUID communityId) {
        return find("FROM Post p LEFT JOIN FETCH p.community LEFT JOIN FETCH p.author " +
            "WHERE p.community.id = ?1 ORDER BY p.createdAt DESC", communityId).list();
    }

    public List<Post> findByCommunityPaged(UUID communityId, int page, int size) {
        return find("community.id", Sort.descending("createdAt"), communityId)
                .page(page, size).list();
    }

    public List<Post> findByAuthor(UUID authorId) {
        return find("FROM Post p LEFT JOIN FETCH p.community LEFT JOIN FETCH p.author " +
            "WHERE p.author.id = ?1 ORDER BY p.createdAt DESC", authorId).list();
    }

    public List<Post> findByAuthorPaged(UUID authorId, int page, int size) {
        return find("author.id", Sort.descending("createdAt"), authorId)
                .page(page, size).list();
    }

    public List<Post> findByCommunities(List<UUID> communityIds) {
        if (communityIds.isEmpty()) return List.of();
        return find("community.id in ?1 order by createdAt desc", communityIds).list();
    }

    public List<Post> findByCommunitiesPaged(List<UUID> communityIds, int page, int size) {
        if (communityIds.isEmpty()) return List.of();
        return find("community.id in ?1 order by createdAt desc", communityIds)
                .page(page, size).list();
    }

    public List<Post> findLikedByUserPaged(UUID userId, int page, int size) {
        return getEntityManager().createQuery(
            "SELECT p FROM Post p LEFT JOIN FETCH p.community LEFT JOIN FETCH p.author " +
            "JOIN PostReaction r ON r.post.id = p.id " +
            "WHERE r.user.id = :uid AND r.reactionType = 'like' " +
            "ORDER BY r.createdAt DESC", Post.class
        ).setParameter("uid", userId)
        .setFirstResult(page * size)
        .setMaxResults(size)
        .getResultList();
    }
  
    public List<Post> findByCommunitiesRecentLimited(List<UUID> communityIds, int limit) {
        if (communityIds.isEmpty()) return List.of();
        return find("community.id in ?1 order by createdAt desc", communityIds)
                .page(0, limit).list();
    }

    public long countByAuthor(UUID authorId) {
        return count("author.id", authorId);
    }

    public long countByCommunity(UUID communityId) {
        return count("community.id", communityId);
    }

    public long countByAuthorAndCommunity(UUID authorId, UUID communityId) {
        return count("author.id = ?1 and community.id = ?2", authorId, communityId);
    }

    /** Posts authored by the given users, excluding posts from the given community IDs. */
    public List<Post> findByAuthorsInNonJoinedCommunities(
            Set<UUID> authorIds, Set<UUID> excludedCommunityIds, int limit) {
        if (authorIds.isEmpty()) return List.of();
        String jpql = excludedCommunityIds.isEmpty()
                ? "FROM Post p WHERE p.author.id IN :aids ORDER BY p.createdAt DESC"
                : "FROM Post p WHERE p.author.id IN :aids AND p.community.id NOT IN :eids ORDER BY p.createdAt DESC";
        var q = getEntityManager().createQuery(jpql, Post.class)
                .setParameter("aids", authorIds);
        if (!excludedCommunityIds.isEmpty()) q.setParameter("eids", excludedCommunityIds);
        return q.setMaxResults(limit).getResultList();
    }

    /**
     * Posts liked by the given friends, excluding posts from the given community IDs.
     * Returns Object[]{Post, User likerFriend} pairs ordered by reaction time DESC.
     */
    public List<Object[]> findLikedByFriendsInNonJoinedCommunities(
            Set<UUID> friendIds, Set<UUID> excludedCommunityIds, int limit) {
        if (friendIds.isEmpty()) return List.of();
        String jpql = "SELECT p, r.user FROM Post p " +
                "JOIN PostReaction r ON r.post.id = p.id " +
                "WHERE r.user.id IN :fids AND r.reactionType = 'like' " +
                (excludedCommunityIds.isEmpty() ? "" : "AND p.community.id NOT IN :eids ") +
                "ORDER BY r.createdAt DESC";
        var q = getEntityManager().createQuery(jpql, Object[].class)
                .setParameter("fids", friendIds);
        if (!excludedCommunityIds.isEmpty()) q.setParameter("eids", excludedCommunityIds);
        return q.setMaxResults(limit).getResultList();
    }

    /** Top posts by likeCount from the given community IDs. */
    public List<Post> findPopularInCommunities(List<UUID> communityIds, int limit) {
        if (communityIds.isEmpty()) return List.of();
        return find("community.id IN ?1 ORDER BY likeCount DESC", communityIds)
                .page(0, limit).list();
    }
}

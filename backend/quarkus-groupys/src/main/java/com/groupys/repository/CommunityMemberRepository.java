package com.groupys.repository;

import com.groupys.model.CommunityMember;
import com.groupys.model.User;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class CommunityMemberRepository implements PanacheRepositoryBase<CommunityMember, UUID> {

    public Optional<CommunityMember> findByUserAndCommunity(UUID userId, UUID communityId) {
        return find("user.id = ?1 and community.id = ?2", userId, communityId).firstResultOptional();
    }

    public List<CommunityMember> findByCommunity(UUID communityId) {
        return find("FROM CommunityMember cm LEFT JOIN FETCH cm.user LEFT JOIN FETCH cm.community " +
            "WHERE cm.community.id = ?1", communityId).list();
    }

    public List<CommunityMember> findByUser(UUID userId) {
        return find("FROM CommunityMember cm LEFT JOIN FETCH cm.user LEFT JOIN FETCH cm.community " +
            "WHERE cm.user.id = ?1", userId).list();
    }

    public List<CommunityMember> findByUserLimited(UUID userId, int limit) {
        return find("user.id = ?1 order by joinedAt desc", userId)
                .page(0, limit)
                .list();
    }

    public long countSharedMembers(UUID candidateCommunityId, List<UUID> joinedCommunityIds) {
        if (joinedCommunityIds == null || joinedCommunityIds.isEmpty()) {
            return 0L;
        }
        return getEntityManager().createQuery("""
                select count(distinct candidate.user.id)
                from CommunityMember candidate
                where candidate.community.id = :candidateCommunityId
                  and exists (
                    select 1
                    from CommunityMember joined
                    where joined.user.id = candidate.user.id
                      and joined.community.id in :joinedCommunityIds
                  )
                """, Long.class)
                .setParameter("candidateCommunityId", candidateCommunityId)
                .setParameter("joinedCommunityIds", joinedCommunityIds)
                .getSingleResult();
    }

    public List<User> findFriendsInCommunity(UUID communityId, Set<UUID> friendIds, int limit) {
        if (friendIds == null || friendIds.isEmpty()) return List.of();
        return getEntityManager().createQuery("""
                select cm.user
                from CommunityMember cm
                where cm.community.id = :communityId
                  and cm.user.id in :friendIds
                order by cm.joinedAt desc
                """, User.class)
                .setParameter("communityId", communityId)
                .setParameter("friendIds", new ArrayList<>(friendIds))
                .setMaxResults(limit)
                .getResultList();
    }

    public List<UUID> findTrendingCommunityIds(Instant since, int limit) {
        return getEntityManager().createQuery("""
                select cm.community.id
                from CommunityMember cm
                where cm.joinedAt >= :since
                group by cm.community.id
                order by count(cm) desc
                """, UUID.class)
                .setParameter("since", since)
                .setMaxResults(limit)
                .getResultList();
    }

    /** Count of members the user has in common with each community — single batch query. */
    public Map<UUID, Long> batchCountSharedMembers(List<UUID> communityIds, List<UUID> joinedCommunityIds) {
        if (communityIds.isEmpty() || joinedCommunityIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery("""
                select cm.community.id, count(distinct cm.user.id)
                from CommunityMember cm
                where cm.community.id in :communityIds
                  and exists (
                    select 1 from CommunityMember joined
                    where joined.user.id = cm.user.id
                      and joined.community.id in :joinedCommunityIds
                  )
                group by cm.community.id
                """, Object[].class)
                .setParameter("communityIds", communityIds)
                .setParameter("joinedCommunityIds", joinedCommunityIds)
                .getResultList();
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : rows) result.put((UUID) row[0], (Long) row[1]);
        return result;
    }

    /** Number of communities a single user belongs to. */
    public long countByUser(UUID userId) {
        return count("user.id", userId);
    }

    /** Number of communities each user belongs to — single batch query. */
    public Map<UUID, Long> batchCountByUsers(List<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery(
                "select m.user.id, count(m) from CommunityMember m where m.user.id in :ids group by m.user.id",
                Object[].class)
                .setParameter("ids", userIds)
                .getResultList();
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : rows) result.put((UUID) row[0], (Long) row[1]);
        return result;
    }

    /** Shared community count between the base user and each candidate — single batch query. */
    public Map<UUID, Long> batchCountSharedCommunities(UUID userId, List<UUID> candidateUserIds) {
        if (candidateUserIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery("""
                select theirs.user.id, count(distinct mine.community.id)
                from CommunityMember mine
                join CommunityMember theirs on theirs.community.id = mine.community.id
                where mine.user.id = :userId and theirs.user.id in :candidateIds
                group by theirs.user.id
                """, Object[].class)
                .setParameter("userId", userId)
                .setParameter("candidateIds", candidateUserIds)
                .getResultList();
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : rows) result.put((UUID) row[0], (Long) row[1]);
        return result;
    }

    public long countSharedCommunities(UUID userId, UUID candidateUserId) {
        return getEntityManager().createQuery("""
            select count(distinct mine.community.id)
            from CommunityMember mine
            where mine.user.id = :userId
            and exists (
                select 1
                from CommunityMember theirs
                where theirs.user.id = :candidateUserId
                and theirs.community.id = mine.community.id
            )
        """, Long.class)
        .setParameter("userId", userId)
        .setParameter("candidateUserId", candidateUserId)
        .getSingleResult();
    }

    /**
     * Checks if a user is a member of a community with OWNER or MODERATOR role.
     */
    public boolean isOwnerOrModerator(UUID userId, UUID communityId) {
        return find("user.id = ?1 and community.id = ?2 and role in ('OWNER', 'MODERATOR')", userId, communityId)
            .firstResultOptional()
            .isPresent();
    }
}

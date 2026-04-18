package com.groupys.repository;

import com.groupys.model.Friendship;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class FriendshipRepository implements PanacheRepositoryBase<Friendship, UUID> {

    /** Any friendship row between two users regardless of direction. */
    public Optional<Friendship> findBetween(UUID userId1, UUID userId2) {
        return find(
            "(requester.id = ?1 AND recipient.id = ?2) OR (requester.id = ?2 AND recipient.id = ?1)",
            userId1, userId2
        ).firstResultOptional();
    }

    public List<Friendship> findAcceptedByUser(UUID userId) {
        return find("FROM Friendship f LEFT JOIN FETCH f.requester LEFT JOIN FETCH f.recipient " +
            "WHERE (f.requester.id = ?1 OR f.recipient.id = ?1) AND f.status = ?2",
            userId, Friendship.Status.ACCEPTED).list();
    }

    public List<Friendship> findPendingReceivedBy(UUID recipientId) {
        return list("recipient.id = ?1 AND status = ?2", recipientId, Friendship.Status.PENDING);
    }

    public List<Friendship> findPendingSentBy(UUID requesterId) {
        return list("requester.id = ?1 AND status = ?2", requesterId, Friendship.Status.PENDING);
    }

    public long countAcceptedFriends(UUID userId) {
        return count(
            "(requester.id = ?1 OR recipient.id = ?1) AND status = ?2",
            userId, Friendship.Status.ACCEPTED
        );
    }

    /** Returns the IDs of all accepted friends for a user (both directions). */
    public Set<UUID> findAcceptedFriendIds(UUID userId) {
        return findAcceptedByUser(userId).stream()
                .map(f -> f.requester.id.equals(userId) ? f.recipient.id : f.requester.id)
                .collect(Collectors.toSet());
    }

    /**
     * Loads the full friend sets for a list of candidate users in a single query.
     * Returns a map of candidateId → set of their accepted friend IDs.
     * Used to batch-compute friends-of-friends scores without N+1 queries.
     */
    public Map<UUID, Set<UUID>> batchFriendIdsByCandidates(List<UUID> candidateIds) {
        if (candidateIds.isEmpty()) return Map.of();
        List<Friendship> friendships = list(
            "(requester.id in ?1 or recipient.id in ?1) and status = ?2",
            candidateIds, Friendship.Status.ACCEPTED);
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (Friendship f : friendships) {
            result.computeIfAbsent(f.requester.id, k -> new HashSet<>()).add(f.recipient.id);
            result.computeIfAbsent(f.recipient.id, k -> new HashSet<>()).add(f.requester.id);
        }
        return result;
    }

    /**
     * Checks if two users are friends (accepted friendship status).
     */
    public boolean isFriend(UUID userId1, UUID userId2) {
        return findBetween(userId1, userId2)
            .map(f -> f.status == Friendship.Status.ACCEPTED)
            .orElse(false);
    }
}

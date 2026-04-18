package com.groupys.repository;

import com.groupys.model.Comment;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class CommentRepository implements PanacheRepositoryBase<Comment, UUID> {

    public List<Comment> findByPost(UUID postId) {
        return find("FROM Comment c LEFT JOIN FETCH c.author LEFT JOIN FETCH c.post " +
            "WHERE c.post.id = ?1 ORDER BY c.createdAt ASC", postId).list();
    }

    public long countByPost(UUID postId) {
        return count("post.id", postId);
    }

    /** Single query: returns comment count per post for all given post IDs. */
    public Map<UUID, Long> countsByPostIds(List<UUID> postIds) {
        if (postIds.isEmpty()) return Map.of();
        List<Object[]> rows = getEntityManager().createQuery(
                "SELECT c.post.id, COUNT(c) FROM Comment c WHERE c.post.id IN :ids GROUP BY c.post.id",
                Object[].class
        ).setParameter("ids", postIds).getResultList();
        Map<UUID, Long> map = new HashMap<>();
        for (Object[] row : rows) map.put((UUID) row[0], (Long) row[1]);
        return map;
    }

    /** Returns only IDs of all comments for a post — used for batch deletes. */
    public List<UUID> findIdsByPost(UUID postId) {
        return getEntityManager().createQuery(
                "SELECT c.id FROM Comment c WHERE c.post.id = :postId", UUID.class
        ).setParameter("postId", postId).getResultList();
    }

    public List<Comment> findByParent(UUID parentCommentId) {
        return find("parentComment.id", parentCommentId).list();
    }

    /** Batch-deletes comments by ID list. */
    public void deleteByIds(List<UUID> ids) {
        if (ids.isEmpty()) return;
        getEntityManager()
                .createQuery("DELETE FROM Comment c WHERE c.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
    }

    public long countByAuthor(UUID authorId) {
        return count("author.id", authorId);
    }

    public long countByCommunity(UUID communityId) {
        return count("post.community.id", communityId);
    }
}

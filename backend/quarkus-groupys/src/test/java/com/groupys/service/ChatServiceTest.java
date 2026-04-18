package com.groupys.service;

import com.groupys.dto.ConversationResDto;
import com.groupys.dto.MessageResDto;
import com.groupys.model.Conversation;
import com.groupys.model.ConversationParticipant;
import com.groupys.model.Message;
import com.groupys.model.User;
import com.groupys.model.UserMatch;
import com.groupys.repository.ConversationRepository;
import com.groupys.repository.MessageRepository;
import com.groupys.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ChatServiceTest {

    @Test
    void getOrCreateDirectConversationReusesExistingConversation() {
        User me = user("me", "clerk-me", "alex");
        User other = user("other", "clerk-other", "luna");
        Conversation existing = conversation(me, other);

        StubConversationRepository conversationRepository = new StubConversationRepository(existing);

        ChatService service = new ChatService();
        service.userRepository = new StubUserRepository(Map.of(
                me.clerkId, me,
                other.clerkId, other
        ), Map.of(
                me.id, me,
                other.id, other
        ));
        service.conversationRepository = conversationRepository;
        service.messageRepository = new StubMessageRepository();

        ConversationResDto result = service.getOrCreateDirectConversation(me.clerkId, other.id);

        assertEquals(existing.id, result.id());
        assertEquals(List.of("alex", "luna"), result.participants().stream().map(p -> p.username()).sorted().toList());
        assertFalse(conversationRepository.persistCalled);
    }

    @Test
    void sendMessageAllowsConversationAfterMatchBecomesInactive() {
        User me = user("me", "clerk-me", "alex");
        User other = user("other", "clerk-other", "luna");
        Conversation existing = conversation(me, other);
        existing.match = inactiveMatch(existing, me, other);

        StubConversationRepository conversationRepository = new StubConversationRepository(existing);
        StubMessageRepository messageRepository = new StubMessageRepository();

        ChatService service = new ChatService();
        service.userRepository = new StubUserRepository(Map.of(
            me.clerkId, me,
            other.clerkId, other
        ), Map.of(
            me.id, me,
            other.id, other
        ));
        service.conversationRepository = conversationRepository;
        service.messageRepository = messageRepository;
        service.rateLimitingService = new RateLimitingService();

        MessageResDto result = service.sendMessage(existing.id, me.clerkId, "still here");

        assertEquals("still here", result.content());
        assertEquals(existing.id, result.conversationId());
        assertNotNull(messageRepository.persistedMessage);
    }

    private static User user(String seed, String clerkId, String username) {
        User user = new User();
        user.id = UUID.nameUUIDFromBytes(seed.getBytes());
        user.clerkId = clerkId;
        user.username = username;
        user.displayName = username;
        return user;
    }

    private static Conversation conversation(User me, User other) {
        Conversation conversation = new Conversation();
        conversation.id = UUID.nameUUIDFromBytes("conversation".getBytes());
        conversation.createdAt = Instant.parse("2025-01-01T00:00:00Z");
        conversation.updatedAt = Instant.parse("2025-01-01T00:00:00Z");
        conversation.isGroup = false;

        ConversationParticipant myParticipant = new ConversationParticipant();
        myParticipant.conversation = conversation;
        myParticipant.user = me;
        myParticipant.lastReadAt = Instant.parse("2025-01-01T00:00:00Z");

        ConversationParticipant otherParticipant = new ConversationParticipant();
        otherParticipant.conversation = conversation;
        otherParticipant.user = other;
        otherParticipant.lastReadAt = Instant.parse("2025-01-01T00:00:00Z");

        conversation.participants = List.of(myParticipant, otherParticipant);
        return conversation;
    }

    private static UserMatch inactiveMatch(Conversation conversation, User me, User other) {
        UserMatch match = new UserMatch();
        match.id = UUID.nameUUIDFromBytes("match".getBytes());
        match.userA = me;
        match.userB = other;
        match.conversation = conversation;
        match.status = "UNMATCHED";
        match.createdAt = Instant.parse("2025-01-01T00:00:00Z");
        match.updatedAt = Instant.parse("2025-01-02T00:00:00Z");
        return match;
    }

    private static final class StubConversationRepository extends ConversationRepository {
        private final Conversation existingConversation;
        private boolean persistCalled;

        private StubConversationRepository(Conversation existingConversation) {
            this.existingConversation = existingConversation;
        }

        @Override
        public Optional<Conversation> findDirectConversation(UUID userAId, UUID userBId) {
            return Optional.of(existingConversation);
        }

        @Override
        public Optional<ConversationParticipant> findParticipant(UUID conversationId, UUID userId) {
            return existingConversation.participants.stream()
                    .filter(cp -> cp.conversation.id.equals(conversationId) && cp.user.id.equals(userId))
                    .findFirst();
        }

        @Override
        public Optional<Conversation> findByIdOptional(UUID id) {
            return existingConversation.id.equals(id) ? Optional.of(existingConversation) : Optional.empty();
        }

        @Override
        public void persist(Conversation entity) {
            persistCalled = true;
        }
    }

    private static final class StubMessageRepository extends MessageRepository {
        private Message persistedMessage;

        @Override
        public com.groupys.model.Message findLatestInConversation(UUID conversationId) {
            return null;
        }

        @Override
        public long countUnread(UUID conversationId, UUID userId, Instant lastReadAt) {
            return 0;
        }

        @Override
        public void persist(Message entity) {
            persistedMessage = entity;
            if (entity.createdAt == null) {
                entity.createdAt = Instant.parse("2025-01-03T00:00:00Z");
            }
            if (entity.id == null) {
                entity.id = UUID.nameUUIDFromBytes((entity.content + entity.createdAt).getBytes());
            }
        }
    }

    private static final class StubUserRepository extends UserRepository {
        private final Map<String, User> byClerkId;
        private final Map<UUID, User> byId;

        private StubUserRepository(Map<String, User> byClerkId, Map<UUID, User> byId) {
            this.byClerkId = byClerkId;
            this.byId = byId;
        }

        @Override
        public Optional<User> findByClerkId(String clerkId) {
            return Optional.ofNullable(byClerkId.get(clerkId));
        }

        @Override
        public Optional<User> findByIdOptional(UUID id) {
            return Optional.ofNullable(byId.get(id));
        }
    }
}

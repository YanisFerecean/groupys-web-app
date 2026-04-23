package com.groupys.resource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupys.dto.ConversationResDto;
import com.groupys.dto.MessageResDto;
import com.groupys.service.ChatService;
import com.groupys.service.PresenceService;
import com.groupys.service.UserService;
import com.groupys.websocket.WebSocketMessage;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/chat")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class ConversationResource {

    @Inject
    ChatService chatService;

    @Inject
    PresenceService presenceService;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    JsonWebToken jwt;

    @Inject
    UserService userService;

    // ── Conversations ─────────────────────────────────────────────────────────

    @GET
    @Path("/conversations")
    public List<ConversationResDto> listConversations(
            @QueryParam("cursor") String cursorParam,
            @QueryParam("size") @DefaultValue("20") int size) {
        Instant cursor = cursorParam != null ? Instant.parse(cursorParam) : null;
        return chatService.getConversationsPaged(jwt.getSubject(), Math.min(size, 50), cursor);
    }

    @GET
    @Path("/conversations/{id}")
    public ConversationResDto getConversation(@PathParam("id") UUID id) {
        return chatService.getConversation(id, jwt.getSubject());
    }

    /** body: { "targetUserId": "uuid" } */
    @POST
    @Path("/conversations")
    public Response startConversation(StartConversationRequest req) {
        ConversationResDto dto = chatService.getOrCreateDirectConversation(jwt.getSubject(), req.targetUserId());
        return Response.ok(dto).build();
    }

    @POST
    @Path("/conversations/{id}/accept")
    public ConversationResDto acceptConversationRequest(@PathParam("id") UUID id) {
        return chatService.acceptConversationRequest(id, jwt.getSubject());
    }

    @DELETE
    @Path("/conversations/{id}/request")
    public Response denyConversationRequest(@PathParam("id") UUID id) {
        chatService.denyConversationRequest(id, jwt.getSubject());
        return Response.noContent().build();
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    @GET
    @Path("/conversations/{id}/messages")
    public List<MessageResDto> getMessages(
            @PathParam("id") UUID id,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("30") int size) {
        return chatService.getMessages(id, jwt.getSubject(), page, Math.min(size, 50));
    }

    @POST
    @Path("/conversations/{id}/messages")
    public Response sendMessage(@PathParam("id") UUID id, SendMessageRequest req) {
        MessageResDto msg = chatService.sendMessage(id, jwt.getSubject(), req.content());
        pushMessageNew(msg, jwt.getSubject());
        return Response.status(Response.Status.CREATED).entity(msg).build();
    }

    private void pushMessageNew(MessageResDto msg, String senderClerkId) {
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id", msg.id().toString());
            data.put("conversationId", msg.conversationId().toString());
            data.put("senderId", msg.senderId().toString());
            data.put("senderUsername", msg.senderUsername());
            data.put("senderDisplayName", msg.senderDisplayName());
            data.put("senderProfileImage", msg.senderProfileImage());
            data.put("content", msg.content());
            data.put("messageType", msg.messageType());
            data.put("createdAt", msg.createdAt().toString());
            String json = objectMapper.writeValueAsString(new WebSocketMessage("MESSAGE_NEW", data));
            chatService.getParticipantClerkIds(msg.conversationId()).forEach((pid, clerkId) -> {
                if (!clerkId.equals(senderClerkId)) {
                    presenceService.sendTo(clerkId, json);
                }
            });
        } catch (Exception e) {
            // WS push is best-effort — message is already saved
        }
    }

    @DELETE
    @Path("/messages/{messageId}")
    public Response deleteMessage(@PathParam("messageId") UUID messageId) {
        chatService.deleteMessage(messageId, jwt.getSubject());
        return Response.noContent().build();
    }

    @PUT
    @Path("/conversations/{id}/read")
    public Response markRead(@PathParam("id") UUID id) {
        chatService.markRead(id, jwt.getSubject());
        return Response.noContent().build();
    }

    // ── E2E public keys ───────────────────────────────────────────────────────

    @GET
    @Path("/keys/{username}")
    public Response getPublicKey(@PathParam("username") String username) {
        String key = userService.getPublicKeyByUsername(username);
        return Response.ok(Map.of("publicKey", key)).build();
    }

    @PUT
    @Path("/keys/me")
    public Response savePublicKey(PublicKeyRequest req) {
        userService.savePublicKey(jwt.getSubject(), req.publicKey());
        return Response.noContent().build();
    }

    // ── Request records ───────────────────────────────────────────────────────

    public record StartConversationRequest(UUID targetUserId) {}
    public record SendMessageRequest(String content) {}
    public record PublicKeyRequest(String publicKey) {}
}

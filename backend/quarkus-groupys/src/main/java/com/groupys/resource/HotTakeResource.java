package com.groupys.resource;

import com.groupys.dto.HotTakeAnswerCreateDto;
import com.groupys.dto.HotTakeAnswerResDto;
import com.groupys.dto.HotTakeCreateDto;
import com.groupys.dto.HotTakeResDto;
import com.groupys.service.HotTakeService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Path("/hot-takes")
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
public class HotTakeResource {

    @Inject
    HotTakeService hotTakeService;

    @Inject
    JsonWebToken jwt;

    @ConfigProperty(name = "groupys.admin.secret", defaultValue = "")
    String adminSecret;

    // ── Public: get current hot take ─────────────────────────────────────────

    @GET
    @Path("/current")
    @PermitAll
    public Response getCurrent() {
        HotTakeResDto current = hotTakeService.getCurrent();
        if (current == null) {
            return Response.noContent().build();
        }
        return Response.ok(current).build();
    }

    // ── Public: get a specific user's answer for the current hot take ─────────

    @GET
    @Path("/current/user/{username}")
    @PermitAll
    public Response getUserAnswer(@PathParam("username") String username) {
        HotTakeAnswerResDto answer = hotTakeService.getUserAnswer(username);
        if (answer == null) {
            return Response.noContent().build();
        }
        return Response.ok(answer).build();
    }

    // ── Authenticated: get my answer for the current hot take ─────────────────

    @GET
    @Path("/current/my-answer")
    @Authenticated
    @SecurityRequirement(name = "bearerAuth")
    public Response getMyAnswer() {
        HotTakeAnswerResDto answer = hotTakeService.getMyAnswer(jwt.getSubject());
        if (answer == null) {
            return Response.noContent().build();
        }
        return Response.ok(answer).build();
    }

    // ── Authenticated: get friends' answers (only if caller has answered) ─────

    @GET
    @Path("/current/friends-answers")
    @Authenticated
    @SecurityRequirement(name = "bearerAuth")
    public Response getFriendsAnswers() {
        return Response.ok(hotTakeService.getFriendsAnswers(jwt.getSubject())).build();
    }

    // ── Authenticated: submit or update answer ────────────────────────────────

    @POST
    @Path("/answer")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    @SecurityRequirement(name = "bearerAuth")
    public Response submitAnswer(HotTakeAnswerCreateDto dto) {
        return Response.ok(hotTakeService.submitAnswer(dto, jwt.getSubject())).build();
    }

    // ── Admin: push a new hot take question ───────────────────────────────────

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(
            @HeaderParam("X-Admin-Secret") String secret,
            HotTakeCreateDto dto
    ) {
        if (adminSecret.isBlank() || !constantTimeEquals(adminSecret, secret)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        if (dto == null || dto.question() == null || dto.question().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("question is required")
                    .build();
        }
        int answerCount = dto.answerCount() != null ? dto.answerCount() : 1;
        return Response.ok(hotTakeService.create(dto.question(), dto.weekLabel(), dto.answerType(), answerCount)).build();
    }

    /**
     * Constant-time comparison to prevent timing attacks.
     */
    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(a.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                                     b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}

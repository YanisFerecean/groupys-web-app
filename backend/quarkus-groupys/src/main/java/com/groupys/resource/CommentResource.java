package com.groupys.resource;

import com.groupys.dto.CommentCreateDto;
import com.groupys.dto.CommentResDto;
import com.groupys.service.CommentService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;
import java.util.UUID;

@Path("/comments")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class CommentResource {

    @Inject
    CommentService commentService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/post/{postId}")
    public List<CommentResDto> getByPost(@PathParam("postId") UUID postId) {
        return commentService.getByPost(postId, jwt.getSubject());
    }

    @POST
    @Path("/post/{postId}")
    public Response create(@PathParam("postId") UUID postId, @Valid CommentCreateDto dto) {
        CommentResDto created = commentService.create(postId, dto.content(), dto.parentCommentId(), jwt.getSubject());
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @POST
    @Path("/{commentId}/react")
    public CommentResDto react(@PathParam("commentId") UUID commentId, ReactionRequest request) {
        return commentService.react(commentId, request.type(), jwt.getSubject());
    }

    @DELETE
    @Path("/{commentId}")
    public Response delete(@PathParam("commentId") UUID commentId) {
        commentService.delete(commentId, jwt.getSubject());
        return Response.noContent().build();
    }

    public record ReactionRequest(String type) {}
}

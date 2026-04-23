package com.groupys.resource;

import com.groupys.dto.FriendResDto;
import com.groupys.dto.FriendStatusDto;
import com.groupys.service.FriendshipService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;
import java.util.UUID;

@Path("/friends")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class FriendshipResource {

    @Inject
    FriendshipService friendshipService;

    @Inject
    JsonWebToken jwt;

    /** Send a friend request to another user. */
    @POST
    @Path("/request/{targetUserId}")
    public Response sendRequest(@PathParam("targetUserId") UUID targetUserId) {
        FriendResDto dto = friendshipService.sendRequest(jwt.getSubject(), targetUserId);
        return Response.status(Response.Status.CREATED).entity(dto).build();
    }

    /** Accept a received pending request. */
    @POST
    @Path("/accept/{friendshipId}")
    public FriendResDto acceptRequest(@PathParam("friendshipId") UUID friendshipId) {
        return friendshipService.acceptRequest(jwt.getSubject(), friendshipId);
    }

    /** Decline a received request, or cancel a sent request. */
    @DELETE
    @Path("/request/{friendshipId}")
    public Response declineOrCancel(@PathParam("friendshipId") UUID friendshipId) {
        friendshipService.declineOrCancel(jwt.getSubject(), friendshipId);
        return Response.noContent().build();
    }

    /** Remove an existing friend. */
    @DELETE
    @Path("/{otherUserId}")
    public Response removeFriend(@PathParam("otherUserId") UUID otherUserId) {
        friendshipService.removeFriend(jwt.getSubject(), otherUserId);
        return Response.noContent().build();
    }

    /** List accepted friends. */
    @GET
    public List<FriendResDto> getFriends() {
        return friendshipService.getFriends(jwt.getSubject());
    }

    /** Incoming pending requests. */
    @GET
    @Path("/requests/received")
    public List<FriendResDto> getReceived() {
        return friendshipService.getPendingReceived(jwt.getSubject());
    }

    /** Outgoing pending requests. */
    @GET
    @Path("/requests/sent")
    public List<FriendResDto> getSent() {
        return friendshipService.getPendingSent(jwt.getSubject());
    }

    /** Check friendship status with a specific user. */
    @GET
    @Path("/status/{targetUserId}")
    public FriendStatusDto getStatus(@PathParam("targetUserId") UUID targetUserId) {
        return friendshipService.getStatus(jwt.getSubject(), targetUserId);
    }
}

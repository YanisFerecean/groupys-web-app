package com.groupys.resource;

import com.groupys.dto.DiscoveryActionDto;
import com.groupys.dto.DiscoverySyncResDto;
import com.groupys.dto.LikeResponseDto;
import com.groupys.dto.SuggestedCommunityResDto;
import com.groupys.dto.SuggestedUserResDto;
import com.groupys.service.DiscoveryService;
import com.groupys.service.MatchService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;
import java.util.UUID;

@Path("/discovery")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class DiscoveryResource {

    @Inject
    DiscoveryService discoveryService;

    @Inject
    MatchService matchService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/communities/suggested")
    @Operation(summary = "Get suggested communities", description = "Returns community recommendations for the authenticated user")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "List of suggested communities",
                     content = @Content(schema = @Schema(implementation = SuggestedCommunityResDto.class))),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public List<SuggestedCommunityResDto> suggestedCommunities(
            @DefaultValue("20") @QueryParam("limit") int limit,
            @DefaultValue("false") @QueryParam("refresh") boolean refresh) {
        return discoveryService.getSuggestedCommunities(jwt.getSubject(), limit, refresh);
    }

    @GET
    @Path("/users/suggested")
    @Operation(summary = "Get suggested users", description = "Returns user recommendations for the authenticated user based on taste similarity")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "List of suggested users",
                     content = @Content(schema = @Schema(implementation = SuggestedUserResDto.class))),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public List<SuggestedUserResDto> suggestedUsers(
            @DefaultValue("20") @QueryParam("limit") int limit,
            @DefaultValue("false") @QueryParam("refresh") boolean refresh) {
        return discoveryService.getSuggestedUsers(jwt.getSubject(), limit, refresh);
    }

    @POST
    @Path("/recommendations/{targetType}/{targetId}/dismiss")
    @Operation(summary = "Dismiss recommendation", description = "Dismiss a user or community recommendation")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "Recommendation dismissed"),
        @APIResponse(responseCode = "400", description = "Invalid request"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response dismiss(
            @PathParam("targetType") String targetType,
            @PathParam("targetId") UUID targetId,
            @RequestBody(description = "Dismissal action details", required = true,
                         content = @Content(schema = @Schema(implementation = DiscoveryActionDto.class)))
            @Valid DiscoveryActionDto dto) {
        discoveryService.dismissRecommendation(jwt.getSubject(), targetType, targetId, dto);
        return Response.noContent().build();
    }

    @POST
    @Path("/users/{id}/like")
    @Operation(summary = "Like a user", description = "Express interest in another user")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "Like recorded",
                     content = @Content(schema = @Schema(implementation = LikeResponseDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "409", description = "Already liked or matched"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public LikeResponseDto likeUser(
            @PathParam("id") UUID targetId) {
        return matchService.likeUser(jwt.getSubject(), targetId);
    }

    @DELETE
    @Path("/users/{id}/like")
    @Operation(summary = "Withdraw like", description = "Remove a previously expressed interest")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "Like withdrawn"),
        @APIResponse(responseCode = "404", description = "Like not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response withdrawLike(
            @PathParam("id") UUID targetId) {
        matchService.withdrawLike(jwt.getSubject(), targetId);
        return Response.noContent().build();
    }

    @POST
    @Path("/users/{id}/pass")
    @Operation(summary = "Pass on a user", description = "Indicate disinterest in another user")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "Pass recorded"),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response passUser(
            @PathParam("id") UUID targetId) {
        matchService.passUser(jwt.getSubject(), targetId);
        return Response.noContent().build();
    }

    @POST
    @Path("/music/sync")
    @Operation(summary = "Sync music taste", description = "Sync user's music taste from Apple Music")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "Music sync completed",
                     content = @Content(schema = @Schema(implementation = DiscoverySyncResDto.class))),
        @APIResponse(responseCode = "400", description = "Music sync failed"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public DiscoverySyncResDto syncMusic() {
        return discoveryService.syncMusic(jwt.getSubject());
    }

    @POST
    @Path("/onboarding/artists")
    @Operation(summary = "Save onboarding artists", description = "Save artist preferences selected during onboarding")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "Artists saved"),
        @APIResponse(responseCode = "400", description = "Invalid artist IDs"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response saveOnboardingArtists(
            @RequestBody(description = "List of artist IDs", required = true)
            List<Long> artistIds) {
        discoveryService.saveOnboardingArtistPreferences(jwt.getSubject(), artistIds);
        return Response.noContent().build();
    }
}

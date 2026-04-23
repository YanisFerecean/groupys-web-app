package com.groupys.resource;

import com.groupys.dto.MatchResDto;
import com.groupys.dto.SentLikeResDto;
import com.groupys.service.MatchService;
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

@Path("/matches")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class MatchResource {

    @Inject
    MatchService matchService;

    @Inject
    JsonWebToken jwt;

    @GET
    public List<MatchResDto> getMatches() {
        return matchService.getMatches(jwt.getSubject());
    }

    @GET
    @Path("/history")
    public List<MatchResDto> getMatchHistory(@DefaultValue("0") @QueryParam("page") int page,
                                             @DefaultValue("20") @QueryParam("size") int size) {
        return matchService.getMatchHistory(jwt.getSubject(), page, Math.min(size, 50));
    }

    @GET
    @Path("/sent-likes")
    public List<SentLikeResDto> getPendingSentLikes(@DefaultValue("0") @QueryParam("page") int page,
                                                    @DefaultValue("20") @QueryParam("size") int size) {
        return matchService.getPendingSentLikes(jwt.getSubject(), page, Math.min(size, 50));
    }

    @GET
    @Path("/{matchId}")
    public MatchResDto getMatch(@PathParam("matchId") UUID matchId) {
        return matchService.getMatch(jwt.getSubject(), matchId);
    }

    @DELETE
    @Path("/{matchId}")
    public Response unmatch(@PathParam("matchId") UUID matchId) {
        matchService.unmatch(jwt.getSubject(), matchId);
        return Response.noContent().build();
    }
}

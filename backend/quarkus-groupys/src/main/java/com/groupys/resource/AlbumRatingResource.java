package com.groupys.resource;

import com.groupys.dto.AlbumRatingCreateDto;
import com.groupys.dto.AlbumRatingResDto;
import com.groupys.service.AlbumRatingService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;
import java.util.UUID;

@Path("/album-ratings")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class AlbumRatingResource {

    @Inject
    AlbumRatingService albumRatingService;

    @Inject
    JsonWebToken jwt;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response upsert(@jakarta.validation.Valid AlbumRatingCreateDto dto) {
        AlbumRatingResDto result = albumRatingService.upsert(dto, jwt.getSubject());
        return Response.ok(result).build();
    }

    @GET
    @Path("/album/{albumId}")
    public List<AlbumRatingResDto> getByAlbum(@PathParam("albumId") Long albumId) {
        return albumRatingService.getByAlbumId(albumId);
    }

    @GET
    @Path("/mine")
    public List<AlbumRatingResDto> getMyRatings() {
        return albumRatingService.getMyRatings(jwt.getSubject());
    }

    @GET
    @Path("/user/{username}")
    @PermitAll
    public List<AlbumRatingResDto> getByUsername(@PathParam("username") String username) {
        return albumRatingService.getByUsername(username);
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") UUID id) {
        albumRatingService.delete(id, jwt.getSubject());
        return Response.noContent().build();
    }
}

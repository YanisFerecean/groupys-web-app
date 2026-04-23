package com.groupys.resource;

import com.groupys.dto.ArtistResDto;
import com.groupys.dto.TrackResDto;
import com.groupys.service.ArtistService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;

@Path("/artists")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class ArtistResource {

    @Inject
    ArtistService artistService;

    @GET
    @Path("/search")
    public List<ArtistResDto> search(@QueryParam("q") String query,
                                     @DefaultValue("5") @QueryParam("limit") int limit) {
        return artistService.search(query, limit);
    }

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        ArtistResDto artist = artistService.getById(id);
        if (artist == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(artist).build();
    }

    @GET
    @Path("/{id}/top-tracks")
    public List<TrackResDto> getTopTracks(@PathParam("id") Long id,
                                          @DefaultValue("5") @QueryParam("limit") int limit) {
        return artistService.getTopTracks(id, limit);
    }

    @GET
    @Path("/top")
    public List<ArtistResDto> getTopByCountry(@DefaultValue("United States") @QueryParam("country") String country) {
        return artistService.getTopByCountry(country);
    }

    @GET
    @Path("/genre/{genreName}")
    public List<ArtistResDto> getByGenre(@PathParam("genreName") String genreName,
                                         @DefaultValue("8") @QueryParam("limit") int limit) {
        return artistService.getByGenre(genreName, limit);
    }
}

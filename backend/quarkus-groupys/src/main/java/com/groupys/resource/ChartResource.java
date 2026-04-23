package com.groupys.resource;

import com.groupys.dto.ArtistResDto;
import com.groupys.dto.TopAlbumResDto;
import com.groupys.dto.TopTrackResDto;
import com.groupys.service.ChartService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;

@Path("/charts")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class ChartResource {

    @Inject
    ChartService chartService;

    @GET
    @Path("/tracks/global")
    public List<TopTrackResDto> getGlobalTopTracks() {
        return chartService.getGlobalTopTracks();
    }

    @GET
    @Path("/tracks/country")
    public List<TopTrackResDto> getTopTracksByCountry(
            @DefaultValue("United States") @QueryParam("country") String country) {
        return chartService.getTopTracksByCountry(country);
    }

    @GET
    @Path("/artists/global")
    public List<ArtistResDto> getGlobalTopArtists() {
        return chartService.getGlobalTopArtists();
    }

    @GET
    @Path("/artists/country")
    public List<ArtistResDto> getTopArtistsByCountry(
            @DefaultValue("United States") @QueryParam("country") String country) {
        return chartService.getTopArtistsByCountry(country);
    }

    @GET
    @Path("/albums/global")
    public List<TopAlbumResDto> getGlobalTopAlbums() {
        return chartService.getGlobalTopAlbums();
    }

    @GET
    @Path("/albums")
    public List<TopAlbumResDto> getTopAlbumsByTag(
            @DefaultValue("pop") @QueryParam("tag") String tag) {
        return chartService.getTopAlbumsByTag(tag);
    }
}

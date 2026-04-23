package com.groupys.resource;

import com.groupys.dto.DiscoverySyncResDto;
import com.groupys.dto.LastFmConnectReqDto;
import com.groupys.dto.MusicAlbumResDto;
import com.groupys.dto.MusicArtistResDto;
import com.groupys.dto.MusicConnectReqDto;
import com.groupys.dto.MusicDeveloperTokenResDto;
import com.groupys.dto.MusicTrackResDto;
import com.groupys.service.DiscoveryService;
import com.groupys.service.MusicService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
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

@Path("/music")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
@RequestScoped
@SecurityRequirement(name = "bearerAuth")
public class MusicResource {

    @Inject
    MusicService musicService;

    @Inject
    DiscoveryService discoveryService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/developer-token")
    public MusicDeveloperTokenResDto developerToken() {
        return musicService.getDeveloperToken();
    }

    @POST
    @Path("/connect")
    public DiscoverySyncResDto connect(@Valid MusicConnectReqDto dto) {
        musicService.connect(jwt.getSubject(), dto.musicUserToken());
        return discoveryService.syncMusic(jwt.getSubject());
    }

    @DELETE
    @Path("/disconnect")
    public Response disconnect() {
        musicService.disconnect(jwt.getSubject());
        return Response.noContent().build();
    }

    @POST
    @Path("/lastfm/connect")
    public Response connectLastFm(@Valid LastFmConnectReqDto dto) {
        musicService.connectLastFm(jwt.getSubject(), dto.username());
        return Response.noContent().build();
    }

    @DELETE
    @Path("/lastfm/disconnect")
    public Response disconnectLastFm() {
        musicService.disconnectLastFm(jwt.getSubject());
        return Response.noContent().build();
    }

    @GET
    @Path("/top-artists")
    public List<MusicArtistResDto> topArtists() {
        return musicService.getTopArtists(jwt.getSubject());
    }

    @GET
    @Path("/users/{userId}/top-artists")
    public List<MusicArtistResDto> topArtistsByUser(@PathParam("userId") String userId) {
        return musicService.getTopArtistsByUserId(userId);
    }

    @GET
    @Path("/top-tracks")
    public List<MusicTrackResDto> topTracks() {
        return musicService.getTopTracks(jwt.getSubject());
    }

    @GET
    @Path("/users/{userId}/top-tracks")
    public List<MusicTrackResDto> topTracksByUser(@PathParam("userId") String userId) {
        return musicService.getTopTracksByUserId(userId);
    }

    @GET
    @Path("/top-albums")
    public List<MusicAlbumResDto> topAlbums() {
        return musicService.getTopAlbums(jwt.getSubject());
    }

    @GET
    @Path("/users/{userId}/top-albums")
    public List<MusicAlbumResDto> topAlbumsByUser(@PathParam("userId") String userId) {
        return musicService.getTopAlbumsByUserId(userId);
    }

    @GET
    @Path("/currently-playing")
    public Response currentlyPlaying() {
        MusicTrackResDto track = musicService.getCurrentlyPlaying(jwt.getSubject());
        if (track == null) {
            return Response.noContent().build();
        }
        return Response.ok(track).build();
    }

    @GET
    @Path("/users/{userId}/currently-playing")
    public Response currentlyPlayingByUser(@PathParam("userId") String userId) {
        MusicTrackResDto track = musicService.getCurrentlyPlayingByUserId(userId);
        if (track == null) {
            return Response.noContent().build();
        }
        return Response.ok(track).build();
    }
}

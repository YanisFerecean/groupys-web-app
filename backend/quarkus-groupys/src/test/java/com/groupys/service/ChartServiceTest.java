package com.groupys.service;

import com.groupys.client.LastFmClient;
import com.groupys.dto.ArtistResDto;
import com.groupys.dto.lastfm.LastFmArtistInfoResponse;
import com.groupys.dto.lastfm.LastFmChartArtistsResponse;
import com.groupys.dto.lastfm.LastFmChartTracksResponse;
import com.groupys.dto.lastfm.LastFmGeoTracksResponse;
import com.groupys.dto.lastfm.LastFmTagAlbumsResponse;
import com.groupys.dto.lastfm.LastFmTopArtistsResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChartServiceTest {

    @Test
    void getGlobalTopArtistsReturnsEmptyListWhenLastFmFails() {
        ChartService service = new ChartService();
        service.lastFmClient = new StubLastFmClient(
                new WebApplicationException(Response.status(Response.Status.BAD_GATEWAY).build()),
                null
        );
        service.artistService = new StubArtistService(Map.of());
        service.lastfmApiKey = "test-key";

        List<ArtistResDto> artists = service.getGlobalTopArtists();

        assertTrue(artists.isEmpty());
    }

    @Test
    void getGlobalTopArtistsReturnsResolvedArtists() {
        ChartService service = new ChartService();
        service.lastFmClient = new StubLastFmClient(
                null,
                new LastFmChartArtistsResponse(
                        new LastFmChartArtistsResponse.LastFmChartArtists(List.of(
                                new LastFmChartArtistsResponse.LastFmChartArtist("Artist One", "100", "50"),
                                new LastFmChartArtistsResponse.LastFmChartArtist("Artist Two", "90", "40")
                        ))
                )
        );
        service.artistService = new StubArtistService(Map.of(
                "Artist One", new ArtistResDto(1L, "Artist One", List.of(), 50L, 100L, null),
                "Artist Two", new ArtistResDto(2L, "Artist Two", List.of(), 40L, 90L, null)
        ));
        service.lastfmApiKey = "test-key";

        List<ArtistResDto> artists = service.getGlobalTopArtists();

        assertEquals(2, artists.size());
        assertEquals(List.of("Artist One", "Artist Two"), artists.stream().map(ArtistResDto::name).toList());
    }

    private static final class StubArtistService extends ArtistService {

        private final Map<String, ArtistResDto> artistsByName;

        private StubArtistService(Map<String, ArtistResDto> artistsByName) {
            this.artistsByName = artistsByName;
        }

        @Override
        public ArtistResDto resolveByName(String artistName) {
            return artistsByName.get(artistName);
        }
    }

    private static final class StubLastFmClient implements LastFmClient {

        private final RuntimeException chartArtistsException;
        private final LastFmChartArtistsResponse chartArtistsResponse;

        private StubLastFmClient(RuntimeException chartArtistsException,
                                 LastFmChartArtistsResponse chartArtistsResponse) {
            this.chartArtistsException = chartArtistsException;
            this.chartArtistsResponse = chartArtistsResponse;
        }

        @Override
        public LastFmArtistInfoResponse getArtistInfo(String method, String artist, String apiKey, String format) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public LastFmTopArtistsResponse getTopArtists(String method, String country, String apiKey, String format) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public LastFmChartTracksResponse getChartTopTracks(String method, String apiKey, String format) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public LastFmChartArtistsResponse getChartTopArtists(String method, String apiKey, String format) {
            if (chartArtistsException != null) {
                throw chartArtistsException;
            }
            return chartArtistsResponse;
        }

        @Override
        public LastFmGeoTracksResponse getGeoTopTracks(String method, String country, String apiKey, String format) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public LastFmTagAlbumsResponse getTagTopAlbums(String method, String tag, String apiKey, String format) {
            throw new UnsupportedOperationException("Not used in this test");
        }

    @Override
    public LastFmTopArtistsResponse getTagTopArtists(String method, String tag, int limit, String apiKey, String format) {
        throw new UnsupportedOperationException("Not used in this test");
    }

    @Override
    public com.groupys.dto.lastfm.LastFmUserInfoResponse getUserInfo(String method, String user, String apiKey, String format) {
        throw new UnsupportedOperationException("Not used in this test");
    }

    @Override
    public com.groupys.dto.lastfm.LastFmUserTopTracksResponse getUserTopTracks(String method, String user, String period, int limit, String apiKey, String format) {
        throw new UnsupportedOperationException("Not used in this test");
    }

    @Override
    public com.groupys.dto.lastfm.LastFmUserTopAlbumsResponse getUserTopAlbums(String method, String user, String period, int limit, String apiKey, String format) {
        throw new UnsupportedOperationException("Not used in this test");
    }

    @Override
    public com.groupys.dto.lastfm.LastFmUserTopArtistsResponse getUserTopArtists(String method, String user, String period, int limit, String apiKey, String format) {
        throw new UnsupportedOperationException("Not used in this test");
    }
}
}

package com.groupys.service;

import com.groupys.client.DeezerClient;
import com.groupys.client.LastFmClient;
import com.groupys.dto.ArtistResDto;
import com.groupys.dto.deezer.DeezerAlbumDto;
import com.groupys.dto.deezer.DeezerAlbumSearchResponse;
import com.groupys.dto.deezer.DeezerArtistDto;
import com.groupys.dto.deezer.DeezerArtistSearchResponse;
import com.groupys.dto.deezer.DeezerTrackSearchResponse;
import com.groupys.dto.lastfm.LastFmArtistInfoResponse;
import com.groupys.dto.lastfm.LastFmChartArtistsResponse;
import com.groupys.dto.lastfm.LastFmChartTracksResponse;
import com.groupys.dto.lastfm.LastFmGeoTracksResponse;
import com.groupys.dto.lastfm.LastFmTagAlbumsResponse;
import com.groupys.dto.lastfm.LastFmTopArtistsResponse;
import com.groupys.mapper.ArtistMapper;
import com.groupys.model.Artist;
import com.groupys.repository.ArtistRepository;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArtistServiceTest {

    @Test
    void getByIdKeepsExistingArtistWhenUpstreamPayloadIsMissingName() {
        Artist existing = artist(10583405L, "Existing Artist");

        ArtistService service = new ArtistService();
        service.deezerClient = new StubDeezerClient(new DeezerArtistDto(10583405L, null, null, null, null, null, null, null));
        service.lastFmClient = new StubLastFmClient();
        service.artistMapper = new ArtistMapper();
        service.artistRepository = new StubArtistRepository(existing);
        service.lastfmApiKey = "test-key";

        ArtistResDto artist = service.getById(10583405L);

        assertEquals("Existing Artist", artist.name());
        assertEquals("Existing Artist", existing.getName());
    }

    @Test
    void getByIdSkipsPersistWhenUpstreamPayloadIsMissingRequiredFields() {
        StubArtistRepository repository = new StubArtistRepository(null);

        ArtistService service = new ArtistService();
        service.deezerClient = new StubDeezerClient(new DeezerArtistDto(10583405L, null, null, null, null, null, null, null));
        service.lastFmClient = new StubLastFmClient();
        service.artistMapper = new ArtistMapper();
        service.artistRepository = repository;
        service.lastfmApiKey = "test-key";

        ArtistResDto artist = service.getById(10583405L);

        assertNull(artist);
        assertFalse(repository.wasPersistCalled());
        assertTrue(repository.isEmpty());
    }

    private static Artist artist(Long id, String name) {
        Artist artist = new Artist();
        artist.setId(id);
        artist.setName(name);
        artist.setImages(List.of());
        return artist;
    }

    private static final class StubArtistRepository extends ArtistRepository {

        private final Map<Long, Artist> artists = new HashMap<>();
        private boolean persistCalled;

        private StubArtistRepository(Artist initialArtist) {
            if (initialArtist != null) {
                artists.put(initialArtist.getId(), initialArtist);
            }
        }

        @Override
        public Artist findById(Long id) {
            return artists.get(id);
        }

        @Override
        public void persist(Artist entity) {
            persistCalled = true;
            artists.put(entity.getId(), entity);
        }

        private boolean wasPersistCalled() {
            return persistCalled;
        }

        private boolean isEmpty() {
            return artists.isEmpty();
        }
    }

    private static final class StubDeezerClient implements DeezerClient {

        private final DeezerArtistDto artist;

        private StubDeezerClient(DeezerArtistDto artist) {
            this.artist = artist;
        }

        @Override
        public DeezerArtistSearchResponse searchArtists(String query, int limit) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public DeezerAlbumSearchResponse searchAlbums(String query, int limit) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public DeezerTrackSearchResponse searchTracks(String query, int limit) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public DeezerArtistDto getArtistById(Long id) {
            return artist;
        }

        @Override
        public DeezerAlbumDto getAlbumById(Long id) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public DeezerTrackSearchResponse getArtistTopTracks(Long id, int limit) {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public com.groupys.dto.deezer.DeezerGenreListResponse getGenres() {
            throw new UnsupportedOperationException("Not used in this test");
        }

        @Override
        public DeezerArtistSearchResponse getArtistsByGenre(Long id) {
            throw new UnsupportedOperationException("Not used in this test");
        }
    }

    private static final class StubLastFmClient implements LastFmClient {

        @Override
        public LastFmArtistInfoResponse getArtistInfo(String method, String artist, String apiKey, String format) {
            return null;
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
            throw new UnsupportedOperationException("Not used in this test");
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

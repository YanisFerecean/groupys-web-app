package com.groupys.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupys.client.LastFmClient;
import com.groupys.config.PerformanceFeatureFlags;
import com.groupys.dto.lastfm.LastFmArtistInfoResponse;
import com.groupys.model.*;
import com.groupys.model.User;
import com.groupys.repository.*;
import com.groupys.util.DiscoveryScoreUtil;
import com.groupys.util.MusicIdentityUtil;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

@ApplicationScoped
public class MusicSyncService {

    private static final String SOURCE_APPLE_TOP_ARTISTS = "APPLE_TOP_ARTISTS";
    private static final String SOURCE_APPLE_TOP_TRACKS = "APPLE_TOP_TRACKS";

    private final ArtistRepository artistRepository;
    private final GenreRepository genreRepository;
    private final TrackRepository trackRepository;
    private final ArtistGenreRepository artistGenreRepository;
    private final MusicSourceSnapshotRepository musicSourceSnapshotRepository;
    private final UserArtistPreferenceRepository userArtistPreferenceRepository;
    private final UserGenrePreferenceRepository userGenrePreferenceRepository;
    private final UserTrackPreferenceRepository userTrackPreferenceRepository;
    private final LastFmClient lastFmClient;
    private final String lastfmApiKey;
    private final ExecutorService virtualThreadExecutor;
    private final StorageService storageService;
    private final PerformanceFeatureFlags flags;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final DateTimeFormatter YEAR_FORMAT = DateTimeFormatter.ofPattern("yyyy").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("MM").withZone(ZoneOffset.UTC);

    @Inject
    public MusicSyncService(
            ArtistRepository artistRepository,
            GenreRepository genreRepository,
            TrackRepository trackRepository,
            ArtistGenreRepository artistGenreRepository,
            MusicSourceSnapshotRepository musicSourceSnapshotRepository,
            UserArtistPreferenceRepository userArtistPreferenceRepository,
            UserGenrePreferenceRepository userGenrePreferenceRepository,
            UserTrackPreferenceRepository userTrackPreferenceRepository,
            @RestClient LastFmClient lastFmClient,
            @ConfigProperty(name = "lastfm.api.key") String lastfmApiKey,
            @Named("virtual-thread-executor") ExecutorService virtualThreadExecutor,
            StorageService storageService,
            PerformanceFeatureFlags flags) {
        this.artistRepository = artistRepository;
        this.genreRepository = genreRepository;
        this.trackRepository = trackRepository;
        this.artistGenreRepository = artistGenreRepository;
        this.musicSourceSnapshotRepository = musicSourceSnapshotRepository;
        this.userArtistPreferenceRepository = userArtistPreferenceRepository;
        this.userGenrePreferenceRepository = userGenrePreferenceRepository;
        this.userTrackPreferenceRepository = userTrackPreferenceRepository;
        this.lastFmClient = lastFmClient;
        this.lastfmApiKey = lastfmApiKey;
        this.virtualThreadExecutor = virtualThreadExecutor;
        this.storageService = storageService;
        this.flags = flags;
    }

    @Transactional
    public MusicSourceSnapshot persistSnapshot(User user, String source, String snapshotType, String payload, String status, String error) {
        MusicSourceSnapshot snapshot = new MusicSourceSnapshot();
        snapshot.user = user;
        snapshot.source = source;
        snapshot.snapshotType = snapshotType;
        byte[] bytes = payload == null ? new byte[0] : payload.getBytes(StandardCharsets.UTF_8);
        boolean blobStored = false;
        if (flags.snapshotBlobWriteEnabled()) {
            try {
                String objectKey = buildSnapshotObjectKey(user.id, source, snapshotType);
                storageService.putObject(
                        flags.snapshotBucket(),
                        objectKey,
                        "application/json",
                        new ByteArrayInputStream(bytes),
                        bytes.length
                );
                snapshot.objectKey = objectKey;
                snapshot.payloadSizeBytes = (long) bytes.length;
                snapshot.checksum = sha256Hex(bytes);
                blobStored = true;
            } catch (Exception e) {
                Log.warnf(e, "Failed to persist snapshot blob for user %s source=%s type=%s", user.id, source, snapshotType);
            }
        }
        if (flags.snapshotPayloadJsonWriteEnabled() || !blobStored) {
            snapshot.payloadJson = payload;
        }
        snapshot.processingStatus = status;
        snapshot.processingError = error;
        snapshot.expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        musicSourceSnapshotRepository.persist(snapshot);
        return snapshot;
    }

    public String resolveSnapshotPayloadForProcessing(MusicSourceSnapshot snapshot, String inMemoryFallback) {
        if (flags.snapshotBlobReadEnabled()) {
            String resolved = readSnapshotPayload(snapshot);
            if (resolved != null && !resolved.isBlank()) {
                return resolved;
            }
        }
        if (snapshot != null && snapshot.payloadJson != null && !snapshot.payloadJson.isBlank()) {
            return snapshot.payloadJson;
        }
        return inMemoryFallback;
    }

    String readSnapshotPayload(MusicSourceSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        if (snapshot.objectKey != null && !snapshot.objectKey.isBlank()) {
            try (InputStream stream = storageService.getObject(flags.snapshotBucket(), snapshot.objectKey)) {
                byte[] bytes = stream.readAllBytes();
                if (isSnapshotBlobValid(snapshot, bytes)) {
                    return new String(bytes, StandardCharsets.UTF_8);
                }
                Log.warnf("Snapshot blob integrity check failed for snapshot %s object=%s; falling back to payload_json",
                        snapshot.id, snapshot.objectKey);
            } catch (Exception e) {
                Log.warnf(e, "Failed to read snapshot blob for snapshot %s object=%s; falling back to payload_json",
                        snapshot.id, snapshot.objectKey);
            }
        }
        return snapshot.payloadJson;
    }

    boolean isSnapshotBlobValid(MusicSourceSnapshot snapshot, byte[] bytes) {
        if (snapshot.payloadSizeBytes != null && snapshot.payloadSizeBytes.longValue() != bytes.length) {
            return false;
        }
        if (snapshot.checksum != null && !snapshot.checksum.isBlank()) {
            return snapshot.checksum.equalsIgnoreCase(sha256Hex(bytes));
        }
        return true;
    }

    @Transactional
    public int persistAppleArtistPreferences(User user, List<MusicService.MusicArtistItem> topArtists, Map<Long, Double> genreWeights) {
        if (topArtists == null || topArtists.isEmpty()) {
            return 0;
        }
        int total = topArtists.size();
        for (int index = 0; index < topArtists.size(); index++) {
            MusicService.MusicArtistItem item = topArtists.get(index);
            Artist artist = resolveArtist(item);
            double normalized = DiscoveryScoreUtil.normalizedRankScore(index + 1, total);

            UserArtistPreference pref = new UserArtistPreference();
            pref.user = user;
            pref.artist = artist;
            pref.source = SOURCE_APPLE_TOP_ARTISTS;
            pref.sourceWindow = "LATEST";
            pref.rankPosition = index + 1;
            pref.rawScore = (double) (total - index);
            pref.normalizedScore = normalized;
            pref.confidence = 1d;
            userArtistPreferenceRepository.persist(pref);

            List<String> artistGenres = resolveArtistGenres(item);
            if (!artistGenres.isEmpty()) {
                int genreRank = 0;
                for (String genreName : artistGenres) {
                    Genre genre = resolveGenre(genreName);
                    if (genre != null) {
                        upsertArtistGenre(artist, genre, genreRank++ == 0, normalized);
                        genreWeights.merge(genre.id, normalized, Double::sum);
                    }
                }
            }
        }
        return topArtists.size();
    }

    @Transactional
    public void persistAppleTrackPreferences(User user, List<MusicService.MusicTrackItem> topTracks, Map<Long, Double> genreWeights) {
        if (topTracks == null || topTracks.isEmpty()) {
            return;
        }
        int total = topTracks.size();
        Set<Long> writtenArtistIds = new HashSet<>();
        for (int index = 0; index < topTracks.size(); index++) {
            MusicService.MusicTrackItem item = topTracks.get(index);
            Track track = resolveTrack(item);
            double normalized = DiscoveryScoreUtil.normalizedRankScore(index + 1, total);

            UserTrackPreference trackPreference = new UserTrackPreference();
            trackPreference.user = user;
            trackPreference.track = track;
            trackPreference.source = SOURCE_APPLE_TOP_TRACKS;
            trackPreference.sourceWindow = "LATEST";
            trackPreference.rankPosition = index + 1;
            trackPreference.rawScore = (double) (total - index);
            trackPreference.normalizedScore = normalized;
            userTrackPreferenceRepository.persist(trackPreference);

            if (item.artists() == null) {
                continue;
            }
            for (MusicService.MusicArtistRef artistRef : item.artists()) {
                Artist artist = resolveArtist(artistRef);
                if (writtenArtistIds.add(artist.getId())) {
                    UserArtistPreference pref = new UserArtistPreference();
                    pref.user = user;
                    pref.artist = artist;
                    pref.source = SOURCE_APPLE_TOP_TRACKS;
                    pref.sourceWindow = "LATEST";
                    pref.rankPosition = index + 1;
                    pref.rawScore = Math.max(1d, total - index - 0.5d);
                    pref.normalizedScore = normalized * 0.7d;
                    pref.confidence = 0.85d;
                    userArtistPreferenceRepository.persist(pref);
                }

                artistGenreRepository.findByArtist(artist.getId()).forEach(artistGenre ->
                        genreWeights.merge(artistGenre.genre.id, normalized * 0.7d, Double::sum));
            }
        }
    }

    @Transactional
    public int persistGenrePreferences(User user, Map<Long, Double> genreWeights) {
        int size = genreWeights.size();
        if (size == 0) {
            return 0;
        }
        genreWeights.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .forEach(entry -> {
                    Genre genre = genreRepository.findByIdOptional(entry.getKey()).orElse(null);
                    if (genre == null) {
                        return;
                    }
                    UserGenrePreference pref = new UserGenrePreference();
                    pref.user = user;
                    pref.genre = genre;
                    pref.source = "DERIVED";
                    pref.rawScore = entry.getValue();
                    pref.normalizedScore = DiscoveryScoreUtil.clamp01(entry.getValue() / Math.max(1d, size));
                    pref.confidence = 0.9d;
                    userGenrePreferenceRepository.persist(pref);
                });
        return size;
    }

    public List<String> fetchLastFmGenres(String artistName) {
        if (artistName == null || artistName.isBlank()) {
            return List.of();
        }
        try {
            CompletableFuture<LastFmArtistInfoResponse> future = CompletableFuture.supplyAsync(
                    () -> lastFmClient.getArtistInfo(
                            "artist.getinfo",
                            artistName,
                            lastfmApiKey,
                            "json"
                    ),
                    virtualThreadExecutor
            );
            LastFmArtistInfoResponse response = future.get();
            if (response == null || response.artist() == null || response.artist().tags() == null || response.artist().tags().tags() == null) {
                return List.of();
            }
            return response.artist().tags().tags().stream()
                    .map(LastFmArtistInfoResponse.LastFmTag::name)
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .limit(5)
                    .toList();
        } catch (Exception e) {
            Log.debugf("Failed to enrich artist genres from Last.fm for '%s': %s", artistName, e.getMessage());
            return List.of();
        }
    }

    List<String> resolveArtistGenres(MusicService.MusicArtistItem item) {
        if (item.genres() != null && !item.genres().isEmpty()) {
            return item.genres().stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isBlank()).toList();
        }
        return fetchLastFmGenres(item.name());
    }

    Artist resolveArtist(MusicService.MusicArtistItem item) {
        Artist artist = item.id() != null
                ? artistRepository.findByAppleMusicId(item.id()).orElse(null)
                : null;
        if (artist == null && item.name() != null) {
            artist = artistRepository.findByNameIgnoreCase(item.name()).orElse(null);
        }
        if (artist == null) {
            artist = new Artist();
            artist.setId(MusicIdentityUtil.syntheticArtistId(item.id(), item.name()));
            artist.setName(item.name());
            artistRepository.persist(artist);
        }
        artist.setAppleMusicId(firstNonBlank(item.id(), artist.getAppleMusicId()));
        if (item.imageUrl() != null && !item.imageUrl().isBlank()) {
            artist.setImages(List.of(item.imageUrl()));
        }
        artist.setPopularityScore(resolvePopularityScore(item.popularity(), artist.getPopularityScore()));
        return artist;
    }

    Artist resolveArtist(MusicService.MusicArtistRef item) {
        Artist artist = item.id() != null
                ? artistRepository.findByAppleMusicId(item.id()).orElse(null)
                : null;
        if (artist == null && item.name() != null) {
            artist = artistRepository.findByNameIgnoreCase(item.name()).orElse(null);
        }
        if (artist == null) {
            artist = new Artist();
            artist.setId(MusicIdentityUtil.syntheticArtistId(item.id(), item.name()));
            artist.setName(item.name());
            artistRepository.persist(artist);
        }
        artist.setAppleMusicId(firstNonBlank(item.id(), artist.getAppleMusicId()));
        return artist;
    }

    Track resolveTrack(MusicService.MusicTrackItem item) {
        Track track = item.id() != null
                ? trackRepository.findByAppleMusicId(item.id()).orElse(null)
                : null;
        String primaryArtist = item.artists() != null && !item.artists().isEmpty() ? item.artists().getFirst().name() : "unknown";
        if (track == null) {
            track = new Track();
            track.setId(MusicIdentityUtil.syntheticTrackId(item.id(), item.name(), primaryArtist));
            track.setTitle(item.name());
            trackRepository.persist(track);
        }
        track.setAppleMusicId(firstNonBlank(item.id(), track.getAppleMusicId()));
        track.setExternalIsrc(item.isrc() != null ? item.isrc() : track.getExternalIsrc());
        track.setPopularityScore(resolvePopularityScore(item.popularity(), track.getPopularityScore()));
        if (item.artists() != null && !item.artists().isEmpty()) {
            track.setArtist(resolveArtist(item.artists().getFirst()));
        }
        return track;
    }

    void upsertArtistGenre(Artist artist, Genre genre, boolean primary, double confidence) {
        ArtistGenre mapping = artistGenreRepository.findByArtistGenreSource(artist.getId(), genre.id, "APPLE_MUSIC")
                .orElseGet(ArtistGenre::new);
        mapping.artist = artist;
        mapping.genre = genre;
        mapping.source = "APPLE_MUSIC";
        mapping.confidence = confidence;
        mapping.primary = primary;
        if (mapping.id == null) {
            artistGenreRepository.persist(mapping);
        }
        if (primary) {
            artist.setPrimaryGenre(genre);
        }
        artist.setGenresEnriched(true);
    }

    Genre resolveGenre(String genreName) {
        if (genreName == null || genreName.isBlank()) {
            return null;
        }
        return genreRepository.findByNameIgnoreCase(genreName.trim())
                .orElseGet(() -> {
                    Genre genre = new Genre();
                    genre.name = genreName.trim();
                    genreRepository.persist(genre);
                    return genre;
                });
    }

    String buildSnapshotObjectKey(UUID userId, String source, String snapshotType) {
        Instant now = Instant.now();
        String year = YEAR_FORMAT.format(now);
        String month = MONTH_FORMAT.format(now);
        return "%s/%s/%s/%s/%s/%s.json".formatted(
                userId,
                sanitizeKeyPart(source),
                sanitizeKeyPart(snapshotType),
                year,
                month,
                UUID.randomUUID()
        );
    }

    String sanitizeKeyPart(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "-");
    }

    String sha256Hex(byte[] payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(payload);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format(Locale.ROOT, "%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to calculate snapshot checksum", e);
        }
    }

    static String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback.trim();
        }
        return null;
    }

    static Double resolvePopularityScore(Integer popularity, Double currentScore) {
        if (popularity == null) {
            return currentScore;
        }
        return popularity / 100d;
    }
}

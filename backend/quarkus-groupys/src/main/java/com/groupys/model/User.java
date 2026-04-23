package com.groupys.model;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@BatchSize(size = 50)
@Table(name = "users", indexes = {
    @Index(name = "idx_users_clerk_id", columnList = "clerk_id"),
    @Index(name = "idx_users_country_code", columnList = "country_code"),
    @Index(name = "idx_users_discovery_flags", columnList = "discovery_visible,recommendation_opt_out"),
    @Index(name = "idx_users_last_music_sync_at", columnList = "last_music_sync_at"),
    @Index(name = "idx_users_username", columnList = "username"),
    @Index(name = "idx_users_last_seen_at", columnList = "last_seen_at DESC")
})
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public UUID id;

    @Column(name = "clerk_id", unique = true)
    public String clerkId;

    @Column(nullable = false, unique = true)
    public String username;

    @Column(name = "display_name")
    public String displayName;

    @Column(columnDefinition = "TEXT")
    public String bio;

    public String country;

    @Column(name = "country_code", length = 2)
    public String countryCode;

    @Column(name = "banner_url", columnDefinition = "TEXT")
    public String bannerUrl;

    @Column(name = "banner_text")
    public String bannerText;

    @Column(name = "accent_color")
    public String accentColor;

    @Column(name = "name_color")
    public String nameColor;

    @Column(name = "profile_image", columnDefinition = "TEXT")
    public String profileImage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public String widgets;

    @Column(name = "apple_music_user_token", length = 1024)
    public String appleMusicUserToken;

    @Column(name = "apple_music_connected_at")
    public Instant appleMusicConnectedAt;

    @Column(name = "last_fm_username", length = 100)
    public String lastFmUsername;

    @Column(name = "last_fm_connected_at")
    public Instant lastFmConnectedAt;

    @Column(name = "last_seen_at")
    public Instant lastSeenAt;

    /** ECDH P-256 public key (SPKI, base64) — used for E2E encryption. Null until the user's client uploads it. */
    @Column(name = "public_key", columnDefinition = "TEXT")
    public String publicKey;

    @Column(name = "last_music_sync_at")
    public Instant lastMusicSyncAt;

    @Column(name = "taste_summary_text", columnDefinition = "TEXT")
    public String tasteSummaryText;

    @Column(name = "recommendation_opt_out", nullable = false)
    @ColumnDefault("false")
    public boolean recommendationOptOut = false;

    @Column(name = "discovery_visible", nullable = false)
    @ColumnDefault("true")
    public boolean discoveryVisible = true;

    @Column(name = "date_joined", nullable = false, updatable = false)
    public Instant dateJoined;

    @Column(name = "is_verified", nullable = false)
    @ColumnDefault("false")
    public boolean isVerified = false;

    @Column(name = "role", nullable = false)
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'USER'")
    public UserRole role = UserRole.USER;

    public String website;

    public enum UserRole {
        USER, ADMIN
    }

    @Column(name = "job_title")
    public String jobTitle;

    public String location;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_tags", joinColumns = @JoinColumn(name = "user_id"),
            indexes = @Index(name = "idx_user_tags_user_id", columnList = "user_id"))
    @Column(name = "tag")
    @org.hibernate.annotations.BatchSize(size = 50)
    public List<String> tags = new ArrayList<>();

    @PrePersist
    void onPersist() {
        if (dateJoined == null) {
            dateJoined = Instant.now();
        }
    }
}

package com.groupys.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MyCommunityResDto(
        UUID id,
        String name,
        String genre,
        String imageUrl,
        String bannerUrl,
        String iconType,
        String iconUrl,
        List<String> tags,
        int memberCount,
        Instant joinedAt,
        long postCount
) {
}

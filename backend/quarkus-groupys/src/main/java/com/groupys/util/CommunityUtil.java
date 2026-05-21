package com.groupys.util;

import com.groupys.dto.CommunityResDto;
import com.groupys.model.Community;

public final class CommunityUtil {

    private CommunityUtil() {
    }

    public static CommunityResDto toDto(Community community) {
        return new CommunityResDto(
                community.id,
                community.name,
                community.description,
                community.genre,
                community.country,
                community.countryCode,
                community.imageUrl,
                community.bannerUrl,
                community.iconType,
                community.iconEmoji,
                community.iconUrl,
                community.tags != null ? new java.util.ArrayList<>(community.tags) : java.util.List.of(),
                community.artist != null ? community.artist.getId() : null,
                community.memberCount,
                community.createdBy != null ? community.createdBy.id : null,
                community.createdAt,
                community.visibility,
                community.discoveryEnabled,
                community.lastProfileRefreshAt,
                community.tasteSummaryText
        );
    }
}

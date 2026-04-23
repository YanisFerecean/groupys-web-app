package com.groupys.service;

import com.groupys.dto.CommunityCreateDto;
import com.groupys.dto.CommunityMemberResDto;
import com.groupys.dto.CommunityResDto;
import com.groupys.dto.CommunityUpdateDto;
import com.groupys.dto.MyCommunityResDto;
import com.groupys.model.Artist;
import com.groupys.model.Community;
import com.groupys.model.CommunityMember;
import com.groupys.model.User;
import com.groupys.repository.ArtistRepository;
import com.groupys.repository.CommunityMemberRepository;
import com.groupys.repository.CommunityRepository;
import com.groupys.repository.UserRepository;
import com.groupys.util.CountryUtil;
import com.groupys.util.CommunityUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class CommunityService {

    @Inject
    CommunityRepository communityRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    CommunityMemberRepository communityMemberRepository;

    @Inject
    ArtistRepository artistRepository;

    @Inject
    DiscoveryService discoveryService;

    @Inject
    com.groupys.repository.PostRepository postRepository;

    public List<MyCommunityResDto> getJoinedCommunities(String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return communityMemberRepository.findByUser(user.id).stream()
                .map(m -> new MyCommunityResDto(
                        m.community.id,
                        m.community.name,
                        m.community.genre,
                        m.community.imageUrl,
                        m.community.bannerUrl,
                        m.community.iconType,
                        m.community.iconUrl,
                        m.community.tags != null ? m.community.tags : java.util.List.of(),
                        m.community.memberCount,
                        m.joinedAt,
                        postRepository.countByAuthorAndCommunity(user.id, m.community.id)
                ))
                .toList();
    }

    public List<CommunityResDto> search(String q) {
        return search(q, 10);
    }

    public List<CommunityResDto> listAll() {
        return communityRepository.listAll().stream()
                .map(CommunityUtil::toDto)
                .toList();
    }

    public List<CommunityResDto> getTrending(int limit) {
        Instant since = Instant.now().minus(7, ChronoUnit.DAYS);
        return communityMemberRepository.findTrendingCommunityIds(since, limit).stream()
                .map(id -> communityRepository.findByIdOptional(id))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(CommunityUtil::toDto)
                .toList();
    }

    public List<CommunityResDto> search(String query, int limit) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isBlank()) {
            return List.of();
        }
        return communityRepository.searchByQuery(normalizedQuery, limit).stream()
                .map(CommunityUtil::toDto)
                .toList();
    }

    public CommunityResDto getById(UUID id) {
        Community community = communityRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        return CommunityUtil.toDto(community);
    }

    public CommunityResDto getByName(String name) {
        Community community = communityRepository.findByName(name)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        return CommunityUtil.toDto(community);
    }

    public List<CommunityResDto> getByGenre(String genre) {
        return communityRepository.findByGenre(genre).stream()
                .map(CommunityUtil::toDto)
                .toList();
    }

    public List<CommunityResDto> getByCountry(String country) {
        return communityRepository.findByCountry(country).stream()
                .map(CommunityUtil::toDto)
                .toList();
    }

    public List<CommunityResDto> getByArtist(Long artistId) {
        return communityRepository.findByArtist(artistId).stream()
                .map(CommunityUtil::toDto)
                .toList();
    }

    @Transactional
    public CommunityResDto create(CommunityCreateDto dto, String clerkId) {
        User creator = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));

        Community community = new Community();
        community.name = dto.name();
        community.description = dto.description();
        community.genre = dto.genre();
        community.country = dto.country();
        community.countryCode = CountryUtil.resolveCountryCode(dto.countryCode(), dto.country());
        community.imageUrl = dto.imageUrl();
        community.bannerUrl = dto.bannerUrl();
        community.iconType = dto.iconType();
        community.iconEmoji = dto.iconEmoji();
        community.iconUrl = dto.iconUrl();
        if (dto.visibility() != null) {
            community.visibility = dto.visibility();
        }
        if (dto.discoveryEnabled() != null) {
            community.discoveryEnabled = dto.discoveryEnabled();
        }
        community.tasteSummaryText = dto.tasteSummaryText();
        if (dto.artistId() != null) {
            Artist artist = artistRepository.findByIdOptional(dto.artistId())
                    .orElseThrow(() -> new NotFoundException("Artist not found"));
            community.artist = artist;
        }
        if (dto.tags() != null) {
            community.tags = new java.util.ArrayList<>(dto.tags());
        }
        community.memberCount = 1;
        community.createdBy = creator;
        communityRepository.persist(community);

        CommunityMember membership = new CommunityMember();
        membership.community = community;
        membership.user = creator;
        membership.role = "owner";
        membership.source = "COMMUNITY_CREATE";
        communityMemberRepository.persist(membership);

        discoveryService.refreshAfterCommunityChange(creator.id, community.id);

        return CommunityUtil.toDto(community);
    }

    @Transactional
    public CommunityResDto join(UUID communityId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));

        if (communityMemberRepository.findByUserAndCommunity(user.id, communityId).isPresent()) {
            return CommunityUtil.toDto(community);
        }

        CommunityMember membership = new CommunityMember();
        membership.community = community;
        membership.user = user;
        membership.role = "member";
        membership.source = "USER_JOIN";
        communityMemberRepository.persist(membership);

        community.memberCount++;
        discoveryService.refreshAfterCommunityChange(user.id, community.id);
        return CommunityUtil.toDto(community);
    }

    @Transactional
    public CommunityResDto leave(UUID communityId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));

        CommunityMember membership = communityMemberRepository
                .findByUserAndCommunity(user.id, communityId)
                .orElseThrow(() -> new NotFoundException("Not a member"));

        if ("owner".equals(membership.role)) {
            throw new jakarta.ws.rs.BadRequestException("Owner cannot leave the community");
        }

        communityMemberRepository.delete(membership);
        community.memberCount = Math.max(0, community.memberCount - 1);
        discoveryService.refreshAfterCommunityChange(user.id, community.id);
        return CommunityUtil.toDto(community);
    }

    public boolean isMember(UUID communityId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        return communityMemberRepository.findByUserAndCommunity(user.id, communityId).isPresent();
    }

    public boolean isOwner(UUID communityId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        return community.createdBy != null && community.createdBy.id.equals(user.id);
    }

    public List<CommunityMemberResDto> getMembers(UUID communityId) {
        communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        return communityMemberRepository.findByCommunity(communityId).stream()
                .map(m -> new CommunityMemberResDto(
                        m.id,
                        m.user.id,
                        m.user.username,
                        m.user.displayName,
                        m.user.profileImage,
                        m.role,
                        m.joinedAt
                ))
                .toList();
    }

    @Transactional
    public CommunityResDto updateBanner(UUID id, String bannerUrl) {
        Community community = communityRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        community.bannerUrl = bannerUrl;
        return CommunityUtil.toDto(community);
    }

    @Transactional
    public CommunityResDto updateIcon(UUID id, String iconUrl) {
        Community community = communityRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        community.iconUrl = iconUrl;
        community.iconType = "IMAGE";
        return CommunityUtil.toDto(community);
    }

    @Transactional
    public CommunityResDto update(UUID id, CommunityUpdateDto dto, String clerkId) {
        Community community = requireOwnedCommunity(id, clerkId);
        if (dto.name() != null) {
            String trimmedName = dto.name().trim();
            if (trimmedName.isEmpty()) {
                throw new BadRequestException("Community name cannot be blank");
            }
            community.name = trimmedName;
        }
        community.description = dto.description();
        community.genre = dto.genre();
        community.country = dto.country();
        community.countryCode = CountryUtil.resolveCountryCode(dto.countryCode(), dto.country());
        community.imageUrl = dto.imageUrl();
        community.bannerUrl = dto.bannerUrl();
        community.iconType = dto.iconType();
        community.iconEmoji = dto.iconEmoji();
        community.iconUrl = dto.iconUrl();
        if (dto.tags() != null) {
            community.tags = new java.util.ArrayList<>(dto.tags());
        }
        community.artist = dto.artistId() != null
                ? artistRepository.findByIdOptional(dto.artistId())
                .orElseThrow(() -> new NotFoundException("Artist not found"))
                : null;
        if (dto.visibility() != null) {
            community.visibility = dto.visibility();
        }
        if (dto.discoveryEnabled() != null) {
            community.discoveryEnabled = dto.discoveryEnabled();
        }
        community.tasteSummaryText = dto.tasteSummaryText();
        discoveryService.refreshAfterCommunityActivity(id);
        return CommunityUtil.toDto(community);
    }

    @Transactional
    public void delete(UUID id, String clerkId) {
        requireOwnedCommunity(id, clerkId);
        java.util.List<UUID> impactedUserIds = communityMemberRepository.findByCommunity(id).stream()
                .map(member -> member.user.id)
                .distinct()
                .toList();
        Community community = communityRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        communityRepository.delete(community);
        discoveryService.removeCommunityReferences(id, impactedUserIds);
    }

    private Community requireOwnedCommunity(UUID communityId, String clerkId) {
        User user = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Community community = communityRepository.findByIdOptional(communityId)
                .orElseThrow(() -> new NotFoundException("Community not found"));
        if (community.createdBy == null || !community.createdBy.id.equals(user.id)) {
            throw new ForbiddenException("Only the community owner can modify community settings");
        }
        return community;
    }
}

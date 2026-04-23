package com.groupys.resource;

import com.groupys.dto.CommunityCreateDto;
import com.groupys.dto.CommunityMemberResDto;
import com.groupys.dto.CommunityResDto;
import com.groupys.dto.CommunityUpdateDto;
import com.groupys.dto.MyCommunityResDto;
import com.groupys.model.User;
import com.groupys.repository.UserRepository;
import com.groupys.service.CommunityService;
import com.groupys.service.StorageService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;

@Path("/communities")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class CommunityResource {

    @Inject
    CommunityService communityService;

    @Inject
    StorageService storageService;

    @Inject
    MinioClient minioClient;

    @Inject
    JsonWebToken jwt;

    @Inject
    UserRepository userRepository;

    @GET
    public List<CommunityResDto> list() {
        return communityService.listAll();
    }

    @GET
    @Path("/search")
    public List<CommunityResDto> search(@QueryParam("q") String query,
                                        @QueryParam("limit") @DefaultValue("10") int limit) {
        return communityService.search(query, limit);
    }

    @GET
    @Path("/mine")
    public List<MyCommunityResDto> getMine() {
        return communityService.getJoinedCommunities(jwt.getSubject());
    }

    @GET
    @Path("/trending")
    public List<CommunityResDto> getTrending(@QueryParam("limit") @DefaultValue("5") int limit) {
        return communityService.getTrending(limit);
    }

    @GET
    @Path("/{id}")
    public CommunityResDto getById(@PathParam("id") UUID id) {
        return communityService.getById(id);
    }

    @GET
    @Path("/name/{name}")
    public CommunityResDto getByName(@PathParam("name") String name) {
        return communityService.getByName(name);
    }

    @GET
    @Path("/genre/{genre}")
    public List<CommunityResDto> getByGenre(@PathParam("genre") String genre) {
        return communityService.getByGenre(genre);
    }

    @GET
    @Path("/country/{country}")
    public List<CommunityResDto> getByCountry(@PathParam("country") String country) {
        return communityService.getByCountry(country);
    }

    @GET
    @Path("/artist/{artistId}")
    public List<CommunityResDto> getByArtist(@PathParam("artistId") Long artistId) {
        return communityService.getByArtist(artistId);
    }

    @POST
    @Path("/{id}/join")
    public CommunityResDto join(@PathParam("id") UUID id) {
        String clerkId = jwt.getSubject();
        return communityService.join(id, clerkId);
    }

    @POST
    @Path("/{id}/leave")
    public CommunityResDto leave(@PathParam("id") UUID id) {
        String clerkId = jwt.getSubject();
        return communityService.leave(id, clerkId);
    }

    @GET
    @Path("/{id}/members")
    public List<CommunityMemberResDto> getMembers(@PathParam("id") UUID id) {
        return communityService.getMembers(id);
    }

    @GET
    @Path("/{id}/membership")
    public Response checkMembership(@PathParam("id") UUID id) {
        String clerkId = jwt.getSubject();
        boolean member = communityService.isMember(id, clerkId);
        boolean owner = communityService.isOwner(id, clerkId);
        return Response.ok(java.util.Map.of("member", member, "owner", owner)).build();
    }

    @POST
    public Response create(@Valid CommunityCreateDto dto) {
        String clerkId = jwt.getSubject();
        CommunityResDto created = communityService.create(dto, clerkId);
        return Response.created(URI.create("/api/communities/" + created.id())).entity(created).build();
    }

    @PUT
    @Path("/{id}")
    public CommunityResDto update(@PathParam("id") UUID id, @Valid CommunityUpdateDto dto) {
        return communityService.update(id, dto, jwt.getSubject());
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") UUID id) {
        communityService.delete(id, jwt.getSubject());
        return Response.noContent().build();
    }

    @POST
    @Path("/{id}/banner")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public CommunityResDto uploadBanner(@PathParam("id") UUID id, @RestForm("file") FileUpload file) {
        if (file == null || file.size() == 0) {
            throw new BadRequestException("No file provided");
        }
        try {
            InputStream is = Files.newInputStream(file.uploadedFile());
            String key = storageService.uploadToBucket("communitybanners", file.fileName(), file.contentType(), is, file.size());
            is.close();
            return communityService.updateBanner(id, "/api/communities/banner/" + key);
        } catch (Exception e) {
            throw new InternalServerErrorException("Banner upload failed", e);
        }
    }

    @POST
    @Path("/{id}/icon")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public CommunityResDto uploadIcon(@PathParam("id") UUID id, @RestForm("file") FileUpload file) {
        if (file == null || file.size() == 0) {
            throw new BadRequestException("No file provided");
        }
        try {
            InputStream is = Files.newInputStream(file.uploadedFile());
            String key = storageService.uploadToBucket("communityicons", file.fileName(), file.contentType(), is, file.size());
            is.close();
            return communityService.updateIcon(id, "/api/communities/icon/" + key);
        } catch (Exception e) {
            throw new InternalServerErrorException("Icon upload failed", e);
        }
    }

    @GET
    @Path("/icon/{key}")
    @Produces(MediaType.WILDCARD)
    @PermitAll
    public Response getIcon(@PathParam("key") String key) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket("communityicons").object(key).build());
            InputStream stream = minioClient.getObject(
                    GetObjectArgs.builder().bucket("communityicons").object(key).build());
            return Response.ok(stream)
                    .header("Content-Type", stat.contentType())
                    .header("Content-Length", stat.size())
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .build();
        } catch (Exception e) {
            throw new NotFoundException("Icon not found");
        }
    }

    @GET
    @Path("/banner/{key}")
    @Produces(MediaType.WILDCARD)
    @PermitAll
    public Response getBanner(@PathParam("key") String key) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket("communitybanners").object(key).build());
            InputStream stream = minioClient.getObject(
                    GetObjectArgs.builder().bucket("communitybanners").object(key).build());
            return Response.ok(stream)
                    .header("Content-Type", stat.contentType())
                    .header("Content-Length", stat.size())
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .build();
        } catch (Exception e) {
            throw new NotFoundException("Banner not found");
        }
    }

    @POST
    @Path("/media/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadMedia(@RestForm("file") FileUpload file) {
        if (file == null || file.size() == 0) {
            throw new BadRequestException("No file provided");
        }
        try {
            User user = userRepository.findByClerkId(jwt.getSubject())
                    .orElseThrow(() -> new NotFoundException("User not found"));
            String mediaType = file.contentType();
            InputStream is = Files.newInputStream(file.uploadedFile());
            String mediaUrl = storageService.uploadPostMedia(user.id, file.fileName(), mediaType, is, file.size());
            is.close();
            return Response.ok(java.util.Map.of("url", mediaUrl)).build();
        } catch (Exception e) {
            throw new InternalServerErrorException("File upload failed", e);
        }
    }
}

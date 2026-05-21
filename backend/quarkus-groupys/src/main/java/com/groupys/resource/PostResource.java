package com.groupys.resource;

import com.groupys.dto.PostResDto;
import com.groupys.model.PostMedia;
import com.groupys.model.User;
import com.groupys.repository.UserRepository;
import com.groupys.service.MediaService;
import com.groupys.service.PostService;
import com.groupys.service.StorageService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.jboss.resteasy.reactive.RestForm;

import java.io.InputStream;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Path("/posts")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class PostResource {

    @Inject
    PostService postService;

    @Inject
    StorageService storageService;

    @Inject
    MediaService mediaService;

    @Inject
    MinioClient minioClient;

    @Inject
    JsonWebToken jwt;

    @Inject
    UserRepository userRepository;

    @Inject
    com.groupys.repository.PostRepository postRepository;

    private static final long MAX_NON_VIDEO_FILE_BYTES = 25L * 1024 * 1024; // 25 MB
    private static final long MAX_VIDEO_FILE_BYTES = 100L * 1024 * 1024; // 100 MB

    @GET
    @Path("/feed")
    public List<PostResDto> getFeed(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return postService.getFeed(jwt.getSubject(), page, Math.min(size, 50));
    }

    @GET
    @Path("/mine")
    public List<PostResDto> getMyPosts(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return postService.getAccountPosts(jwt.getSubject(), page, Math.min(size, 50));
    }

    @GET
    @Path("/liked")
    public List<PostResDto> getLikedPosts(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return postService.getLikedPosts(jwt.getSubject(), page, Math.min(size, 50));
    }

    @GET
    @Path("/author/{userId}")
    public List<PostResDto> getByAuthor(@PathParam("userId") UUID userId) {
        return postService.getByAuthor(userId, jwt.getSubject());
    }

    @GET
    @Path("/author/{userId}/count")
    @PermitAll
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAuthorPostCount(@PathParam("userId") UUID userId) {
        long count = postRepository.countByAuthor(userId);
        return Response.ok(java.util.Map.of("count", count)).build();
    }

    @GET
    @Path("/{id}")
    public PostResDto getById(@PathParam("id") UUID id) {
        return postService.getById(id, jwt.getSubject());
    }

    @GET
    @Path("/community/{communityId}")
    public List<PostResDto> getByCommunity(
            @PathParam("communityId") UUID communityId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return postService.getByCommunity(communityId, jwt.getSubject(), page, Math.min(size, 50));
    }

    @POST
    @Path("/media/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadMedia(@RestForm("file") FileUpload file) {
        String clerkId = jwt.getSubject();
        User currentUser = userRepository.findByClerkId(clerkId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (file == null) {
            return Response.status(400).entity(java.util.Map.of("error", "No file provided")).build();
        }
        try {
            String mediaType = file.contentType();
            boolean isVideo = mediaType != null && mediaType.startsWith("video/");
            long maxAllowedBytes = isVideo ? MAX_VIDEO_FILE_BYTES : MAX_NON_VIDEO_FILE_BYTES;
            if (file.size() > maxAllowedBytes) {
                String message = isVideo
                        ? "Video file exceeds 100 MB limit"
                        : "File exceeds 25 MB limit";
                return Response.status(400).entity(java.util.Map.of("error", message)).build();
            }

            String mediaUrl;
            String finalType;
            if (mediaType != null && mediaType.startsWith("image/")) {
                MediaService.ProcessedMedia processed;
                try (InputStream is = Files.newInputStream(file.uploadedFile())) {
                    processed = mediaService.processImage(is, mediaType);
                }
                mediaUrl = storageService.uploadPostMedia(currentUser.id, file.fileName(), processed.contentType(), processed.stream(), processed.size());
                finalType = processed.contentType();
            } else if (mediaType != null && (mediaType.startsWith("video/") || mediaType.startsWith("audio/"))) {
                try {
                    MediaService.ProcessedMedia processed = mediaType.startsWith("video/")
                            ? mediaService.processVideo(file.uploadedFile())
                            : mediaService.processAudio(file.uploadedFile());
                    mediaUrl = storageService.uploadPostMedia(currentUser.id, file.fileName(), processed.contentType(), processed.stream(), processed.size());
                    finalType = processed.contentType();
                } catch (Exception ffmpegEx) {
                    try (InputStream is = Files.newInputStream(file.uploadedFile())) {
                        mediaUrl = storageService.uploadPostMedia(currentUser.id, file.fileName(), mediaType, is, file.size());
                        finalType = mediaType;
                    }
                }
            } else {
                try (InputStream is = Files.newInputStream(file.uploadedFile())) {
                    mediaUrl = storageService.uploadPostMedia(currentUser.id, file.fileName(), mediaType, is, file.size());
                    finalType = mediaType;
                }
            }
            return Response.ok(java.util.Map.of("url", mediaUrl, "type", finalType)).build();
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Upload failed";
            return Response.status(500).entity(java.util.Map.of("error", msg)).build();
        }
    }

    @DELETE
    @Path("/media/{key:.+}")
    public Response deleteMedia(@PathParam("key") String key) {
        storageService.delete("/api/posts/media/" + key);
        return Response.noContent().build();
    }

    @POST
    @Path("/community/{communityId}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response create(
            @PathParam("communityId") UUID communityId,
            @RestForm("title") String title,
            @RestForm("content") String content,
            @RestForm("mediaUrls") List<String> mediaUrls,
            @RestForm("mediaTypes") List<String> mediaTypes) {

        String clerkId = jwt.getSubject();
        List<PostMedia> mediaList = new ArrayList<>();

        if (mediaUrls != null && !mediaUrls.isEmpty()) {
            if (mediaUrls.size() > 4) {
                throw new BadRequestException("Maximum of 4 attachments allowed.");
            }
            for (int i = 0; i < mediaUrls.size(); i++) {
                String url = mediaUrls.get(i);
                String type = (mediaTypes != null && i < mediaTypes.size()) ? mediaTypes.get(i) : "application/octet-stream";
                mediaList.add(new PostMedia(url, type));
            }
        }

        try {
            PostResDto created = postService.create(communityId, title, content, mediaList, clerkId);
            return Response.status(Response.Status.CREATED).entity(created).build();
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Failed to create post";
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(java.util.Map.of("error", msg))
                    .build();
        }
    }

    @POST
    @Path("/{id}/react")
    @Consumes(MediaType.APPLICATION_JSON)
    public PostResDto react(@PathParam("id") UUID id, ReactionRequest request) {
        return postService.react(id, request.type(), jwt.getSubject());
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") UUID id) {
        String clerkId = jwt.getSubject();
        postService.delete(id, clerkId);
        return Response.noContent().build();
    }

    @GET
    @Path("/media/{key:.+}")
    @Produces(MediaType.WILDCARD)
    @PermitAll
    public Response getMedia(
            @PathParam("key") String key,
            @HeaderParam("Range") String rangeHeader) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder().bucket("posts").object(key).build());
            long totalSize = stat.size();
            String contentType = stat.contentType();

            // Handle range requests (required for video streaming on iOS/Android)
            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String[] parts = rangeHeader.substring(6).split("-");
                long start = Long.parseLong(parts[0]);
                long end = parts.length > 1 && !parts[1].isEmpty()
                        ? Long.parseLong(parts[1])
                        : totalSize - 1;
                end = Math.min(end, totalSize - 1);
                long length = end - start + 1;

                InputStream stream = minioClient.getObject(
                        GetObjectArgs.builder()
                                .bucket("posts").object(key)
                                .offset(start).length(length)
                                .build());
                return Response.status(206)
                        .header("Content-Type", contentType)
                        .header("Content-Length", length)
                        .header("Content-Range", "bytes " + start + "-" + end + "/" + totalSize)
                        .header("Accept-Ranges", "bytes")
                        .header("Cache-Control", "public, max-age=31536000, immutable")
                        .entity(stream)
                        .build();
            }

            InputStream stream = minioClient.getObject(
                    GetObjectArgs.builder().bucket("posts").object(key).build());
            return Response.ok(stream)
                    .header("Content-Type", contentType)
                    .header("Content-Length", totalSize)
                    .header("Accept-Ranges", "bytes")
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .build();
        } catch (Exception e) {
            throw new NotFoundException("Media not found");
        }
    }

    public record ReactionRequest(String type) {}
}

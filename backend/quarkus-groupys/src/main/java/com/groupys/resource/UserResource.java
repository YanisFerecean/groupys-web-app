package com.groupys.resource;

import com.groupys.dto.UserCreateDto;
import com.groupys.dto.UserFollowResDto;
import com.groupys.dto.UserResDto;
import com.groupys.dto.UserUpdateDto;
import com.groupys.model.User;
import com.groupys.repository.UserRepository;
import com.groupys.service.DiscoveryService;
import com.groupys.service.StorageService;
import com.groupys.service.UserService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.Parameter;
import org.eclipse.microprofile.openapi.annotations.media.ArraySchema;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponses;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;

@Path("/users")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class UserResource {

    @Inject
    UserService userService;

    @Inject
    UserRepository userRepository;

    @Inject
    DiscoveryService discoveryService;

    @Inject
    StorageService storageService;

    @Inject
    MinioClient minioClient;

    @Inject
    JsonWebToken jwt;

    @GET
    @Operation(summary = "List all users", description = "Returns a list of all registered users")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "List of users retrieved successfully",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "401", description = "Unauthorized - authentication required")
    })
    public List<UserResDto> list() {
        return userService.listAll();
    }

    @GET
    @Path("/search")
    @Operation(summary = "Search users", description = "Search users by username or display name")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "Search results",
                     content = @Content(array = @ArraySchema(schema = @Schema(implementation = UserResDto.class)))),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public List<UserResDto> search(
            @Parameter(description = "Search query", required = true) @QueryParam("q") String query,
            @Parameter(description = "Maximum results to return", example = "10")
            @QueryParam("limit") @DefaultValue("10") int limit) {
        return userService.search(jwt.getSubject(), query, limit);
    }

    @GET
    @Path("/{id: [0-9a-fA-F\\-]{36}}")
    @Operation(summary = "Get user by ID", description = "Returns a single user by their UUID")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "User found",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public UserResDto getById(
            @Parameter(description = "User UUID", required = true) @PathParam("id") UUID id) {
        return userService.getById(id);
    }

    @GET
    @Path("/username/{username}")
    @Operation(summary = "Get user by username", description = "Returns a single user by their username")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "User found",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public UserResDto getByUsername(
            @Parameter(description = "Username", required = true) @PathParam("username") String username) {
        return userService.getByUsername(username);
    }

    @GET
    @Path("/clerk/{clerkId}")
    @Operation(summary = "Get user by Clerk ID", description = "Returns a single user by their Clerk authentication ID")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "User found",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public UserResDto getByClerkId(
            @Parameter(description = "Clerk authentication ID", required = true) @PathParam("clerkId") String clerkId) {
        return userService.getByClerkId(clerkId);
    }

    @POST
    @Operation(summary = "Create a new user", description = "Creates a new user with the provided details")
    @APIResponses({
        @APIResponse(responseCode = "201", description = "User created successfully",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "409", description = "User with this clerkId already exists"),
        @APIResponse(responseCode = "400", description = "Invalid input"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response create(
            @RequestBody(description = "User creation data", required = true,
                         content = @Content(schema = @Schema(implementation = UserCreateDto.class)))
            @Valid UserCreateDto dto) {
        if (userService.findByClerkId(dto.clerkId()).isPresent()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("{\"error\":\"User with this clerkId already exists\"}")
                    .build();
        }
        UserResDto created = userService.create(dto);
        return Response.created(URI.create("/api/users/" + created.id())).entity(created).build();
    }

    @PUT
    @Path("/{id: [0-9a-fA-F\\-]{36}}")
    @Operation(summary = "Update user", description = "Updates an existing user's profile")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "User updated successfully",
                     content = @Content(schema = @Schema(implementation = UserResDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "400", description = "Invalid input"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public UserResDto update(
            @Parameter(description = "User UUID", required = true) @PathParam("id") UUID id,
            @RequestBody(description = "User update data", required = true,
                         content = @Content(schema = @Schema(implementation = UserUpdateDto.class)))
            @Valid UserUpdateDto dto) {
        return userService.update(id, dto);
    }

    @POST
    @Path("/{id: [0-9a-fA-F\\-]{36}}/follow")
    @Operation(summary = "Follow user", description = "Follow another user by their ID")
    @APIResponses({
        @APIResponse(responseCode = "200", description = "User followed successfully",
                     content = @Content(schema = @Schema(implementation = UserFollowResDto.class))),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "400", description = "Already following"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public UserFollowResDto follow(
            @Parameter(description = "User UUID to follow", required = true) @PathParam("id") UUID id) {
        return discoveryService.followUser(jwt.getSubject(), id);
    }

    @DELETE
    @Path("/{id: [0-9a-fA-F\\-]{36}}")
    @Operation(summary = "Delete user", description = "Deletes a user by their UUID (admin only)")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "User deleted successfully"),
        @APIResponse(responseCode = "404", description = "User not found"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response delete(
            @Parameter(description = "User UUID", required = true) @PathParam("id") UUID id) {
        userService.delete(id);
        return Response.noContent().build();
    }

    @DELETE
    @Path("/me")
    @Operation(summary = "Delete own account", description = "Deletes the authenticated user's own account")
    @APIResponses({
        @APIResponse(responseCode = "204", description = "Account deleted successfully"),
        @APIResponse(responseCode = "401", description = "Unauthorized")
    })
    public Response deleteMe() {
        userService.deleteOwnAccount(jwt.getSubject());
        return Response.noContent().build();
    }

    private static final long MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final String BANNER_PREFIX = "/api/users/banner/";

    @POST
    @Path("/banner")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public UserResDto uploadBanner(@RestForm("file") FileUpload file) {
        if (file == null || file.size() == 0) {
            throw new BadRequestException("No file provided");
        }
        if (file.size() > MAX_BANNER_SIZE) {
            throw new BadRequestException("File too large. Maximum size is 5 MB.");
        }
        String contentType = file.contentType();
        if (contentType == null || !(contentType.equals("image/jpeg") || contentType.equals("image/png") || contentType.equals("image/webp"))) {
            throw new BadRequestException("Unsupported format. Use JPG, PNG, or WebP.");
        }
        try {
            // Delete old banner from MinIO if present
            User user = userRepository.findByClerkId(jwt.getSubject())
                .orElseThrow(() -> new NotFoundException("User not found"));
            if (user.bannerUrl != null && user.bannerUrl.startsWith(BANNER_PREFIX)) {
                String oldKey = user.bannerUrl.substring(BANNER_PREFIX.length());
                try {
                    minioClient.removeObject(
                        RemoveObjectArgs.builder().bucket("banners").object(oldKey).build());
                } catch (Exception e) {
                    System.err.println("Failed to delete old banner: " + e.getMessage());
                }
            }

            InputStream is = Files.newInputStream(file.uploadedFile());
            String key = storageService.uploadToBucket("banners", file.fileName(), file.contentType(), is, file.size());
            is.close();
            return userService.updateBanner(jwt.getSubject(), BANNER_PREFIX + key);
        } catch (Exception e) {
            throw new InternalServerErrorException("Banner upload failed", e);
        }
    }

    @GET
    @Path("/banner/{key}")
    @Produces(MediaType.WILDCARD)
    @PermitAll
    public Response getBanner(@PathParam("key") String key) {
        try {
            StatObjectResponse stat = minioClient.statObject(
                StatObjectArgs.builder().bucket("banners").object(key).build());
            InputStream stream = minioClient.getObject(
                GetObjectArgs.builder().bucket("banners").object(key).build());
            return Response.ok(stream)
                .header("Content-Type", stat.contentType())
                .header("Content-Length", stat.size())
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .build();
        } catch (Exception e) {
            throw new NotFoundException("Banner not found");
        }
    }
}

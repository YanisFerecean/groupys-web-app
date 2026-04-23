package com.groupys.resource;

import com.groupys.dto.AlbumResDto;
import com.groupys.service.AlbumService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;

@Path("/albums")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class AlbumResource {

    @Inject
    AlbumService albumService;

    @GET
    @Path("/search")
    public List<AlbumResDto> search(@QueryParam("q") String query,
                                    @DefaultValue("10") @QueryParam("limit") int limit) {
        return albumService.search(query, limit);
    }

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        AlbumResDto album = albumService.getById(id);
        if (album == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(album).build();
    }
}

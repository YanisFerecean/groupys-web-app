package com.groupys.resource;

import com.groupys.dto.TrackResDto;
import com.groupys.service.TrackService;
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

@Path("/tracks")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class TrackResource {

    @Inject
    TrackService trackService;

    @GET
    @Path("/search")
    public List<TrackResDto> search(@QueryParam("q") String query,
                                    @DefaultValue("10") @QueryParam("limit") int limit) {
        return trackService.search(query, limit);
    }

    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        TrackResDto track = trackService.getById(id);
        if (track == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(track).build();
    }
}

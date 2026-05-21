package com.groupys.resource;

import com.groupys.model.Genre;
import com.groupys.service.GenreService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

import java.util.List;
import java.util.Map;

@Path("/genres")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class GenreResource {

    @Inject
    GenreService genreService;

    @GET
    public List<Map<String, Object>> search(@QueryParam("q") String q) {
        return genreService.search(q).stream()
                .map(g -> Map.<String, Object>of("id", g.id, "name", g.name))
                .toList();
    }
}

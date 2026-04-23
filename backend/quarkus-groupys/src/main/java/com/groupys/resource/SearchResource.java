package com.groupys.resource;

import com.groupys.dto.SearchResDto;
import com.groupys.service.SearchService;
import io.quarkus.security.Authenticated;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.openapi.annotations.security.SecurityRequirement;

@Path("/search")
@Authenticated
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
@SecurityRequirement(name = "bearerAuth")
public class SearchResource {

    @Inject
    SearchService searchService;

    @GET
    public SearchResDto search(@QueryParam("q") String query) {
        return searchService.search(query);
    }
}

package com.groupys.resource;

import com.groupys.model.Country;
import com.groupys.service.CountryService;
import jakarta.annotation.security.PermitAll;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.Map;

@Path("/countries")
@PermitAll
@RequestScoped
@Produces(MediaType.APPLICATION_JSON)
public class CountryResource {

    @Inject
    CountryService countryService;

    @GET
    public List<Map<String, String>> search(@QueryParam("q") String q) {
        return countryService.search(q).stream()
                .map(c -> Map.of("code", c.code, "name", c.name))
                .toList();
    }
}

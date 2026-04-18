package com.groupys.config;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Named;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Configuration for virtual thread executor.
 * Provides a named executor service that uses virtual threads for blocking operations.
 */
@ApplicationScoped
public class VirtualThreadConfig {

    /**
     * Creates a virtual thread executor service for blocking I/O operations.
     * Virtual threads are lightweight and ideal for blocking external API calls.
     *
     * @return ExecutorService backed by virtual threads
     */
    @Produces
    @Named("virtual-thread-executor")
    public ExecutorService virtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}

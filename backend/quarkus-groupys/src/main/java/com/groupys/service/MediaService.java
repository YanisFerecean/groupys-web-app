package com.groupys.service;

import jakarta.enterprise.context.ApplicationScoped;
import net.coobird.thumbnailator.Thumbnails;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Set;

/**
 * Compresses uploaded media before it reaches MinIO.
 * - Images: resized to max 2048px, re-encoded as JPEG 85%
 * - Videos: scaled to max 1080p, H.264 CRF 28, AAC 128 k (MP4)
 * - Audio: re-encoded as AAC 128 k (M4A)
 * FFmpeg must be on PATH for video/audio processing.
 */
@ApplicationScoped
public class MediaService {

    private static final int MAX_IMAGE_DIMENSION = 2048;
    private static final float JPEG_QUALITY = 0.85f;

    // Allowed file extensions for security
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp");
    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS = Set.of("mp4", "mov", "avi", "mkv", "webm", "ogv");
    private static final Set<String> ALLOWED_AUDIO_EXTENSIONS = Set.of("mp3", "aac", "wav", "flac", "ogg", "m4a");

    public record ProcessedMedia(InputStream stream, long size, String contentType) {}

    /**
     * Validates file extension against allowed types.
     */
    public boolean isAllowedFileType(String fileName, String contentType) {
        if (fileName == null || fileName.isBlank()) {
            return false;
        }
        String ext = getFileExtension(fileName).toLowerCase();

        // Validate by content type and extension
        if (contentType != null) {
            String ct = contentType.toLowerCase();
            if (ct.startsWith("image/") && ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
                return true;
            }
            if (ct.startsWith("video/") && ALLOWED_VIDEO_EXTENSIONS.contains(ext)) {
                return true;
            }
            if (ct.startsWith("audio/") && ALLOWED_AUDIO_EXTENSIONS.contains(ext)) {
                return true;
            }
        }
        return false;
    }

    private String getFileExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 && lastDot < fileName.length() - 1
            ? fileName.substring(lastDot + 1)
            : "";
    }

    /**
     * Sanitizes a file path to prevent command injection.
     * Returns a safe path string without directory traversal.
     */
    public String sanitizePath(Path inputPath) {
        if (inputPath == null) {
            throw new IllegalArgumentException("Input path cannot be null");
        }
        // Get just the file name, not the full path
        String fileName = inputPath.getFileName().toString();
        // Remove any path traversal characters
        fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
        // Prevent path traversal attempts
        if (fileName.contains("..") || fileName.contains("//")) {
            throw new SecurityException("Path traversal attempt detected");
        }
        return fileName;
    }

    // ── Images ───────────────────────────────────────────────────────────────

    public ProcessedMedia processImage(InputStream input, String contentType) {
        try {
            // GIFs must not be re-encoded — JPEG conversion strips animation frames
            if ("image/gif".equalsIgnoreCase(contentType)) {
                byte[] bytes = input.readAllBytes();
                return new ProcessedMedia(new ByteArrayInputStream(bytes), bytes.length, "image/gif");
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(input)
                    .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                    .keepAspectRatio(true)
                    .outputFormat("JPEG")
                    .outputQuality(JPEG_QUALITY)
                    .toOutputStream(out);
            byte[] bytes = out.toByteArray();
            return new ProcessedMedia(new ByteArrayInputStream(bytes), bytes.length, "image/jpeg");
        } catch (Exception e) {
            throw new RuntimeException("Image processing failed", e);
        }
    }

    // ── Video ─────────────────────────────────────────────────────────────────

    public ProcessedMedia processVideo(Path inputPath) {
        Path outputPath = null;
        try {
            // Validate and sanitize the input path
            String safeFileName = sanitizePath(inputPath);
            Path safeInputPath = inputPath.getParent().resolve(safeFileName).normalize();

            // Ensure the path is within the expected temp directory
            Path tempDir = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            if (!safeInputPath.startsWith(tempDir)) {
                throw new SecurityException("Input path is outside of temp directory");
            }

            outputPath = Files.createTempFile("vid-out-", ".mp4");
            ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg", "-y",
                "-i", safeInputPath.toString(),
                "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
                "-c:v", "libx264", "-crf", "28", "-preset", "fast",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                outputPath.toString()
            );
            pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            int exitCode = pb.start().waitFor();
            if (exitCode != 0) {
                throw new RuntimeException("FFmpeg video processing failed (exit " + exitCode + ")");
            }
            byte[] bytes = Files.readAllBytes(outputPath);
            return new ProcessedMedia(new ByteArrayInputStream(bytes), bytes.length, "video/mp4");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Video processing failed", e);
        } finally {
            if (outputPath != null) {
                try { Files.deleteIfExists(outputPath); } catch (Exception ignored) {}
            }
        }
    }

    // ── Audio ─────────────────────────────────────────────────────────────────

    public ProcessedMedia processAudio(Path inputPath) {
        Path outputPath = null;
        try {
            // Validate and sanitize the input path
            String safeFileName = sanitizePath(inputPath);
            Path safeInputPath = inputPath.getParent().resolve(safeFileName).normalize();

            // Ensure the path is within the expected temp directory
            Path tempDir = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
            if (!safeInputPath.startsWith(tempDir)) {
                throw new SecurityException("Input path is outside of temp directory");
            }

            outputPath = Files.createTempFile("aud-out-", ".m4a");
            ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg", "-y",
                "-i", safeInputPath.toString(),
                "-c:a", "aac", "-b:a", "128k",
                "-vn",
                outputPath.toString()
            );
            pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            pb.redirectError(ProcessBuilder.Redirect.DISCARD);
            int exitCode = pb.start().waitFor();
            if (exitCode != 0) {
                throw new RuntimeException("FFmpeg audio processing failed (exit " + exitCode + ")");
            }
            byte[] bytes = Files.readAllBytes(outputPath);
            return new ProcessedMedia(new ByteArrayInputStream(bytes), bytes.length, "audio/mp4");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Audio processing failed", e);
        } finally {
            if (outputPath != null) {
                try { Files.deleteIfExists(outputPath); } catch (Exception ignored) {}
            }
        }
    }
}

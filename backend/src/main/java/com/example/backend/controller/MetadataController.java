package com.example.backend.controller;

import com.example.backend.service.MetadataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/metadata")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class MetadataController {

    private final MetadataService metadataService;

    public MetadataController(MetadataService metadataService) {
        this.metadataService = metadataService;
    }

    /**
     * Create a cms_file_number object under /ECM CONFIG/File Number.
     * POST /api/metadata/file-numbers
     *
     * Body: { object_name, ho_ro, dept_short_code, ro_short_code, description }
     */
    @PostMapping("/file-numbers")
    public ResponseEntity<Map<String, Object>> createFileNumber(@RequestBody Map<String, Object> request) {
        try {
            return ResponseEntity.ok(metadataService.createFileNumber(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Delete a cms_file_number object by its r_object_id.
     * DELETE /api/metadata/file-numbers/{objectId}
     */
    @DeleteMapping("/file-numbers/{objectId}")
    public ResponseEntity<Map<String, Object>> deleteFileNumber(@PathVariable String objectId) {
        try {
            return ResponseEntity.ok(metadataService.deleteFileNumber(objectId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * List existing cms_file_number objects filtered by office type, department, and optionally location.
     * GET /api/metadata/file-numbers?hoRo=HO&deptShortCode=fsdd
     * GET /api/metadata/file-numbers?hoRo=RO&deptShortCode=bid&roShortCode=jk
     */
    @GetMapping("/file-numbers")
    public ResponseEntity<?> listFileNumbers(
            @RequestParam String hoRo,
            @RequestParam String deptShortCode,
            @RequestParam(required = false, defaultValue = "") String roShortCode) {
        try {
            List<Map<String, Object>> results = metadataService.listFileNumbers(hoRo, deptShortCode, roShortCode);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}

package com.example.backend.controller;

import com.example.backend.service.DelegateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/delegate")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class DelegateController {

    private final DelegateService delegateService;

    public DelegateController(DelegateService delegateService) {
        this.delegateService = delegateService;
    }

    /**
     * Search cms_case_folder objects with optional office-type and department filters.
     * GET /api/delegate/cases?query=&hoRo=HO&deptName=Finance&page=1&size=20
     */
    @GetMapping("/cases")
    public ResponseEntity<Map<String, Object>> searchCases(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String deptName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ResponseEntity.ok(delegateService.searchCases(query, hoRo, deptName, page, size));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Delegate a case to a user via the xCP cms_push_back_pull_back process.
     * POST /api/delegate
     * Body: { "caseId": "...", "performerDisplayName": "..." }
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> delegateCase(
            @RequestBody Map<String, Object> request) {
        try {
            String caseId = (String) request.get("caseId");
            String performerDisplayName = (String) request.get("performerDisplayName");

            if (caseId == null || caseId.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "caseId is required"));
            }
            if (performerDisplayName == null || performerDisplayName.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "performerDisplayName is required"));
            }

            return ResponseEntity.ok(delegateService.delegateCase(caseId, performerDisplayName));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}

package com.example.backend.controller;

import com.example.backend.service.DelegateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
     * Search cms_case_folder objects with optional office-type, department, and location filters.
     * GET /api/delegate/cases?query=&hoRo=HO&deptName=Finance&roShortCode=tn&page=1&size=20
     */
    @GetMapping("/cases")
    public ResponseEntity<Map<String, Object>> searchCases(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String deptName,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String roShortCode,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ResponseEntity.ok(delegateService.searchCases(query, hoRo, deptName, deptNames, roShortCode, page, size));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get movement register records for a case.
     * GET /api/delegate/cases/{caseId}/movement
     */
    @GetMapping("/cases/{caseId}/movement")
    public ResponseEntity<List<Map<String, Object>>> getMovementRegister(
            @PathVariable String caseId) {
        try {
            return ResponseEntity.ok(delegateService.getMovementRegister(caseId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Delegate a case to a user via the xCP cms_push_back_pull_back process.
     * POST /api/delegate
     * Body: { "caseId": "...", "performerDisplayName": "...", "loginUsername": "..." }
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> delegateCase(
            @RequestBody Map<String, Object> request) {
        try {
            String caseId = (String) request.get("caseId");
            String performerDisplayName = (String) request.get("performerDisplayName");
            String loginUsername = (String) request.get("loginUsername");

            if (caseId == null || caseId.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "caseId is required"));
            }
            if (performerDisplayName == null || performerDisplayName.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "performerDisplayName is required"));
            }
            if (loginUsername == null || loginUsername.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "message", "loginUsername is required"));
            }

            return ResponseEntity.ok(delegateService.delegateCase(caseId, performerDisplayName, loginUsername));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}

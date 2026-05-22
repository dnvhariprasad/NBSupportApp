package com.example.backend.controller;

import com.example.backend.service.CaseService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cases")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    /**
     * Cases report endpoint with date range, office type, location and department filters.
     * Always excludes is_migrated cases and status='Delete' cases.
     */
    @GetMapping("/report")
    public Map<String, Object> getCasesReport(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String functions,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String priority,
            @RequestParam(defaultValue = "") String language,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return caseService.getCasesReport(hoRo, location, deptNames, functions, fromDate, toDate, status, priority, language, page, size);
    }

    /**
     * Search cases with optional case number, office-type, location, and department filters.
     */
    @GetMapping("/search")
    public Map<String, Object> searchCases(
            @RequestParam(required = false) String caseNumber,
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String roShortCode,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return caseService.searchCases(caseNumber, hoRo, roShortCode, deptNames, page, size);
    }
}

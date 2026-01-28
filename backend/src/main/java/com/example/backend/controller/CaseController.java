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
     * Search cases with optional case number filter
     */
    @GetMapping("/search")
    public Map<String, Object> searchCases(
            @RequestParam(required = false) String caseNumber,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return caseService.searchCases(caseNumber, page, size);
    }
}

package com.example.backend.controller;

import com.example.backend.service.RajbhashaService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rajbhasha")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class RajbhashaController {

    private final RajbhashaService rajbhashaService;

    public RajbhashaController(RajbhashaService rajbhashaService) {
        this.rajbhashaService = rajbhashaService;
    }

    /**
     * Rajbhasha report endpoint with summary and totals.
     * Returns a grid with 2 columns: Summary and Total
     */
    @GetMapping("/report")
    public Map<String, Object> getRajbhashaReport(
            @RequestParam(defaultValue = "") String hoRo,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String deptNames,
            @RequestParam(defaultValue = "") String fromDate,
            @RequestParam(defaultValue = "") String toDate) {
        return rajbhashaService.getRajbhashaReport(hoRo, location, deptNames, fromDate, toDate);
    }
}

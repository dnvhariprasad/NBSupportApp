package com.example.backend.controller;

import com.example.backend.service.QueryService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/query")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class QueryController {

    private final QueryService queryService;

    public QueryController(QueryService queryService) {
        this.queryService = queryService;
    }

    /**
     * Execute a DQL query with optional limit
     */
    @PostMapping("/execute")
    public Map<String, Object> executeQuery(@RequestBody Map<String, Object> request) {
        String dql = (String) request.get("dql");
        Integer limit = request.get("limit") != null ? ((Number) request.get("limit")).intValue() : 10000;
        return queryService.executeQuery(dql, limit);
    }
}

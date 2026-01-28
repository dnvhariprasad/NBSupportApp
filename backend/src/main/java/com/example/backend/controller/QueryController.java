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
     * Execute a DQL query
     */
    @PostMapping("/execute")
    public Map<String, Object> executeQuery(@RequestBody Map<String, Object> request) {
        String dql = (String) request.get("dql");
        int page = request.containsKey("page") ? ((Number) request.get("page")).intValue() : 1;
        int size = request.containsKey("size") ? ((Number) request.get("size")).intValue() : 25;

        return queryService.executeQuery(dql, page, size);
    }
}

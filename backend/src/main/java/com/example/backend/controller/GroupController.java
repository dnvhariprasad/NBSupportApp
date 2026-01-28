package com.example.backend.controller;

import com.example.backend.service.GroupService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@CrossOrigin(origins = { "http://localhost:5173", "http://localhost:5174" })
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    /**
     * Search groups with optional group name filter
     */
    @GetMapping("/search")
    public Map<String, Object> searchGroups(
            @RequestParam(required = false) String groupName,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return groupService.searchGroups(groupName, page, size);
    }
}

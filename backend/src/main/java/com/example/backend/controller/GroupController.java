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

    /**
     * Get detailed information about a specific group including available actions
     */
    @GetMapping("/{groupName}")
    public Map<String, Object> getGroupDetails(@PathVariable String groupName) {
        return groupService.getGroupDetails(groupName);
    }

    /**
     * Get members of a specific group
     */
    @GetMapping("/{groupName}/members")
    public Map<String, Object> getGroupMembers(@PathVariable String groupName) {
        return groupService.getGroupMembers(groupName);
    }

    /**
     * Add member(s) to a group
     */
    @PostMapping("/{groupName}/members")
    public Map<String, Object> addMember(
            @PathVariable String groupName,
            @RequestBody Map<String, Object> request) {
        String memberName = (String) request.get("memberName");
        String memberType = (String) request.get("memberType"); // "user" or "group"
        String memberSrc = (String) request.get("memberSrc"); // src link to the member
        return groupService.addMember(groupName, memberName, memberType, memberSrc);
    }

    /**
     * Remove member from a group
     */
    @DeleteMapping("/{groupName}/members/{memberName}")
    public Map<String, Object> removeMember(
            @PathVariable String groupName,
            @PathVariable String memberName,
            @RequestParam(defaultValue = "user") String memberType) {
        return groupService.removeMember(groupName, memberName, memberType);
    }

    /**
     * Search for users or groups to add as members
     */
    @GetMapping("/search-members")
    public Map<String, Object> searchMembers(
            @RequestParam String query,
            @RequestParam(defaultValue = "user") String type) {
        return groupService.searchMembers(query, type);
    }
}

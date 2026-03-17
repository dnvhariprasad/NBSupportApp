package com.example.backend.controller;

import com.example.backend.service.GroupService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
     * Create a new dm_group (vertical)
     */
    @PostMapping
    public Map<String, Object> createGroup(@RequestBody Map<String, Object> request) {
        String groupName        = (String) request.get("group_name");
        String groupDisplayName = (String) request.get("group_display_name");
        return groupService.createGroup(groupName, groupDisplayName);
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
     * Search dm_groups by name prefix using DQL.
     * GET /api/groups/by-prefix?prefix=ecm_ho_ddsi&size=50
     */
    @GetMapping("/by-prefix")
    public List<Map<String, String>> searchGroupsByPrefix(
            @RequestParam String prefix,
            @RequestParam(defaultValue = "50") int size) {
        return groupService.searchGroupsByPrefix(prefix, size);
    }

    /**
     * Get all groups a user belongs to.
     * GET /api/groups/by-user?username=xxx
     */
    @GetMapping("/by-user")
    public List<Map<String, String>> getGroupsByUser(@RequestParam String username) {
        return groupService.getGroupsByUser(username);
    }

    /**
     * Check whether a dm_group with the given name exists.
     * GET /api/groups/exists/{groupName}
     */
    @GetMapping("/exists/{groupName}")
    public Map<String, Object> checkGroupExists(@PathVariable String groupName) {
        return groupService.checkGroupExists(groupName);
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

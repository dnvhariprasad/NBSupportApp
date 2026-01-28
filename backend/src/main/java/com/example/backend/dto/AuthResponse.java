package com.example.backend.dto;

import lombok.Data;
import java.util.Map;

@Data
public class AuthResponse {
    private boolean authenticated;
    private String username;
    private String repository;
    private Map<String, Object> userDetails;
    private String message;

    public static AuthResponse success(String username, String repository, Map<String, Object> userDetails) {
        AuthResponse response = new AuthResponse();
        response.setAuthenticated(true);
        response.setUsername(username);
        response.setRepository(repository);
        response.setUserDetails(userDetails);
        response.setMessage("Authentication successful");
        return response;
    }

    public static AuthResponse failure(String message) {
        AuthResponse response = new AuthResponse();
        response.setAuthenticated(false);
        response.setMessage(message);
        return response;
    }
}

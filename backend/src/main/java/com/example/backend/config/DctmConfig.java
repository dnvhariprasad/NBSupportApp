package com.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Configuration
@ConfigurationProperties(prefix = "dctm.rest")
@Data
public class DctmConfig {
    private String url;
    private String repository;
    private String username;
    private String password;

    // Privileged service account for elevated operations
    private String serviceUsername;
    private String servicePassword;
}

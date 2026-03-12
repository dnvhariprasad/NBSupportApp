package com.example.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import lombok.Data;

@Configuration
@ConfigurationProperties(prefix = "otds")
@Data
public class OtdsConfig {
    private String url;
    private String username;
    private String password;
}

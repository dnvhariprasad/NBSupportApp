package com.example.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Configuration
public class WebConfig {

    private static final List<String> ALLOWED_ORIGINS = List.of(
            "http://localhost:5173",
            "http://localhost:5174"
    );

    @Bean
    public OncePerRequestFilter corsHeaderFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain chain)
                    throws IOException, ServletException {

                String origin = request.getHeader("Origin");
                if (origin != null && ALLOWED_ORIGINS.contains(origin)) {
                    response.setHeader("Access-Control-Allow-Origin", origin);
                    response.setHeader("Access-Control-Allow-Credentials", "true");
                    response.setHeader("Access-Control-Allow-Methods",
                            "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                    response.setHeader("Access-Control-Allow-Headers",
                            "Content-Type, Authorization, X-Requested-With, X-Method-Override, Accept");
                    response.setHeader("Access-Control-Max-Age", "3600");
                }

                // Short-circuit preflight — no further processing needed
                if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    response.setStatus(HttpServletResponse.SC_OK);
                    return;
                }

                chain.doFilter(request, response);
            }
        };
    }
}

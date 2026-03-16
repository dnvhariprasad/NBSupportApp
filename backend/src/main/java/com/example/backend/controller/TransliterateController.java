package com.example.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * Proxies Google Input Tools transliteration API to avoid browser CORS issues.
 * Supports English → Hindi (Devanagari) transliteration.
 * Each word is transliterated individually so single letters (e.g. "S", "A")
 * resolve correctly (एस, ए) instead of becoming bare vowel modifiers.
 * No API key required.
 */
@RestController
@RequestMapping("/api/transliterate")
public class TransliterateController {

    private static final Logger log = LoggerFactory.getLogger(TransliterateController.class);

    private static final String GOOGLE_INPUT_TOOLS_URL =
            "https://inputtools.google.com/request?text={text}&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage";

    /** Hindi letter-name equivalents for single English alphabet characters (initials). */
    private static final Map<String, String> LETTER_NAMES = Map.ofEntries(
        entry("A","ए"),  entry("B","बी"), entry("C","सी"), entry("D","डी"),
        entry("E","ई"),  entry("F","एफ"), entry("G","जी"), entry("H","एच"),
        entry("I","आई"), entry("J","जे"), entry("K","के"), entry("L","एल"),
        entry("M","एम"), entry("N","एन"), entry("O","ओ"), entry("P","पी"),
        entry("Q","क्यू"),entry("R","आर"),entry("S","एस"),entry("T","टी"),
        entry("U","यू"), entry("V","वी"), entry("W","डब्ल्यू"),entry("X","एक्स"),
        entry("Y","वाय"),entry("Z","जेड")
    );

    private final RestClient restClient;

    public TransliterateController(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    /**
     * GET /api/transliterate?text=Dhinesh+S+A
     * Returns: { "result": "दिनेश एस ए" }
     *
     * Each whitespace-separated token is transliterated independently so that
     * single-letter initials produce correct Devanagari letters instead of
     * bare vowel modifiers.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> transliterate(@RequestParam String text) {
        if (text == null || text.isBlank()) {
            return ResponseEntity.ok(Map.of("result", ""));
        }
        try {
            String[] words = text.trim().split("\\s+");
            StringBuilder result = new StringBuilder();
            for (String word : words) {
                if (word.isEmpty()) continue;
                if (result.length() > 0) result.append(" ");
                result.append(transliterateWord(word));
            }
            return ResponseEntity.ok(Map.of("result", result.toString()));
        } catch (Exception e) {
            log.warn("Transliteration failed for '{}': {}", text, e.getMessage());
            return ResponseEntity.ok(Map.of("result", ""));
        }
    }

    private String transliterateWord(String word) {
        // Single-letter initials: use letter-name map for accurate Hindi rendering
        // e.g. "S" → "एस", "A" → "ए" instead of bare consonant "स" / vowel modifier "ा"
        if (word.length() == 1) {
            String hindi = LETTER_NAMES.get(word.toUpperCase());
            if (hindi != null) return hindi;
        }
        try {
            Object raw = restClient.get()
                    .uri(GOOGLE_INPUT_TOOLS_URL, word)
                    .retrieve()
                    .body(Object.class);
            String suggestion = extractSuggestion(raw);
            return suggestion.isEmpty() ? word : suggestion;
        } catch (Exception e) {
            return word; // fallback: return original word
        }
    }

    @SuppressWarnings("unchecked")
    private String extractSuggestion(Object raw) {
        try {
            List<?> root = (List<?>) raw;
            if (root == null || root.size() < 2) return "";
            List<?> matches = (List<?>) root.get(1);
            if (matches == null || matches.isEmpty()) return "";
            List<?> firstMatch = (List<?>) matches.get(0);
            if (firstMatch == null || firstMatch.size() < 2) return "";
            List<?> suggestions = (List<?>) firstMatch.get(1);
            if (suggestions == null || suggestions.isEmpty()) return "";
            return (String) suggestions.get(0);
        } catch (Exception e) {
            return "";
        }
    }
}

package com.example.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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
 * Falls back to local phonetic mapping when the Google API is unreachable (UAT/offline).
 */
@RestController
@RequestMapping("/api/transliterate")
@CrossOrigin(origins = "*")
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
            if (!suggestion.isEmpty()) return suggestion;
        } catch (Exception e) {
            log.debug("Google transliterate unavailable for '{}', using local fallback: {}", word, e.getMessage());
        }
        // Local phonetic fallback — used when Google API is unreachable (e.g. UAT/offline)
        return localTransliterate(word);
    }

    /**
     * Basic phonetic English → Hindi (Devanagari) transliteration.
     * Processes digraphs before single characters so "sh", "th", "kh", etc.
     * are handled correctly. Suitable as an offline fallback for proper nouns.
     */
    private static final String[][] PHONEME_TABLE = {
        // 2-char digraphs (must come before single-char entries)
        {"sh","श"}, {"ch","च"}, {"th","थ"}, {"ph","फ"}, {"kh","ख"},
        {"gh","ग"}, {"jh","झ"}, {"dh","ध"}, {"bh","भ"}, {"nh","ञ"},
        {"aa","आ"}, {"ee","ई"}, {"ii","इ"}, {"oo","ऊ"}, {"ai","ऐ"},
        {"au","औ"}, {"ou","ओ"},
        // Single vowels
        {"a","अ"}, {"e","ए"}, {"i","इ"}, {"o","ओ"}, {"u","उ"},
        // Single consonants
        {"k","क"}, {"g","ग"}, {"j","ज"}, {"t","त"}, {"d","द"},
        {"n","न"}, {"p","प"}, {"b","ब"}, {"m","म"}, {"y","य"},
        {"r","र"}, {"l","ल"}, {"v","व"}, {"w","व"}, {"s","स"},
        {"h","ह"}, {"f","फ"}, {"z","ज"}, {"c","क"}, {"q","क"},
    };

    private static String localTransliterate(String word) {
        String lower = word.toLowerCase();
        StringBuilder result = new StringBuilder();
        int i = 0;
        while (i < lower.length()) {
            boolean matched = false;
            for (String[] entry : PHONEME_TABLE) {
                String eng = entry[0];
                if (lower.startsWith(eng, i)) {
                    result.append(entry[1]);
                    i += eng.length();
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                result.append(lower.charAt(i));
                i++;
            }
        }
        return result.toString();
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

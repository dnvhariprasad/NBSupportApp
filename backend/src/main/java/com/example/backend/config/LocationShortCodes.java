package com.example.backend.config;

import java.util.Map;

/**
 * Location name to short code, as used in group names such as
 * {@code ecm_digidak_ro_<code>_cgm} and {@code ecm_digidak_te_<code>_cgm}.
 *
 * <p>These 35 entries mirror {@code RO_LOCATIONS} and {@code TE_LOCATIONS} in the
 * frontend's nabardMetadata.js, and every one of them corresponds to a group that
 * exists in the repository.
 *
 * <p>This lives in one place because it previously did not. RajbhashaService kept its
 * own copy which had drifted: five codes were simply wrong (Andhra Pradesh, Bihar,
 * Chhattisgarh, Odisha, Punjab) and six locations were missing altogether, including
 * all four Training Establishments. A missing entry fell through to a substring guess
 * - "Bird Kolkata" became "bi" - which produced a group name that does not exist, so
 * the Rajbhasha report returned zeros for 11 of the 35 locations while looking as
 * though it had simply found nothing.
 */
public final class LocationShortCodes {

    private LocationShortCodes() {
    }

    private static final Map<String, String> CODES = Map.ofEntries(
            // Regional Offices
            Map.entry("Andaman and Nicobar", "an"),
            Map.entry("Andhra Pradesh",      "ad"),
            Map.entry("Arunachal Pradesh",   "ar"),
            Map.entry("Assam",               "as"),
            Map.entry("Bihar",               "br"),
            Map.entry("Chhattisgarh",        "ch"),
            Map.entry("Goa",                 "ga"),
            Map.entry("Gujarat",             "gj"),
            Map.entry("Haryana",             "hr"),
            Map.entry("Himachal Pradesh",    "hp"),
            Map.entry("Jammu and Kashmir",   "jk"),
            Map.entry("Jharkhand",           "jh"),
            Map.entry("Karnataka",           "ka"),
            Map.entry("Kerala",              "kl"),
            Map.entry("Madhya Pradesh",      "mp"),
            Map.entry("Maharashtra",         "mh"),
            Map.entry("Manipur",             "mn"),
            Map.entry("Meghalaya",           "ml"),
            Map.entry("Mizoram",             "mz"),
            Map.entry("Nagaland",            "nl"),
            Map.entry("New Delhi",           "dl"),
            Map.entry("Odisha",              "or"),
            Map.entry("Punjab",              "pn"),
            Map.entry("Rajasthan",           "rj"),
            Map.entry("Sikkim",              "sk"),
            Map.entry("Tamilnadu",           "tn"),
            Map.entry("Telangana",           "tg"),
            Map.entry("Tripura",             "tr"),
            Map.entry("Uttar Pradesh",       "up"),
            Map.entry("Uttarakhand",         "uk"),
            Map.entry("West Bengal",         "wb"),
            // Training Establishments
            Map.entry("Bird Kolkata",        "bk"),
            Map.entry("Bird Lucknow",        "bl"),
            Map.entry("Bird Mangalore",      "bm"),
            Map.entry("NBSC Lucknow",        "nc"));

    /**
     * The short code for a location name.
     *
     * @throws IllegalArgumentException if the location is not known. Guessing a code
     *         from the name produces a group that does not exist, and the caller then
     *         reports zero rather than an error - which is how the drift above went
     *         unnoticed. An unknown location is a configuration problem and should say so.
     */
    public static String of(String locationName) {
        String trimmed = locationName == null ? "" : locationName.trim();
        String code = CODES.get(trimmed);
        if (code == null) {
            throw new IllegalArgumentException(
                    "No short code is configured for location '" + trimmed
                    + "'. Add it to LocationShortCodes, matching RO_LOCATIONS/TE_LOCATIONS "
                    + "in the frontend's nabardMetadata.js.");
        }
        return code;
    }

    /** As {@link #of}, but yields {@code fallback} instead of throwing. */
    public static String orDefault(String locationName, String fallback) {
        String trimmed = locationName == null ? "" : locationName.trim();
        return CODES.getOrDefault(trimmed, fallback);
    }
}

package com.example.backend.config;

import java.util.List;
import java.util.stream.Collectors;

/**
 * What counts as Region 'B', for both the Rajbhasha report and Digidak.
 *
 * <p>The same set of offices is matched three ways, which is why it kept drifting:
 *
 * <ul>
 *   <li>{@code login_region} holds a plain department code for HO, or a state for RO —
 *       Rajbhasha Grid 2 and the Digidak Inbox;</li>
 *   <li>{@code region} holds the same departments prefixed {@code HO-}, alongside three
 *       regional offices — Rajbhasha Grid 3 and the Digidak Outbox;</li>
 *   <li>{@code state_of_sender} holds the three states, for external post.</li>
 * </ul>
 *
 * <p>The department list is the single source; the {@code HO-} form is derived from it
 * rather than typed out again, so the two can no longer disagree. Before this, the list
 * appeared five times across the two services and fifteen times in the requirement
 * document, and had already lost DMDS3 in two of those copies — silently dropping that
 * department's post from Rajbhasha Grid 2 and the Digidak Inbox.
 */
public final class RegionBScope {

    private RegionBScope() {
    }

    /** States in Region 'B'. In {@code login_region} these appear for regional offices. */
    public static final List<String> STATE_NAMES = List.of("Gujarat", "Maharashtra", "Punjab");

    /** Regional offices in Region 'B', as {@code region} records them. */
    private static final List<String> RO_CODES = List.of("RO-PN", "RO-MH", "RO-GJ");

    /** Head Office departments in Region 'B'. */
    public static final List<String> DEPARTMENTS = List.of(
            "PFD", "DIT", "DOR", "SECY", "RMD", "SPD", "AD", "RAJ", "SPPID", "FD", "FSDD",
            "FSPD", "HRMD", "ID", "IDD", "LAW", "GSD", "RMSMED", "DCAS", "DDMABI", "DEAR",
            "DMFI", "DOS", "DPSP", "DSM", "DSSI", "CC", "CCD", "CPD", "CVC", "CHMNS",
            "DMDS1", "DMDS2", "DMDS3", "CISO", "DDSI", "CSDD", "CCO", "CVD");

    /** Everything {@code login_region} may hold for Region 'B': the states, then the departments. */
    public static final List<String> LOGIN_REGION_VALUES = concat(STATE_NAMES, DEPARTMENTS);

    /** Everything {@code region} may hold: the regional offices, then {@code HO-} departments. */
    public static final List<String> REGION_CODES =
            concat(RO_CODES, DEPARTMENTS.stream().map(d -> "HO-" + d).collect(Collectors.toList()));

    /** Quoted, comma-separated, ready to drop inside a DQL {@code IN (...)}. */
    public static final String LOGIN_REGIONS = quote(LOGIN_REGION_VALUES);
    public static final String REGIONS = quote(REGION_CODES);
    public static final String STATES = quote(STATE_NAMES);

    private static List<String> concat(List<String> a, List<String> b) {
        return java.util.stream.Stream.concat(a.stream(), b.stream()).collect(Collectors.toList());
    }

    private static String quote(List<String> values) {
        return values.stream().map(v -> "'" + v + "'").collect(Collectors.joining(","));
    }
}

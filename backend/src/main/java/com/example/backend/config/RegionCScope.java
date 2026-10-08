package com.example.backend.config;

/**
 * What counts as Region 'C' — the southern and eastern states — for reporting.
 *
 * <p>The Rajbhasha Grid 3 report and the Digidak Outbox filter ask the same question of
 * the same data, so they ask it with the same predicate. Each previously spelled out the
 * eighteen states and nineteen region codes inline, and the new rule tests the state list
 * twice, which would have meant six copies between them. Lists that long diverge by a
 * single entry without anyone noticing - exactly how the location short codes rotted.
 */
public final class RegionCScope {

    private RegionCScope() {
    }

    /** Offices in Region 'C', matched against {@code region} for internal post. */
    public static final String INTERNAL_REGIONS =
        "'RO-AR','RO-AD','RO-AS','RO-GA','RO-KA','RO-KL','RO-MN','RO-ML','RO-MZ','RO-NL',"
        + "'RO-OR','RO-SK','RO-TN','RO-TG','RO-TR','RO-WB','RO-JK','TE-BK','TE-BM'";

    /** States in Region 'C', matched against {@code state_of_sender} for external post. */
    public static final String STATES =
        "'Andhra Pradesh','Arunachal Pradesh','Assam','Goa','Jammu and Kashmir','Karnataka',"
        + "'Kerala','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','UT of Puducherry',"
        + "'Sikkim','Tamilnadu','Telangana','Tripura','West Bengal'";

    /** Central senders that count towards Region 'C' wherever the issuing office sits. */
    public static final String EXTERNAL_SOURCES =
        "'External-GoI','External-RBI','External-RBI-EFD'";

    /**
     * The Region 'C' test, without a leading {@code AND} and without outer brackets, so a
     * caller can place it where it needs it.
     *
     * <p>Internal post qualifies on the destination region. External post qualifies when
     * the sender's state is in {@link #STATES} and either it came from one of the central
     * sources, or the issuing office is itself outside those states — that second arm is
     * what brings in external correspondence sent into the region from outside it.
     */
    public static final String PREDICATE =
        "entry_type = 'Internal' AND region IN (" + INTERNAL_REGIONS + ")"
        + " OR (entry_type = 'External' AND state_of_sender IN (" + STATES + ")"
        + " AND (received_from IN (" + EXTERNAL_SOURCES + ")"
        + " OR login_region NOT IN (" + STATES + ")))";
}

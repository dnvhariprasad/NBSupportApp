package com.example.backend.config;

/**
 * What counts as Region 'B' for the Rajbhasha report.
 *
 * <p>Grid 2 matches the issuing office on {@code login_region}, which holds plain
 * department codes; Grid 3 matches the destination on {@code region}, which holds the
 * same departments prefixed {@code HO-} alongside three regional offices. The two lists
 * therefore differ in form but describe the same set of offices, and are kept together so
 * a department added to one is not forgotten in the other.
 *
 * <p>Named rather than written inline because the lists had already drifted: Grid 2 was
 * spelled out three times in the service and nine times in the requirement document, and
 * the service's copies had lost DMDS3 while the document's kept it, so DMDS3's post was
 * silently absent from Grid 2 Region 'B'.
 */
public final class RegionBScope {

    private RegionBScope() {
    }

    /** Departments in Region 'B', as {@code login_region} records them. Grid 2. */
    public static final String LOGIN_REGIONS =
        "'Gujarat','Maharashtra','Punjab','PFD','DIT','DOR','SECY','RMD','SPD','AD','RAJ',"
        + "'SPPID','FD','FSDD','FSPD','HRMD','ID','IDD','LAW','GSD','RMSMED','DCAS','DDMABI',"
        + "'DEAR','DMFI','DOS','DPSP','DSM','DSSI','CC','CCD','CPD','CVC','CHMNS','DMDS1',"
        + "'DMDS2','DMDS3','CISO','DDSI','CSDD','CCO','CVD'";

    /** The same offices as {@code region} records them, for destinations. Grid 3. */
    public static final String REGIONS =
        "'RO-PN','RO-MH','RO-GJ','HO-PFD','HO-DIT','HO-DOR','HO-SECY','HO-RMD','HO-SPD',"
        + "'HO-AD','HO-RAJ','HO-SPPID','HO-FD','HO-FSDD','HO-FSPD','HO-HRMD','HO-ID','HO-IDD',"
        + "'HO-LAW','HO-GSD','HO-RMSMED','HO-DCAS','HO-DDMABI','HO-DEAR','HO-DMFI','HO-DOS',"
        + "'HO-DPSP','HO-DSM','HO-DSSI','HO-CC','HO-CCD','HO-CPD','HO-CVC','HO-CHMNS',"
        + "'HO-DMDS1','HO-DMDS2','HO-DMDS3','HO-CISO','HO-DDSI','HO-CSDD','HO-CCO','HO-CVD'";

    /** States counted as Region 'B' for external post. Grid 3. */
    public static final String STATES = "'Gujarat','Maharashtra','Punjab'";
}

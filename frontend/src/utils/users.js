/**
 * Some cms_user_profile records carry only an r_object_id and a department list,
 * with no object_name and no user_login_name — 5 of CPD's 35, for instance.
 *
 * In a picker they render as blank rows: invisible but selectable, and selecting
 * one sets an empty username that no query can resolve. Drop them.
 *
 * Pickers keyed by login name should filter on `user_login_name` instead; see
 * `selectableUsers` in VerticalsPage.
 */
export const withDisplayName = (users) =>
    (users || []).filter(u => (u?.object_name || '').trim());

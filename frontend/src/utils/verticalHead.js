// Helpers for vertical-head group handling.
//
// A vertical group has a companion "head" group that names the single user who
// heads that vertical. The head group is the vertical group with `vertical_head`
// inserted after the office segment:
//
//   ecm_ho_dit_adm  ->  ecm_ho_vertical_head_dit_adm
//   ecm_tn_adm      ->  ecm_tn_vertical_head_adm
//
// A user may only be dropped from a vertical while they head it once a
// replacement head has been assigned, so both VerticalsPage (remove member) and
// EditUserProfileModal (office/department change) need this mapping.

export const VERTICAL_HEAD_MARKER = '_vertical_head_';

/** True when `groupName` is itself a vertical-head group. */
export const isVerticalHeadGroup = (groupName) =>
    typeof groupName === 'string' && groupName.includes(VERTICAL_HEAD_MARKER);

/**
 * Derive the vertical-head group name for a vertical group.
 * Returns '' when the name does not follow the `ecm_<office>_…` convention.
 */
export const getVerticalHeadGroupName = (verticalGroup) => {
    if (!verticalGroup) return '';
    if (verticalGroup.startsWith('ecm_ho_')) {
        // HO: ecm_ho_<dept>[_<suffix>] -> ecm_ho_vertical_head_<dept>[_<suffix>]
        return verticalGroup.replace('ecm_ho_', 'ecm_ho_vertical_head_');
    }
    // RO/TE: ecm_<rocode>_<rest> -> ecm_<rocode>_vertical_head_<rest>
    const match = verticalGroup.match(/^ecm_([a-z]+)_(.+)$/);
    return match ? `ecm_${match[1]}_vertical_head_${match[2]}` : '';
};

/**
 * Inverse of getVerticalHeadGroupName — recover the vertical from its head group.
 *   ecm_ho_vertical_head_dit_adm -> ecm_ho_dit_adm
 *   ecm_tn_vertical_head_adm     -> ecm_tn_adm
 */
export const getVerticalGroupFromHeadGroup = (headGroup) =>
    isVerticalHeadGroup(headGroup) ? headGroup.replace('vertical_head_', '') : '';

/**
 * The department a vertical-head group sits under.
 *   ecm_ho_vertical_head_ddsi_<vertical> -> ddsi
 *   ecm_tn_vertical_head_bid             -> bid
 * Returns null when the name does not follow the convention.
 */
export const getVerticalHeadDept = (headGroup) => {
    if (!isVerticalHeadGroup(headGroup)) return null;
    const m = headGroup.match(/^ecm_[a-z]+_vertical_head_([^_]+)/);
    return m ? m[1].toLowerCase() : null;
};

/**
 * Matches a display-name prefix that names the vertical-head group, in any of
 * the separator and casing variants present in the repository — for example
 * `ECM HO VERTICAL HEAD DDSI BPE`, `ECM-HO VERTICAL HEAD CPD-RPD`,
 * `ECM HO Vertical HEAD DDSI AIF`.
 */
const VERTICAL_HEAD_IN_LABEL = /vertical[-_\s]*head/i;

/**
 * Display name written onto a vertical-head group after reassignment.
 *
 * The convention is `<PREFIX> -<head name>`, and the prefix names the
 * **head group**, not the vertical: `ECM HO VERTICAL HEAD DDSI BPE -User4`.
 * Building it from the vertical group instead yields `ECM-HO-DDSI-BPE`, which
 * silently drops the `VERTICAL HEAD` segment and makes the head group
 * indistinguishable from the vertical it heads.
 *
 * Casing and separators vary across existing data, so a prefix that already
 * names the head group is preserved verbatim and only the name after the last
 * ` -` is replaced.
 */
export const buildVerticalHeadDisplayName = (headGroup, newHeadName, currentDisplayName) => {
    const current = currentDisplayName || '';
    const idx = current.lastIndexOf(' -');
    const inherited = (idx >= 0 ? current.slice(0, idx) : current).trim();

    // Inherit the existing prefix only when it actually names the vertical-head
    // group. Two broken forms must NOT be carried forward:
    //   ''                    — perpetuates itself as " -Someone" forever
    //   'ECM-HO-DDSI-BPE'     — built from the vertical group, so the
    //                           "VERTICAL HEAD" segment is missing
    // Both are regenerated from the head group name instead.
    const prefix = VERTICAL_HEAD_IN_LABEL.test(inherited)
        ? inherited
        : (headGroup || '').replace(/_/g, '-').toUpperCase();

    return `${prefix} -${newHeadName}`;
};

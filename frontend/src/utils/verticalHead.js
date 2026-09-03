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
 * Display name written onto a vertical-head group after reassignment, matching
 * the format VerticalsPage already writes: `ECM-HO-DIT-ADM -jdoe`.
 */
export const buildVerticalHeadDisplayName = (verticalGroup, newHeadName) =>
    `${verticalGroup.replace(/_/g, '-').toUpperCase()} -${newHeadName}`;

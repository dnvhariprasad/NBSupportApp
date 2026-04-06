import { useCallback } from 'react';
import api from '../api/axios';

const BASE = '/admin/departments';

export function useDeptAdmin() {
    const fetchGroups = useCallback(async (shortCode) => {
        const prefixes = [
            `ecm_ho_${shortCode}`,
            `ecm_ho_vertical_head_${shortCode}`,
            `ecm_digidak_ho_${shortCode}`,
        ];
        const results = await Promise.all(
            prefixes.map(prefix =>
                api.get(`${BASE}/groups`, { params: { prefix } })
                    .then(r => (Array.isArray(r.data) ? r.data : []))
                    .catch(() => [])
            )
        );
        return results.flat();
    }, []);

    const fetchUsers = useCallback(async (deptShortCode) => {
        const res = await api.get(`${BASE}/users`, { params: { deptShortCode } });
        return Array.isArray(res.data) ? res.data : [];
    }, []);

    const fetchFolder = useCallback(async (shortCode) => {
        const res = await api.get(`${BASE}/folder`, {
            params: { path: `/ECM CONFIG/Office Type/HO/${shortCode.toUpperCase()}` }
        });
        return res.data?.r_object_id ? res.data : null;
    }, []);

    const fetchGroupMembers = useCallback(async (groupName) => {
        const res = await api.get(`${BASE}/groups/${groupName}/members`);
        return res.data;
    }, []);

    const createGroup = useCallback(async (groupName) => {
        const res = await api.post(`${BASE}/groups/create`, { groupName });
        return res.data;
    }, []);

    const moveMember = useCallback(async (sourceGroup, targetGroup, memberName, memberType) => {
        const res = await api.post(`${BASE}/members/move`, {
            sourceGroup, targetGroup, memberName, memberType,
        });
        return res.data;
    }, []);

    const updateUserDept = useCallback(async (objectId, newDeptName, oldShortCode, newShortCode) => {
        const res = await api.patch(`${BASE}/users/${objectId}`, {
            newDeptName, oldShortCode, newShortCode,
        });
        return res.data;
    }, []);

    const renameFolder = useCallback(async (folderId, newName) => {
        const res = await api.patch(`${BASE}/folder/${folderId}`, { newName });
        return res.data;
    }, []);

    return {
        fetchGroups, fetchUsers, fetchFolder, fetchGroupMembers,
        createGroup, moveMember, updateUserDept, renameFolder,
    };
}

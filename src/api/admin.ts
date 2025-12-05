import {api} from '@api/client';
import {AdminGroupSummary, AdminUserSummary} from '@src/types';

type UsersResponse = {
  users?: Array<{
    id: number;
    name: string;
    email: string;
    created_at?: string | null;
  }>;
};

type GroupsResponse = {
  groups?: Array<{
    id: number;
    name: string;
    created_by?: number | null;
  }>;
};

export const fetchAdminUsers = async (): Promise<AdminUserSummary[]> => {
  const response = await api.get<UsersResponse>('/management/users');
  return (response.data?.users ?? []).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at ?? null
  }));
};

export const fetchAdminGroups = async (): Promise<AdminGroupSummary[]> => {
  const response = await api.get<GroupsResponse>('/management/groups');
  return (response.data?.groups ?? []).map(group => ({
    id: group.id,
    name: group.name,
    createdById: group.created_by ?? null
  }));
};

export const deleteAdminUser = async (userId: number) => {
  await api.delete(`/management/users/${userId}`);
};

export const deleteAdminGroup = async (groupId: number) => {
  await api.delete(`/management/groups/${groupId}`);
};

import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '@navigation/RootNavigator';
import {Group} from '@src/types';
import {api} from '@api/client';
import {useAuth} from '@hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Groups'>;

type GroupsResponse = {
  groups?: Array<{
    group_id: number;
    group_name: string;
    created_by_id?: number | null;
    created_by_name?: string | null;
    members?: Array<{
      user_id: number;
      user_name: string;
    }>;
  }>;
};

const GroupsScreen: React.FC<Props> = ({navigation}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const {logout, isAdmin} = useAuth();

  const loadGroups = useCallback(async () => {
    try {
      const response = await api.get<GroupsResponse>('/groups');
      const normalized: Group[] = (response.data?.groups ?? []).map(group => ({
        id: group.group_id,
        name: group.group_name,
        createdById: group.created_by_id ?? null,
        createdByName: group.created_by_name ?? null,
        members: (group.members ?? []).map(member => ({
          user_id: member.user_id,
          user_name: member.user_name
        }))
      }));
      setGroups(normalized);
    } catch {
      setGroups([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      await loadGroups();
    } finally {
      setLoading(false);
    }
  }, [loadGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGroups();
    } finally {
      setRefreshing(false);
    }
  }, [loadGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups])
  );

  const openCreateModal = useCallback(() => {
    setNewGroupName('');
    setCreateError(null);
    setCreateModalVisible(true);
  }, []);

  const goToAdmin = useCallback(() => {
    navigation.navigate('AdminDashboard');
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActionsRow}>
          {isAdmin ? (
            <TouchableOpacity style={styles.headerAdminButton} onPress={goToAdmin}>
              <Text style={styles.headerAdminLabel}>Admin</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.headerCreateButton} onPress={openCreateModal}>
            <Text style={styles.headerCreateLabel}>Create group</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutButton}>Log out</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, logout, openCreateModal, isAdmin, goToAdmin]);

  const closeCreateModal = useCallback(() => {
    if (createLoading) {
      return;
    }
    setCreateModalVisible(false);
    setNewGroupName('');
    setCreateError(null);
  }, [createLoading]);

  const handleCreateGroup = useCallback(async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setCreateError('Please provide a group name.');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await api.post('/groups', {name: trimmed});
      setCreateModalVisible(false);
      setNewGroupName('');
      setCreateError(null);
      await loadGroups();
    } catch (error) {
      setCreateError('Unable to create group right now.');
    } finally {
      setCreateLoading(false);
    }
  }, [loadGroups, newGroupName]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={groups}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('GroupDetail', {
                groupId: item.id,
                name: item.name,
                members: item.members,
                createdById: item.createdById ?? null
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            {item.createdByName ? <Text style={styles.creator}>Created by {item.createdByName}</Text> : null}
            {item.members && item.members.length > 0 ? (
              <Text style={styles.members}>
                {item.members.length} member{item.members.length === 1 ? '' : 's'}
              </Text>
            ) : (
              <Text style={styles.members}>No members yet.</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No groups yet. Create one to get started.</Text>
          </View>
        }
      />

      <Modal
        visible={createModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a New Group</Text>
            <Text style={styles.modalFieldLabel}>Group name</Text>
            <TextInput
              value={newGroupName}
              onChangeText={text => {
                setNewGroupName(text);
                setCreateError(null);
              }}
              placeholder="e.g. Goa Trip"
              style={styles.modalInput}
            />
            {createError ? <Text style={styles.modalErrorText}>{createError}</Text> : null}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalAction, styles.modalActionCancel]}
                onPress={closeCreateModal}
                disabled={createLoading}
              >
                <Text style={[styles.modalActionLabel, styles.modalActionCancelLabel]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAction, createLoading ? styles.modalActionDisabled : null]}
                onPress={handleCreateGroup}
                disabled={createLoading}
              >
                <Text style={styles.modalActionLabel}>{createLoading ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e0e7ff'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e7ff'
  },
  listContent: {
    padding: 20,
    paddingBottom: 40
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#2563eb',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.2
  },
  creator: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600'
  },
  members: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8
  },
  headerAdminButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    shadowColor: '#1e293b',
    shadowOpacity: 0.15,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4
  },
  headerAdminLabel: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15
  },
  headerCreateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1d4ed8',
    borderRadius: 16,
    shadowColor: '#1e293b',
    shadowOpacity: 0.15,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4
  },
  headerCreateLabel: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2563eb',
    color: '#f9fafb',
    borderRadius: 16,
    fontWeight: '700',
    fontSize: 15,
    shadowColor: '#1e293b',
    shadowOpacity: 0.15,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 24
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#1e293b',
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 16,
    elevation: 6
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16
  },
  modalFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: 'rgba(248, 250, 252, 0.92)'
  },
  modalErrorText: {
    marginTop: 10,
    color: '#b91c1c',
    fontWeight: '600'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20
  },
  modalAction: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: '#1e293b',
    shadowOpacity: 0.15,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4
  },
  modalActionCancel: {
    backgroundColor: 'rgba(226, 232, 240, 0.9)'
  },
  modalActionDisabled: {
    backgroundColor: '#93c5fd'
  },
  modalActionLabel: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  modalActionCancelLabel: {
    color: '#0f172a'
  },
  modalActionCancelLabel: {
    color: '#0f172a'
  }
});

export default GroupsScreen;

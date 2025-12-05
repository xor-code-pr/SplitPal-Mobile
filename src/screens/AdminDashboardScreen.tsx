import React, {useCallback, useState} from 'react';
import {AxiosError} from 'axios';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '@navigation/RootNavigator';
import {AdminGroupSummary, AdminUserSummary} from '@src/types';
import {
  deleteAdminGroup,
  deleteAdminUser,
  fetchAdminGroups,
  fetchAdminUsers
} from '@api/admin';
import {useAuth} from '@hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

const AdminDashboardScreen: React.FC<Props> = () => {
  const {userId} = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolveErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      const axiosError = error as AxiosError<any>;
      const responseData = axiosError.response?.data;
      if (responseData) {
        if (typeof responseData === 'string') {
          return responseData;
        }
        if (typeof responseData === 'object') {
          const message = (responseData as Record<string, any>).error || (responseData as Record<string, any>).message;
          if (typeof message === 'string' && message.trim().length > 0) {
            return message;
          }
        }
      }
    }
    return fallback;
  }, []);

  const loadAdminData = useCallback(async () => {
    const [userList, groupList] = await Promise.all([fetchAdminUsers(), fetchAdminGroups()]);
    setUsers(userList);
    setGroups(groupList);
  }, []);

  const initialize = useCallback(async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await loadAdminData();
    } catch (error) {
      setErrorMessage('Unable to load admin data. Pull to refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [loadAdminData]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [initialize])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setErrorMessage(null);
    try {
      await loadAdminData();
    } catch (error) {
      setErrorMessage('Unable to load admin data. Pull to refresh to try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadAdminData]);

  const confirmDeleteUser = useCallback(
    (id: number) => {
      if (id === userId) {
        Alert.alert('Action not allowed', 'You cannot delete your own admin account.');
        return;
      }

      const runDeletion = async () => {
        setErrorMessage(null);
        setDeletingUserId(id);
        try {
          await deleteAdminUser(id);
          await loadAdminData();
        } catch (error) {
          const message = resolveErrorMessage(error, 'Could not delete the user. Try again later.');
          Alert.alert('Delete failed', message);
        } finally {
          setDeletingUserId(null);
        }
      };

      if (Platform.OS === 'web') {
        const confirmFn = (globalThis as {confirm?: (message?: string) => boolean}).confirm;
        if (typeof confirmFn === 'function') {
          const shouldDelete = confirmFn('This will permanently remove the user and their memberships. Continue?');
          if (shouldDelete) {
            runDeletion();
          }
        }
        return;
      }

      Alert.alert('Delete user', 'This will permanently remove the user and their memberships. Continue?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            runDeletion();
          }
        }
      ]);
    },
    [userId, loadAdminData, resolveErrorMessage]
  );

  const confirmDeleteGroup = useCallback(
    (id: number) => {
      const runDeletion = async () => {
        setErrorMessage(null);
        setDeletingGroupId(id);
        try {
          await deleteAdminGroup(id);
          await loadAdminData();
        } catch (error) {
          const message = resolveErrorMessage(error, 'Could not delete the group. Try again later.');
          Alert.alert('Delete failed', message);
        } finally {
          setDeletingGroupId(null);
        }
      };

      if (Platform.OS === 'web') {
        const confirmFn = (globalThis as {confirm?: (message?: string) => boolean}).confirm;
        if (typeof confirmFn === 'function') {
          const shouldDelete = confirmFn('Deleting a group removes all members and transactions. Continue?');
          if (shouldDelete) {
            runDeletion();
          }
        }
        return;
      }

      Alert.alert('Delete group', 'Deleting a group removes all members and transactions. Continue?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            runDeletion();
          }
        }
      ]);
    },
    [loadAdminData, resolveErrorMessage]
  );

  const renderJoinedLabel = useCallback((value: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return `Joined ${parsed.toLocaleDateString()}`;
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All users</Text>
        {users.length === 0 ? (
          <Text style={styles.emptyText}>No users found.</Text>
        ) : (
          users.map(user => {
            const joinedLabel = renderJoinedLabel(user.createdAt);
            const isDeleting = deletingUserId === user.id;
            return (
              <View key={user.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{user.name}</Text>
                  <Text style={styles.cardSubtitle}>{user.email}</Text>
                  {joinedLabel ? <Text style={styles.cardMeta}>{joinedLabel}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.deleteButton, isDeleting ? styles.disabledButton : null]}
                  onPress={() => confirmDeleteUser(user.id)}
                  disabled={isDeleting}
                >
                  <Text style={styles.deleteButtonLabel}>{isDeleting ? 'Deleting...' : 'Delete user'}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All groups</Text>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>No groups found.</Text>
        ) : (
          groups.map(group => {
            const isDeleting = deletingGroupId === group.id;
            return (
              <View key={group.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{group.name}</Text>
                  <Text style={styles.cardMeta}>Group ID {group.id}</Text>
                  {group.createdById ? (
                    <Text style={styles.cardMeta}>Creator user ID {group.createdById}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.deleteButton, isDeleting ? styles.disabledButton : null]}
                  onPress={() => confirmDeleteGroup(group.id)}
                  disabled={isDeleting}
                >
                  <Text style={styles.deleteButtonLabel}>{isDeleting ? 'Deleting...' : 'Delete group'}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e0e7ff'
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 32
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e7ff'
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#1e293b',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 12,
    elevation: 4,
    gap: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600'
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16
  },
  cardContent: {
    flexShrink: 1,
    gap: 4
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  cardSubtitle: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '600'
  },
  cardMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  deleteButton: {
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#991b1b',
    shadowOpacity: 0.15,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4
  },
  disabledButton: {
    backgroundColor: '#f87171'
  },
  deleteButtonLabel: {
    color: '#fff7f7',
    fontWeight: '700'
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 14
  }
});

export default AdminDashboardScreen;

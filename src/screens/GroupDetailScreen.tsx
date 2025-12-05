import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import axios from 'axios';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '@navigation/RootNavigator';
import {GroupMember, Transaction} from '@src/types';
import {api} from '@api/client';
import {useAuth} from '@hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

type TransactionsResponse = {
  transactions?: Transaction[];
};

type BalanceResponseRow = {
  user_id?: number;
  user_name?: string | null;
  balance: string;
};

type BalancesResponse = {
  balances?: BalanceResponseRow[];
};

type LookupUser = {
  id: number;
  name?: string | null;
  email: string;
};

type LookupResponse = {
  users?: LookupUser[];
};

type TransactionRowSplit = {
  userName: string;
  shareAmount: number;
  sharePercent: number;
};

type TransactionRow = {
  id: number;
  title: string;
  amount: number;
  note?: string | null;
  payerName?: string | null;
  createdAt?: string | null;
  createdById: number | null;
  createdByName: string | null;
  splits: TransactionRowSplit[];
};

type BalanceRow = {
  id: string;
  name: string;
  balance: number;
  userId?: number | null;
};

type UserImpactTone = 'owed' | 'owes' | 'settled' | 'info';

type UserImpactSummary = {
  message: string;
  tone: UserImpactTone;
};

const normalizeName = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? '';

const formatCurrency = (amount: number): string => `₹${amount.toFixed(2)}`;

const buildUserImpactSummary = (transaction: TransactionRow, currentUserName: string | null | undefined): UserImpactSummary | null => {
  const normalizedUser = normalizeName(currentUserName);
  if (!normalizedUser) {
    return null;
  }

  const payerNormalized = normalizeName(transaction.payerName);
  const userSplit = transaction.splits.find(split => normalizeName(split.userName) === normalizedUser);

  if (!userSplit) {
    return {
      message: 'This expense does not include you.',
      tone: 'info'
    };
  }

  if (payerNormalized === normalizedUser) {
    const net = transaction.amount - userSplit.shareAmount;
    if (net > 0.009) {
      return {
        message: `You are owed ${formatCurrency(net)} for this expense.`,
        tone: 'owed'
      };
    }
    if (net < -0.009) {
      return {
        message: `You owe ${formatCurrency(Math.abs(net))} on this expense.`,
        tone: 'owes'
      };
    }
    return {
      message: 'You are settled on this expense.',
      tone: 'settled'
    };
  }

  const owed = userSplit.shareAmount;
  if (owed > 0.009) {
    return {
      message: `You owe ${formatCurrency(owed)} on this expense.`,
      tone: 'owes'
    };
  }

  return {
    message: 'You are settled on this expense.',
    tone: 'settled'
  };
};

const parseAmount = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildBalanceId = (row: BalanceResponseRow, index: number): string => {
  if (typeof row.user_id === 'number') {
    return `user-${row.user_id}`;
  }
  if (row.user_name) {
    return `name-${row.user_name}-${index}`;
  }
  return `balance-${index}`;
};

const GroupDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const touchHitSlop = {top: 8, bottom: 8, left: 8, right: 8};
  const {groupId, name, members = [], createdById = null} = route.params;
  const {userName: currentUserName, userId: currentUserId, isAdmin} = useAuth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(members);
  const [loading, setLoading] = useState(true);
  const [balanceMap, setBalanceMap] = useState<Record<number, number>>({});
  const [inviteQuery, setInviteQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<LookupUser[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteSubmittingId, setInviteSubmittingId] = useState<number | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<number | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreator = createdById !== null && currentUserId !== null && createdById === currentUserId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const transactionsPromise = api
        .get<TransactionsResponse>(`/groups/${groupId}/transactions`)
        .then(res => res.data?.transactions ?? [])
        .catch(() => [] as Transaction[]);
      const balancesPromise = api
        .get<BalancesResponse>(`/groups/${groupId}/balances`)
        .then(res => res.data?.balances ?? [])
        .catch(() => [] as BalanceResponseRow[]);

      const [transactionsData, balancesData] = await Promise.all([transactionsPromise, balancesPromise]);

      setTransactions(
        transactionsData.map(tx => {
          const amount = parseAmount(tx.amount);
          const splits = (tx.splits ?? []).map(split => {
            const shareAmount = parseAmount(split.share_amount);
            const rawPercent = amount > 0 ? (shareAmount / amount) * 100 : 0;
            return {
              userName: split.user_name ?? 'Unknown',
              shareAmount,
              sharePercent: Number(rawPercent.toFixed(2))
            };
          });

          return {
            id: tx.transaction_id,
            title: tx.title,
            amount,
            note: tx.note ?? null,
            payerName: tx.payer_user_name ?? null,
            createdAt: tx.created_at ?? null,
            createdById:
              typeof tx.created_by_user_id === 'number'
                ? tx.created_by_user_id
                : tx.created_by_user_id !== null && tx.created_by_user_id !== undefined
                ? Number(tx.created_by_user_id)
                : null,
            createdByName: tx.created_by_user_name ?? null,
            splits
          };
        })
      );

      const mappedBalances = balancesData.map((row, index) => ({
        id: buildBalanceId(row, index),
        name: row.user_name ?? `User ${row.user_id ?? index + 1}`,
        balance: parseAmount(row.balance),
        userId: typeof row.user_id === 'number' ? row.user_id : null
      }));
      setBalances(mappedBalances);
      const nextBalanceMap: Record<number, number> = {};
      balancesData.forEach(row => {
        if (typeof row.user_id === 'number') {
          nextBalanceMap[row.user_id] = parseAmount(row.balance);
        }
      });
      setBalanceMap(nextBalanceMap);

      setGroupMembers(prev => {
        if (prev.length === 0 && members.length > 0) {
          return members;
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, members]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRemoveMember = useCallback(
    async (member: GroupMember) => {
      const balanceValue = balanceMap[member.user_id] ?? 0;
      if (Math.abs(balanceValue) > 0.009) {
        Alert.alert(
          'Cannot remove member',
          'This member still has an unsettled balance in the group.'
        );
        return;
      }

      setInviteError(null);
      setInviteStatus(null);
      setRemoveLoadingId(member.user_id);
      try {
        await api.delete(`/groups/${groupId}/members/${member.user_id}`);
        setGroupMembers(prev => prev.filter(m => m.user_id !== member.user_id));
        setBalanceMap(prev => {
          const next = {...prev};
          delete next[member.user_id];
          return next;
        });
        setBalances(prev => prev.filter(row => row.userId !== member.user_id));
        setInviteStatus(`${member.user_name?.trim() || 'Member'} removed from the group.`);
      } catch (error) {
        let message = 'Unable to remove this member right now.';
        if (axios.isAxiosError(error)) {
          const data = error.response?.data;
          if (typeof data === 'string') {
            message = data;
          } else if (data && typeof data === 'object' && 'message' in data) {
            message = String(data.message);
          }
        }
        Alert.alert('Remove member failed', message);
      } finally {
        setRemoveLoadingId(null);
      }
    },
    [balanceMap, groupId]
  );

  const handleInviteUser = useCallback(
    async (user: LookupUser) => {
      setInviteError(null);
      setInviteStatus(null);
      setInviteSubmittingId(user.id);
      try {
        const response = await api.post('/groups/join', {
          group_id: groupId,
          member_email: user.email
        });

        const addedMember = response.data?.member;
        const normalizedMember: GroupMember = {
          user_id: addedMember?.id ?? user.id,
          user_name: (addedMember?.name ?? user.name ?? user.email) || user.email
        };

        setGroupMembers(prev => {
          if (prev.some(member => member.user_id === normalizedMember.user_id)) {
            return prev;
          }
          return [...prev, normalizedMember];
        });

        setBalanceMap(prev => ({
          ...prev,
          [normalizedMember.user_id]: 0
        }));

        setBalances(prev => {
          if (prev.some(row => row.userId === normalizedMember.user_id)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `user-${normalizedMember.user_id}`,
              name: normalizedMember.user_name,
              balance: 0,
              userId: normalizedMember.user_id
            }
          ];
        });

        setInviteStatus(`${normalizedMember.user_name} added to the group.`);
        setInviteQuery('');
        setLookupResults([]);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const data = error.response?.data;
          if (typeof data === 'string') {
            setInviteError(data);
          } else if (data && typeof data === 'object' && 'message' in data) {
            setInviteError(String(data.message));
          } else {
            setInviteError('Unable to add this user to the group.');
          }
        } else {
          setInviteError('Unable to add this user to the group.');
        }
        setInviteStatus(null);
      } finally {
        setInviteSubmittingId(null);
      }
    },
    [groupId]
  );

  useEffect(() => {
    if (!isCreator) {
      setLookupResults([]);
      setLookupLoading(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const query = inviteQuery.trim();
    if (query.length < 2) {
      setLookupResults([]);
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    let isActive = true;
    const existingIds = new Set(groupMembers.map(member => member.user_id));

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await api.get<LookupResponse>('/users/lookup', {
          params: {q: query, limit: 6}
        });
        if (!isActive) {
          return;
        }

        const results = (response.data?.users ?? []).filter(user => !existingIds.has(user.id));
        setLookupResults(results);
        setInviteError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setInviteError('Unable to search users right now.');
        setLookupResults([]);
      } finally {
        if (isActive) {
          setLookupLoading(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [inviteQuery, isCreator, groupMembers]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{marginRight: 8}}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CreateTransaction', {
                groupId,
                name,
                members: groupMembers,
                createdById
              })
            }
            hitSlop={touchHitSlop}
            pressRetentionOffset={touchHitSlop}
          >
            <Text style={[styles.headerAction, {paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2563eb', color: '#f9fafb', borderRadius: 16, fontWeight: '700', fontSize: 15, shadowColor: '#1e293b', shadowOpacity: 0.15, shadowOffset: {width: 0, height: 2}, shadowRadius: 4}]}>Add Transaction</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, groupId, name, groupMembers, createdById]);

  const handleTransactionPress = useCallback(
    (transaction: TransactionRow) => {
      navigation.navigate('CreateTransaction', {
        groupId,
        name,
        members: groupMembers,
        createdById,
        transaction: {
          id: transaction.id,
          title: transaction.title,
          amount: transaction.amount,
          note: transaction.note ?? null,
          payerName: transaction.payerName ?? null,
          splits: transaction.splits.map(split => ({userName: split.userName, sharePercent: split.sharePercent}))
        }
      });
    },
    [groupId, groupMembers, name, navigation, createdById]
  );

  const executeTransactionDelete = useCallback(
    async (transaction: TransactionRow) => {
      setDeletingTransactionId(transaction.id);
      try {
        const response = await api.delete(`/transactions/${transaction.id}`);
        if (response.status >= 200 && response.status < 300) {
          setTransactions(prev => prev.filter(item => item.id !== transaction.id));
          await fetchData();
          return;
        }
        Alert.alert('Delete failed', 'Unexpected response from the server.');
      } catch (error) {
        let message = 'Unable to delete this transaction right now.';
        if (axios.isAxiosError(error)) {
          const data = error.response?.data;
          if (typeof data === 'string') {
            message = data;
          } else if (data && typeof data === 'object' && 'message' in data) {
            message = String(data.message);
          }
        }
        Alert.alert('Delete failed', message);
      } finally {
        setDeletingTransactionId(null);
      } 
    },
    [fetchData]
  );

  const handleDeleteTransaction = useCallback(
    (transaction: TransactionRow) => {
      if (Platform.OS === 'web') {
        const scope =
          typeof globalThis !== 'undefined'
            ? (globalThis as unknown as {confirm?: (message?: string) => boolean})
            : null;
        const confirmFn = typeof scope?.confirm === 'function' ? scope.confirm : null;
        const confirmed = confirmFn ? confirmFn('Delete transaction? This action cannot be undone.') : true;
        if (confirmed) {
          executeTransactionDelete(transaction);
        }
        return;
      }

      Alert.alert('Delete transaction?', 'This action cannot be undone.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeTransactionDelete(transaction)
        }
      ]);
    },
    [executeTransactionDelete]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="always"
      contentInsetAdjustmentBehavior="automatic"
      nestedScrollEnabled
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {groupMembers.length > 0 ? (
          <View style={styles.memberList}>
            {groupMembers.map(member => {
              const rawName = member.user_name?.trim() || `Member ${member.user_id}`;
              const balanceValue = (() => {
                if (Object.prototype.hasOwnProperty.call(balanceMap, member.user_id)) {
                  return balanceMap[member.user_id] ?? 0;
                }
                const match = balances.find(row =>
                  (typeof row.userId === 'number' && row.userId === member.user_id) ||
                  normalizeName(row.name) === normalizeName(member.user_name)
                );
                return match ? match.balance : 0;
              })();
              const isSettled = Math.abs(balanceValue) < 0.01;
              const balanceText = isSettled
                ? 'Settled'
                : balanceValue > 0
                ? `${formatCurrency(balanceValue)} owed to them`
                : `${formatCurrency(Math.abs(balanceValue))} they owe`;
              return (
                <View key={member.user_id} style={styles.memberChip}>
                  <View style={styles.memberChipHeader}>
                    <Text style={styles.memberChipText}>{rawName}</Text>
                    {isCreator && member.user_id !== currentUserId ? (
                      <TouchableOpacity
                        style={[
                          styles.removeButton,
                          (!isSettled || removeLoadingId === member.user_id) ? styles.removeButtonDisabled : null
                        ]}
                        onPress={() => handleRemoveMember(member)}
                        disabled={!isSettled || removeLoadingId === member.user_id}
                        hitSlop={touchHitSlop}
                      >
                        <Text style={styles.removeButtonLabel}>
                          {removeLoadingId === member.user_id ? 'Removing...' : 'Remove'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.memberBalanceLabel,
                      isSettled
                        ? styles.memberSettled
                        : balanceValue > 0
                        ? styles.memberOwed
                        : styles.memberOwing
                    ]}
                  >
                    {balanceText}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>No members yet.</Text>
        )}

        {isCreator ? (
          <View style={styles.inviteContainer}>
            <Text style={styles.helperText}>You are the group creator. Invite registered users by email.</Text>
            <TextInput
              value={inviteQuery}
              onChangeText={text => {
                setInviteQuery(text);
                setInviteError(null);
                setInviteStatus(null);
              }}
              placeholder="Search by email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
            {lookupLoading ? (
              <View style={styles.lookupSpinnerRow}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            ) : null}
            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            {inviteStatus ? <Text style={styles.successText}>{inviteStatus}</Text> : null}

            {lookupResults.length > 0 ? (
              <View style={styles.lookupList}>
                {lookupResults.map(user => (
                  <View key={user.id} style={styles.lookupRow}>
                    <View style={styles.lookupMeta}>
                      <Text style={styles.lookupName}>{user.name ?? 'Unnamed user'}</Text>
                      <Text style={styles.lookupEmail}>{user.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.addButton, inviteSubmittingId !== null ? styles.addButtonDisabled : null]}
                      onPress={() => handleInviteUser(user)}
                      disabled={inviteSubmittingId !== null}
                      hitSlop={touchHitSlop}
                      pressRetentionOffset={touchHitSlop}
                    >
                      <Text style={styles.addButtonLabel}>
                        {inviteSubmittingId === user.id ? 'Adding...' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            {!lookupLoading && lookupResults.length === 0 && inviteQuery.trim().length >= 2 && !inviteError ? (
              <Text style={styles.muted}>No registered users match that email.</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Balances</Text>
        {balances.length === 0 ? (
          <Text style={styles.muted}>No balances calculated yet.</Text>
        ) : (
          balances.map(row => (
            <View key={row.id} style={styles.balanceRow}>
              <Text style={styles.balanceName}>{row.name}</Text>
              <Text style={[styles.balanceAmount, row.balance < 0 ? styles.negative : styles.positive]}>
                {formatCurrency(row.balance)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        {transactions.length === 0 ? (
          <Text style={styles.muted}>No transactions yet. Add one to get started.</Text>
        ) : (
          transactions.map(tx => {
            let dateStr = '';
            if (tx.createdAt) {
              const d = new Date(tx.createdAt);
              dateStr =
                d.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}) +
                ' ' + d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
            }
            const impact = buildUserImpactSummary(tx, currentUserName);
            const canDelete = Boolean(isAdmin || (tx.createdById !== null && currentUserId === tx.createdById));

            return (
              <View key={tx.id} style={styles.transactionCard}>
                <View style={styles.txHeaderRow}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <View style={styles.txHeaderActions}>
                    {dateStr ? <Text style={styles.txDate}>{dateStr}</Text> : null}
                    <TouchableOpacity
                      style={styles.txActionButton}
                      onPress={() => handleTransactionPress(tx)}
                      hitSlop={touchHitSlop}
                      pressRetentionOffset={touchHitSlop}
                    >
                      <Text style={styles.txActionLabel}>Edit</Text>
                    </TouchableOpacity>
                    {canDelete ? (
                      <TouchableOpacity
                        style={[
                          styles.txActionButton,
                          styles.txDeleteButton,
                          deletingTransactionId === tx.id ? styles.txActionDisabled : null
                        ]}
                        onPress={() => handleDeleteTransaction(tx)}
                        disabled={deletingTransactionId === tx.id}
                        hitSlop={touchHitSlop}
                        pressRetentionOffset={touchHitSlop}
                      >
                        <Text style={styles.txDeleteLabel}>
                          {deletingTransactionId === tx.id ? 'Deleting...' : 'Delete'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.txAmount}>{formatCurrency(tx.amount)}</Text>
                {tx.note ? <Text style={styles.txNote}>{tx.note}</Text> : null}
                <Text style={styles.txMeta}>
                  {tx.payerName ? `Paid by ${tx.payerName}` : 'Paid by unknown user'}
                </Text>
                {impact ? (
                  <Text
                    style={[
                      styles.txUserImpact,
                      impact.tone === 'owed'
                        ? styles.txOwed
                        : impact.tone === 'owes'
                        ? styles.txOwing
                        : impact.tone === 'settled'
                        ? styles.txSettled
                        : styles.txInfo
                    ]}
                  >
                    {impact.message}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#e0e7ff'
  },
  container: {
    padding: 20,
    gap: 32,
    minHeight: '100%'
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#2563eb',
    shadowOpacity: 0.10,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 8,
    letterSpacing: 0.2
  },
  muted: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 8
  },
  memberList: {
    gap: 12,
    marginTop: 8
  },
  memberChip: {
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    shadowColor: '#2563eb',
    shadowOpacity: 0.05,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 6,
    elevation: 1,
    gap: 8,
    width: '100%'
  },
  memberChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  memberChipText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    marginRight: 12
  },
  memberBalanceLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  memberOwed: {
    color: '#047857'
  },
  memberOwing: {
    color: '#b91c1c'
  },
  memberSettled: {
    color: '#2563eb'
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626'
  },
  removeButtonDisabled: {
    backgroundColor: '#fca5a5'
  },
  removeButtonLabel: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  inviteContainer: {
    marginTop: 16
  },
  helperText: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'left'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    color: '#0f172a'
  },
  lookupSpinnerRow: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'left'
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'left'
  },
  lookupList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)'
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  lookupMeta: {
    flex: 1,
    marginRight: 12
  },
  lookupName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b'
  },
  lookupEmail: {
    fontSize: 13,
    color: '#64748b'
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#2563eb'
  },
  addButtonDisabled: {
    backgroundColor: '#93c5fd'
  },
  addButtonLabel: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  balanceName: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600'
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  positive: {
    color: '#047857'
  },
  negative: {
    color: '#b91c1c'
  },
  transactionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#2563eb',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
    gap: 8
  },
  txHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
    width: '100%'
  },
  txHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 'auto',
    paddingTop: 2,
    maxWidth: '100%',
    justifyContent: 'flex-end'
  },
  txDate: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8
  },
  txTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#2563eb',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: 0.2
  },
  txActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#e2e8f0'
  },
  txActionDisabled: {
    opacity: 0.6
  },
  txActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b'
  },
  txDeleteButton: {
    backgroundColor: '#fee2e2'
  },
  txDeleteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c'
  },
  txAmount: {
    fontSize: 20,
    color: '#047857',
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 2
  },
  txNote: {
    color: '#64748b',
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 2
  },
  txMeta: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2
  },
  txUserImpact: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600'
  },
  txOwed: {
    color: '#047857'
  },
  txOwing: {
    color: '#b91c1c'
  },
  txSettled: {
    color: '#2563eb'
  },
  txInfo: {
    color: '#6b7280'
  },
  headerAction: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 15
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e7ff'
  }
});

export default GroupDetailScreen;

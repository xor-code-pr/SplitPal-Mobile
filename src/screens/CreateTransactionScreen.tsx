import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import axios from 'axios';
import {MaterialIcons} from '@expo/vector-icons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/RootNavigator';
import TextField from '@components/TextField';
import PrimaryButton from '@components/PrimaryButton';
import {api} from '@api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTransaction'>;

type SplitFormRow = {
  userName: string;
  sharePercent: string;
};

const buildEqualPercentages = (count: number): string[] => {
  if (count <= 0) {
    return [];
  }
  const baseShare = Math.floor(100 / count);
  let remainder = 100 - baseShare * count;
  return Array.from({length: count}, (_value, index) => {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    remainder = remainder > 0 ? remainder - 1 : remainder;
    return String(share);
  });
};

const sanitizePercentInput = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) {
    return '0';
  }
  const numeric = Math.min(parseInt(digitsOnly, 10), 100);
  return String(numeric);
};

const normalizePercentValue = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '0';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
  return String(clamped);
};

const rebalanceSplitsToHundred = (rows: SplitFormRow[]): SplitFormRow[] => {
  if (rows.length === 0) {
    return rows;
  }

  const values = rows.map(row => {
    const numeric = Number(row.sharePercent);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
  });

  let total = values.reduce((sum, value) => sum + value, 0);
  let diff = total - 100;

  if (diff > 0) {
    let remaining = diff;
    for (let i = values.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const delta = Math.min(values[i], remaining);
      values[i] -= delta;
      remaining -= delta;
    }
  } else if (diff < 0) {
    let remaining = -diff;
    for (let i = values.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const capacity = 100 - values[i];
      if (capacity <= 0) {
        continue;
      }
      const delta = Math.min(capacity, remaining);
      values[i] += delta;
      remaining -= delta;
    }
  }

  return rows.map((row, index) => ({
    ...row,
    sharePercent: String(values[index])
  }));
};

const CreateTransactionScreen: React.FC<Props> = ({route, navigation}) => {
  const {groupId, name, members = [], transaction, createdById = null} = route.params;
  const [title, setTitle] = useState(transaction?.title ?? '');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [payerName, setPayerName] = useState(transaction?.payerName ?? '');
  const [note, setNote] = useState(transaction?.note ?? '');
  const [splits, setSplits] = useState<SplitFormRow[]>(() => {
    if (transaction && transaction.splits.length > 0) {
      return transaction.splits.map(split => ({
        userName: split.userName,
        sharePercent: normalizePercentValue(split.sharePercent)
      }));
    }
    if (members.length > 0) {
      const equalPercents = buildEqualPercentages(members.length);
      return members.map((member, index) => ({
        userName: member.user_name,
        sharePercent: normalizePercentValue(equalPercents[index])
      }));
    }
    return [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberNames = useMemo(() => members.map(member => member.user_name), [members]);
  const normalizedMemberMap = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach(member => {
      map.set(member.user_name.trim().toLowerCase(), member.user_id);
    });
    return map;
  }, [members]);

  useEffect(() => {
    if (!payerName && memberNames.length > 0) {
      setPayerName(memberNames[0]);
    }
  }, [memberNames, payerName]);

  useEffect(() => {
    if (memberNames.length === 0) {
      setSplits([]);
      return;
    }
    setSplits(current => {
      if (current.length === memberNames.length && memberNames.every((name, idx) => current[idx]?.userName === name)) {
        return current;
      }
      const existing = new Map(current.map(split => [split.userName, split.sharePercent]));
      const equalPercents = buildEqualPercentages(memberNames.length);
      const mapped = memberNames.map((memberName, index) => ({
        userName: memberName,
        sharePercent: normalizePercentValue(existing.get(memberName) ?? equalPercents[index] ?? '0')
      }));
      return rebalanceSplitsToHundred(mapped);
    });
  }, [memberNames]);

  const handleSplitPercentChange = useCallback(
    (memberName: string, rawValue: string) => {
      if (memberNames.length === 0) {
        return;
      }
      const sanitized = sanitizePercentInput(rawValue);
      const targetValue = Math.min(Number(sanitized), 100);

      setSplits(prev => {
        const valueMap = new Map<string, number>();
        memberNames.forEach(name => {
          const existing = prev.find(row => row.userName === name);
          const parsed = existing ? Number(existing.sharePercent) : undefined;
          const normalized = Number.isFinite(parsed) ? Math.round(Number(parsed)) : 0;
          valueMap.set(name, Math.max(0, Math.min(100, normalized)));
        });

        valueMap.set(memberName, targetValue);

        let sum = 0;
        valueMap.forEach(value => {
          sum += value;
        });

        let diff = sum - 100;
        const adjustable = memberNames.filter(name => name !== memberName);

        if (diff > 0) {
          let remaining = diff;
          for (let i = adjustable.length - 1; i >= 0 && remaining > 0; i -= 1) {
            const name = adjustable[i];
            const currentValue = valueMap.get(name) ?? 0;
            if (currentValue <= 0) {
              continue;
            }
            const delta = Math.min(currentValue, remaining);
            valueMap.set(name, currentValue - delta);
            remaining -= delta;
          }
          if (remaining > 0) {
            const currentValue = valueMap.get(memberName) ?? 0;
            valueMap.set(memberName, Math.max(0, currentValue - remaining));
          }
        } else if (diff < 0) {
          let remaining = -diff;
          for (let i = adjustable.length - 1; i >= 0 && remaining > 0; i -= 1) {
            const name = adjustable[i];
            const currentValue = valueMap.get(name) ?? 0;
            const capacity = 100 - currentValue;
            if (capacity <= 0) {
              continue;
            }
            const delta = Math.min(capacity, remaining);
            valueMap.set(name, currentValue + delta);
            remaining -= delta;
          }
          if (remaining > 0) {
            const currentValue = valueMap.get(memberName) ?? 0;
            const capacity = 100 - currentValue;
            const delta = Math.min(capacity, remaining);
            valueMap.set(memberName, currentValue + delta);
          }
        }

        return memberNames.map(name => ({
          userName: name,
          sharePercent: String(Math.max(0, Math.min(100, Math.round(valueMap.get(name) ?? 0))))
        }));
      });
    },
    [memberNames]
  );

  const handleSubmit = async () => {
    const amountNumber = Number(amount);
    if (!title || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      Alert.alert('Missing information', 'Title and a valid amount are required.');
      return;
    }

    const normalizedPayerName = payerName.trim().toLowerCase();
    if (!normalizedPayerName) {
      Alert.alert('Missing payer', 'Please enter the name of the person who paid.');
      return;
    }
    if (normalizedMemberMap.size > 0 && !normalizedMemberMap.has(normalizedPayerName)) {
      Alert.alert('Invalid payer', 'Please choose a payer using the exact member name.');
      return;
    }

    const cleanedSplits = splits.filter(split => split.userName.trim() && split.sharePercent.trim());
    if (cleanedSplits.length === 0) {
      Alert.alert('Missing splits', 'Add at least one member split with a percentage.');
      return;
    }

    const invalidSplit = cleanedSplits.find(split => {
      const percentValue = Number(split.sharePercent);
      const normalizedName = split.userName.trim().toLowerCase();
      const hasMember = normalizedMemberMap.size === 0 || normalizedMemberMap.has(normalizedName);
      return (
        !Number.isFinite(percentValue) ||
        !Number.isInteger(percentValue) ||
        percentValue <= 0 ||
        percentValue > 100 ||
        !hasMember ||
        !normalizedName
      );
    });
    if (invalidSplit) {
      Alert.alert('Invalid split', 'Check member names and percentages.');
      return;
    }

    const totalPercent = cleanedSplits.reduce((acc, split) => acc + Number(split.sharePercent), 0);
    if (totalPercent !== 100) {
      Alert.alert('Invalid splits', 'Split percentages must add up to 100%.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        group_id: groupId,
        title,
        amount: amountNumber,
        payer_user_name: payerName.trim(),
        note,
        splits: cleanedSplits.map(split => ({
          user_name: split.userName.trim(),
          share_percent: Number(split.sharePercent)
        }))
      };

      if (transaction) {
        await api.put(`/transactions/${transaction.id}`, payload);
        Alert.alert('Success', 'Transaction updated.');
      } else {
        await api.post(`/groups/${groupId}/transactions`, payload);
        Alert.alert('Success', 'Transaction created successfully.');
      }

      navigation.replace('GroupDetail', {
        groupId,
        name,
        members,
        createdById
      });
    } catch (error) {
      let message = 'Unable to save transaction. Please check the values and try again.';
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === 'string' && data.trim().length > 0) {
          message = data;
        } else if (data && typeof data === 'object') {
          const candidate =
            ('message' in data && typeof data.message === 'string' && data.message.trim().length > 0 && data.message) ||
            ('detail' in data && typeof data.detail === 'string' && data.detail.trim().length > 0 && data.detail);
          if (typeof candidate === 'string') {
            message = candidate;
          }
        }
      }
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.label}>Title</Text>
        <TextField value={title} onChangeText={setTitle} placeholder="Dinner" />
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Amount (INR)</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={{fontSize: 16, marginRight: 4}}>₹</Text>
          <TextField
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="120"
            style={{flex: 1}}
            selectTextOnFocus
          />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Note (optional)</Text>
        <TextField value={note} onChangeText={setNote} placeholder="Dominos" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Payer</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8}}>
          {memberNames.map(name => (
            <TouchableOpacity
              key={name}
              style={[styles.chip, payerName === name ? styles.chipSelected : null]}
              onPress={() => setPayerName(name)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            >
              <MaterialIcons name={payerName === name ? 'check-circle' : 'person'} size={18} color={payerName === name ? '#2563eb' : '#64748b'} />
              <Text style={[styles.chipText, payerName === name ? styles.chipTextSelected : null]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.splitHeader}>
          <Text style={styles.label}>Splits</Text>
        </View>
        {memberNames.map(name => {
          const split = splits.find(s => s.userName === name);
          const percentValue = split ? split.sharePercent : '0';
          const percentNumber = Math.max(0, Math.min(Number(percentValue) || 0, 100));
          return (
            <View key={name} style={styles.splitRowGraphical}>
              <View style={styles.splitRowTop}>
                <View style={styles.splitRowIdentity}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.splitLabel} numberOfLines={2} ellipsizeMode="tail">
                    {name}
                  </Text>
                </View>
                <View style={styles.splitInputContainer}>
                  <Text style={styles.percentPrefix}>%</Text>
                  <TextInput
                    value={percentValue}
                    onChangeText={value => handleSplitPercentChange(name, value)}
                    keyboardType="number-pad"
                    placeholder="0"
                    style={styles.percentField}
                    maxLength={3}
                    selectTextOnFocus
                  />
                </View>
              </View>
              <View style={styles.splitProgressRail}>
                <View style={[styles.splitProgressFill, {width: `${percentNumber}%`}]} />
              </View>
            </View>
          );
        })}
      </View>

      <PrimaryButton
        label={transaction ? 'Save changes' : 'Create transaction'}
        onPress={handleSubmit}
        loading={isSubmitting}
      />
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
    paddingBottom: 40,
    gap: 20
  },
  section: {
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1e293b',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.12)'
  },
  label: {
    fontWeight: '700',
    fontSize: 17,
    color: '#111827',
    letterSpacing: 0.3
  },
  helper: {
    color: '#6b7280',
    fontSize: 14
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  splitRowGraphical: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: 'rgba(243, 244, 246, 0.9)',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    marginBottom: 4,
    gap: 12,
    shadowColor: '#6366f1',
    shadowOpacity: 0.06,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 9,
    elevation: 2
  },
  splitRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 12
  },
  splitRowIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontWeight: '700',
    color: '#4338ca'
  },
  splitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    backgroundColor: '#ffffff',
    minWidth: 96,
    shadowColor: '#6366f1',
    shadowOpacity: 0.05,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 6,
    elevation: 1
  },
  percentPrefix: {
    fontWeight: '700',
    color: '#4f46e5',
    fontSize: 15
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(238, 242, 255, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.08,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 6,
    elevation: 1
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
    shadowOpacity: 0.18,
    elevation: 2
  },
  chipText: {
    marginLeft: 6,
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 14
  },
  chipTextSelected: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  percentField: {
    width: 52,
    minHeight: 38,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  splitLabel: {
    color: '#1f2937',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: 16
  },
  splitProgressRail: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    overflow: 'hidden'
  },
  splitProgressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4
  },
});

export default CreateTransactionScreen;

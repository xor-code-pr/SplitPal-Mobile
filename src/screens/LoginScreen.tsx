import React, {useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import axios from 'axios';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import PrimaryButton from '@components/PrimaryButton';
import TextField from '@components/TextField';
import {useAuth} from '@hooks/useAuth';
import {RootStackParamList} from '@navigation/RootNavigator';
import {API_BASE_URL} from '@api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({navigation}) => {
  const {login, isLoading} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) {
      const message = 'Please provide both email and password.';
      setAuthError(message);
      Alert.alert('Missing info', message);
      return;
    }
    try {
      setAuthError(null);
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      let message = 'Please verify your credentials and try again.';
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === 'string' && data.trim().length > 0) {
          message = data;
        } else if (data && typeof data === 'object') {
          const candidate = 'message' in data ? data.message : null;
          if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            message = candidate;
          }
        }
      }
      setAuthError(message);
      Alert.alert('Login failed', message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome back to SplitPal</Text>
        <TextField
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextField
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <PrimaryButton
          label="Sign in"
          onPress={handleSubmit}
          loading={isLoading}
        />
        {authError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Login failed</Text>
            <Text style={styles.errorMessage}>{authError}</Text>
          </View>
        ) : null}
        <View style={styles.inlineTextRow}>
          <Text style={styles.inlineText}>New to SplitPal?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#e0e7ff'
  },
  inner: {
    marginHorizontal: 24,
    padding: 24,
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    shadowColor: '#1e293b',
    shadowOpacity: 0.12,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    elevation: 3
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827'
  },
  input: {
    marginTop: 8
  },
  inlineTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  inlineText: {
    color: '#6b7280'
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600'
  },
  errorBanner: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(248, 113, 113, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220, 38, 38, 0.4)'
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
    textAlign: 'center'
  },
  errorMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#7f1d1d',
    textAlign: 'center'
  },
});

export default LoginScreen;

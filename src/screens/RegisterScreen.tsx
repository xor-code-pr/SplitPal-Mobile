import React, {useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import axios from 'axios';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import PrimaryButton from '@components/PrimaryButton';
import TextField from '@components/TextField';
import {useAuth} from '@hooks/useAuth';
import {RootStackParamList} from '@navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = ({navigation}) => {
  const {register, isLoading} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing info', 'Please fill out your name, email, and password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Your password and confirmation do not match.');
      return;
    }

    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (error) {
      let message = 'We could not create your account. Please try again.';
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
      Alert.alert('Registration failed', message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create a SplitPal account</Text>
        <TextField
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
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
        <TextField
          placeholder="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
        />
        <PrimaryButton
          label="Sign up"
          onPress={handleSubmit}
          loading={isLoading}
        />
        <View style={styles.inlineTextRow}>
          <Text style={styles.inlineText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={styles.linkText}>Back to sign in</Text>
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
  }
});

export default RegisterScreen;

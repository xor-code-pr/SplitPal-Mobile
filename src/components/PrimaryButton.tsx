import React from 'react';
import {ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text, View} from 'react-native';

interface Props {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
}

const PrimaryButton: React.FC<Props> = ({label, onPress, disabled, loading}) => {
  const isDisabled = disabled || loading;
  return (
    <View style={[styles.buttonWrapper, isDisabled && styles.wrapperDisabled]}>
      <Pressable
        style={({pressed}) => [
          styles.button,
          pressed && !isDisabled ? styles.buttonPressed : null,
          isDisabled ? styles.buttonDisabled : null
        ]}
        android_ripple={{color: 'rgba(255, 255, 255, 0.18)', borderless: false}}
        onPress={onPress}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator color="#f8fafc" />
        ) : (
          <Text style={[styles.text, isDisabled ? styles.textDisabled : null]}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.22,
    shadowOffset: {width: 0, height: 6},
    shadowRadius: 14,
    elevation: 6,
    marginVertical: 8
  },
  wrapperDisabled: {
    shadowOpacity: 0.05,
    elevation: 1
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140
  },
  buttonPressed: {
    transform: [{scale: 0.99}],
    backgroundColor: '#1d4ed8'
  },
  buttonDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.45)'
  },
  text: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  textDisabled: {
    color: '#e2e8f0'
  }
});

export default PrimaryButton;

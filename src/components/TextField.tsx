import React from 'react';
import {StyleSheet, TextInput, TextInputProps, View} from 'react-native';

const TextField: React.FC<TextInputProps> = props => {
  return (
    <View style={styles.wrapper}>
      <TextInput
        placeholderTextColor="#9ca3af"
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: 'rgba(255, 255, 255, 0.94)'
  }
});

export default TextField;

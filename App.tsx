import React from 'react';
import {ImageBackground, Platform, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {AuthProvider} from '@contexts/AuthContext';
import RootNavigator from '@navigation/RootNavigator';

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ImageBackground
          source={require('./assets/splitpal.png')}
          style={styles.background}
          resizeMode="cover"
          imageStyle={styles.backgroundImage}
          blurRadius={Platform.OS === 'ios' || Platform.OS === 'android' ? 20 : 0}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              <StatusBar barStyle="dark-content" />
              <RootNavigator />
            </View>
          </SafeAreaView>
        </ImageBackground>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#eef2ff'
  },
  backgroundImage: {
    opacity: 0.12
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(243, 244, 246, 0.45)'
  },
  content: {
    flex: 1
  }
});

export default App;

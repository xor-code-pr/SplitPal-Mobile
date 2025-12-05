import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LoginScreen from '@screens/LoginScreen';
import RegisterScreen from '@screens/RegisterScreen';
import GroupsScreen from '@screens/GroupsScreen';
import GroupDetailScreen from '@screens/GroupDetailScreen';
import CreateTransactionScreen from '@screens/CreateTransactionScreen';
import AdminDashboardScreen from '@screens/AdminDashboardScreen';
import {useAuth} from '@hooks/useAuth';
import {GroupMember} from '@src/types';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Groups: undefined;
  GroupDetail: {
    groupId: number;
    name: string;
    members?: GroupMember[];
    createdById?: number | null;
  };
  CreateTransaction: {
    groupId: number;
    name: string;
    members?: GroupMember[];
    createdById?: number | null;
    transaction?: {
      id: number;
      title: string;
      amount: number;
      note: string | null;
      payerName: string | null;
      splits: Array<{
        userName: string;
        sharePercent: number;
      }>;
    };
  };
  AdminDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const {token, isAdmin, isBootstrapping} = useAuth();

  if (isBootstrapping) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen
              name="Groups"
              component={GroupsScreen}
              options={{title: 'Groups'}}
            />
            <Stack.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={({route}) => ({title: route.params.name})}
            />
            <Stack.Screen
              name="CreateTransaction"
              component={CreateTransactionScreen}
              options={({route}) =>
                route.params.transaction
                  ? {title: 'Edit transaction'}
                  : {title: `Add to ${route.params.name}`}
              }
            />
            {isAdmin ? (
              <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{title: 'Admin'}}
              />
            ) : null}
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{title: 'Create Account'}}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;

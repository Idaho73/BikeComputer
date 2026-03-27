import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanScreen from './screens/ScanScreen';
import DashboardScreen from './screens/DashboardScreen';
import SessionScreen from './screens/SessionScreen';
import SettingsScreen from './screens/SettingsScreen';
import SensorTestScreen from './screens/SensorTestScreen';
import HistoryScreen from './screens/HistoryScreen';

export type RootStackParamList = {
  Scan: undefined;
  Dashboard: { deviceId: string; deviceName: string };
  Session: undefined;
  Settings: { deviceId: string; currentCircumference: number };
  SensorTest: { deviceId: string; circumference: number };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Session" component={SessionScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="SensorTest" component={SensorTestScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import StudentScreen from './src/screens/StudentScreen';
import DeanScreen from './src/screens/DeanScreen';
import ErrorScreen from './src/screens/ErrorScreen';

const Stack = createStackNavigator();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request permissions
      await requestPermissions();
      
      setInitializing(false);
    } catch (error) {
      console.error('App initialization error:', error);
      setInitializing(false);
    }
  };

  const requestPermissions = async () => {
    try {
      // Request location permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      // Request notification permission
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();

      if (locationStatus !== 'granted' || notificationStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'This app requires location and notification permissions to function properly. Please grant these permissions.',
          [{ text: 'OK' }]
        );
        return false;
      }

      setPermissionsGranted(true);
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(type);
  };

  const handleLogout = () => {
    setUser(null);
    setUserType(null);
  };

  if (initializing) {
    return null; // You could show a loading screen here
  }

  if (!permissionsGranted) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Error">
            {props => (
              <ErrorScreen
                {...props}
                message="This app requires location and notification permissions to function properly. Please enable them in your device settings and restart the app."
                onRetry={requestPermissions}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={handleLogin} />}
          </Stack.Screen>
        ) : userType === 'student' ? (
          <Stack.Screen name="Student">
            {props => <StudentScreen {...props} user={user} onLogout={handleLogout} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Dean">
            {props => <DeanScreen {...props} user={user} onLogout={handleLogout} />}
          </Stack.Screen>
        )}
        <Stack.Screen name="Error">
          {props => <ErrorScreen {...props} onRetry={() => setUser(null)} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

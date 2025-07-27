import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import PushNotification from 'react-native-push-notification';
import { Platform, Alert } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import StudentScreen from './src/screens/StudentScreen';
import DeanScreen from './src/screens/DeanScreen';
import ErrorScreen from './src/screens/ErrorScreen';

const Stack = createStackNavigator();

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Configure Google Sign-In
      GoogleSignin.configure({
        webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID', // From Google Console
        offlineAccess: true,
      });

      // Request permissions
      await requestPermissions();
      
      // Configure push notifications
      configurePushNotifications();

      setInitializing(false);
    } catch (error) {
      console.error('App initialization error:', error);
      setInitializing(false);
    }
  };

  const requestPermissions = async () => {
    try {
      let locationPermission;
      let notificationPermission = true;

      // Request location permission
      if (Platform.OS === 'ios') {
        locationPermission = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      } else {
        locationPermission = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      }

      // Request notification permission (iOS)
      if (Platform.OS === 'ios') {
        notificationPermission = await request(PERMISSIONS.IOS.NOTIFICATIONS);
      }

      const locationGranted = locationPermission === RESULTS.GRANTED;
      const notificationGranted = Platform.OS === 'android' || notificationPermission === RESULTS.GRANTED;

      if (!locationGranted || !notificationGranted) {
        Alert.alert(
          'Permissions Required',
          'This app requires location and notification permissions to function properly. Please grant these permissions in your device settings.',
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

  const configurePushNotifications = () => {
    PushNotification.configure({
      onNotification: function(notification) {
        console.log('NOTIFICATION:', notification);
      },
      requestPermissions: Platform.OS === 'ios',
    });

    PushNotification.createChannel(
      {
        channelId: 'attendance-channel',
        channelName: 'Attendance Notifications',
        channelDescription: 'Notifications for attendance events',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Channel created: ${created}`)
    );
  };

  const handleLogin = (userData, type) => {
    setUser(userData);
    setUserType(type);
  };

  const handleLogout = () => {
    setUser(null);
    setUserType(null);
    GoogleSignin.signOut();
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
};

export default App;

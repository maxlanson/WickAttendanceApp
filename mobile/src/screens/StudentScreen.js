import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import PushNotification from 'react-native-push-notification';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import io from 'socket.io-client';

const API_BASE_URL = 'http://172.20.10.2:3000'; // Updated to computer's IP for device testing

const StudentScreen = ({ user, onLogout }) => {
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('waiting');
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [checkInDistance, setCheckInDistance] = useState(30);

  useEffect(() => {
    // Get app configuration
    fetchConfig();
    
    // Subscribe to Socket.IO for real-time updates
    const socket = io(API_BASE_URL);

    socket.on('attendance_started', (data) => {
      if (data.grade === user.grade) {
        setAttendanceEvent(data);
        setAttendanceStatus('absent');
        
        // Show push notification
        PushNotification.localNotification({
          channelId: 'attendance-channel',
          title: 'Attendance Started',
          message: data.message,
        });
        
        // Start location tracking
        startLocationTracking();
      }
    });

    socket.on('attendance_updated', (data) => {
      if (data.studentEmail === user.email) {
        setAttendanceStatus(data.newStatus);
      }
    });

    socket.on('absent_notification', (data) => {
      if (data.students.includes(user.email)) {
        PushNotification.localNotification({
          channelId: 'attendance-channel',
          title: 'Still Absent',
          message: data.message,
        });
      }
    });

    // Check if there's an active attendance event
    checkActiveEvent();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config`);
      const config = await response.json();
      setCheckInDistance(config.checkInDistance);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const checkActiveEvent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance-data`);
      const data = await response.json();
      
      if (data.active && data.data[user.email]) {
        setAttendanceEvent(data.event);
        setAttendanceStatus(data.data[user.email].status);
        startLocationTracking();
      }
    } catch (error) {
      console.error('Failed to check active event:', error);
    }
  };

  const startLocationTracking = () => {
    const watchId = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        
        if (attendanceEvent && attendanceEvent.deanLocation) {
          const dist = calculateDistance(
            latitude,
            longitude,
            attendanceEvent.deanLocation.latitude,
            attendanceEvent.deanLocation.longitude
          );
          
          setDistance(Math.round(dist));
          setCheckInEnabled(dist <= checkInDistance && attendanceStatus !== 'present');
        }
      },
      (error) => {
        console.error('Location error:', error);
        Alert.alert('Location Error', 'Unable to get your location. Please check your location settings.');
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // Update every 5 meters
        interval: 5000, // Update every 5 seconds
      }
    );

    return () => Geolocation.clearWatch(watchId);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c * 5280; // Convert to feet
    return distance;
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Unable to determine your location. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentEmail: user.email,
          studentLocation: currentLocation,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAttendanceStatus('present');
        Alert.alert('Success', 'You have been marked as present!');
      } else {
        Alert.alert('Check-in Failed', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
    GoogleSignin.signOut();
  };

  const getStatusColor = () => {
    switch (attendanceStatus) {
      case 'present':
        return '#4caf50';
      case 'excused':
        return '#ff9800';
      case 'absent':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getStatusText = () => {
    switch (attendanceStatus) {
      case 'present':
        return 'Present';
      case 'excused':
        return 'Excused Absence';
      case 'absent':
        return 'Absent';
      default:
        return 'Waiting for attendance event';
    }
  };

  const getCheckInButtonText = () => {
    if (attendanceStatus === 'present') {
      return 'Already marked as present';
    }
    if (!checkInEnabled) {
      return 'Out of distance range';
    }
    return 'Check In';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {user.firstName}!</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Current Status:</Text>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {attendanceEvent ? (
        <View style={styles.eventContainer}>
          <Text style={styles.eventTitle}>Attendance Event Active</Text>
          
          {distance !== null && (
            <Text style={styles.distanceText}>
              Distance from dean: {distance} ft (Allowed: {checkInDistance} ft)
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.checkInButton,
              !checkInEnabled && styles.disabledButton,
              attendanceStatus === 'present' && styles.presentButton
            ]}
            onPress={handleCheckIn}
            disabled={!checkInEnabled || attendanceStatus === 'present' || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkInButtonText}>
                {getCheckInButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.instructionText}>
            {attendanceStatus === 'present'
              ? 'You are marked as present!'
              : checkInEnabled
              ? 'You are in range! Tap to check in.'
              : 'Move closer to your dean to check in.'}
          </Text>
        </View>
      ) : (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>
            You're signed in! Please wait for an attendance event.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 10,
  },
  logoutButtonText: {
    color: '#4285f4',
    fontSize: 16,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  statusIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  distanceText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  checkInButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  presentButton: {
    backgroundColor: '#2e7d32',
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  waitingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default StudentScreen;

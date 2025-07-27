import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3000'; // Change this to your computer's IP for device testing

const DeanScreen = ({ user, onLogout }) => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    // Get current location
    getCurrentLocation();
    
    // Subscribe to Socket.IO for real-time updates
    const socket = io(API_BASE_URL);

    socket.on('attendance_updated', ({ attendanceData }) => {
      setAttendanceData(Object.values(attendanceData));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Unable to get your location.');
    }
  };

  const startAttendanceEvent = async () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please wait for location to be detected.');
      return;
    }

    Alert.alert(
      'Start Attendance Event',
      'Are you sure you want to start an attendance event?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: confirmStartEvent }
      ]
    );
  };

  const confirmStartEvent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/start-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deanEmail: user.email,
          deanLocation: currentLocation,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCurrentEvent({ id: result.eventId, active: true });
        Alert.alert('Success', 'Attendance event started!');
        // Fetch initial attendance data
        fetchAttendanceData();
      } else {
        Alert.alert('Error', 'Failed to start attendance event');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not start attendance event');
    }
  };

  const endAttendanceEvent = async () => {
    Alert.alert(
      'End Attendance Event',
      'Are you sure you want to end the attendance event? A report will be sent to your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Event', onPress: confirmEndEvent }
      ]
    );
  };

  const confirmEndEvent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/end-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deanEmail: user.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCurrentEvent(null);
        setAttendanceData([]);
        Alert.alert('Success', 'Attendance event ended and report sent to your email');
      } else {
        Alert.alert('Error', 'Failed to end attendance event');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not end attendance event');
    }
  };

  const notifyAbsentStudents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notify-absent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deanEmail: user.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', `Notified ${result.notifiedCount} absent students`);
      } else {
        Alert.alert('Error', 'Failed to notify students');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not notify students');
    }
  };

  const fetchAttendanceData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance-data`);
      const data = await response.json();
      
      if (data.active && data.data) {
        setAttendanceData(Object.values(data.data));
        setCurrentEvent({ id: data.event.id, active: true });
      }
    } catch (error) {
      console.error('Failed to fetch attendance data:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
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

  const updateStudentStatus = async (studentEmail, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deanEmail: user.email,
          studentEmail,
          newStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Status Updated', 'Student status updated successfully');
        fetchAttendanceData(); // Refresh data
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update student status');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Dean {user.name}!</Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlPanel}>
        {!currentEvent ? (
          <TouchableOpacity onPress={startAttendanceEvent} style={styles.startButton}>
            <Text style={styles.buttonText}>Start Attendance Event</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={notifyAbsentStudents} style={styles.notifyButton}>
              <Text style={styles.buttonText}>Notify Absent Students</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={endAttendanceEvent} style={styles.endButton}>
              <Text style={styles.buttonText}>End Attendance Event</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {attendanceData.length > 0 && (
        <ScrollView style={styles.studentList}>
          <Text style={styles.listTitle}>Students (Grade {user.deanGrade}):</Text>
          {attendanceData.map((entry, index) => (
            <View key={index} style={[styles.studentItem, { borderLeftColor: getStatusColor(entry.status) }]}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>
                  {entry.student.name || `${entry.student.firstName} ${entry.student.lastName}`}
                </Text>
                <Text style={styles.studentStatus}>Status: {entry.status}</Text>
              </View>
              
              {entry.status !== 'present' && (
                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[styles.statusButton, styles.presentButton]}
                    onPress={() => updateStudentStatus(entry.student.email, 'present')}
                  >
                    <Text style={styles.statusButtonText}>Present</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.statusButton, styles.excusedButton]}
                    onPress={() => updateStudentStatus(entry.student.email, 'excused')}
                  >
                    <Text style={styles.statusButtonText}>Excused</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {!currentEvent && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructions}>
            Tap "Start Attendance Event" to begin taking attendance for Grade {user.deanGrade}
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
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  logoutButton: {
    padding: 10,
  },
  logoutButtonText: {
    color: '#4285f4',
    fontSize: 16,
  },
  controlPanel: {
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  notifyButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  endButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentList: {
    flex: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  studentItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  studentInfo: {
    marginBottom: 10,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  studentStatus: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 15,
    minWidth: 80,
    alignItems: 'center',
  },
  presentButton: {
    backgroundColor: '#4caf50',
  },
  excusedButton: {
    backgroundColor: '#ff9800',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default DeanScreen;

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import PushNotification from 'react-native-push-notification';
import { SwipeListView } from 'react-native-swipe-list-view';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = 'http://172.20.10.2:3000'; // Change to your backend URL

const DeanScreen = ({ user, onLogout }) => {
  const navigation = useNavigation();

  const [attendanceData, setAttendanceData] = React.useState([]);

  React.useEffect(() => {
    // Subscribe to Socket.IO for real-time updates
    const socket = io(API_BASE_URL);

    socket.on('attendance_updated', ({ attendanceData }) => {
      setAttendanceData(attendanceData);
    });

    socket.on('attendance_started', () => {
      Alert.alert('Attendance Event', 'An attendance event has started!');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLogout = () => {
    onLogout();
    GoogleSignin.signOut();
  };

  const startAttendanceEvent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/start-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deanEmail: user.email }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Attendance event started');
      } else {
        Alert.alert('Error', 'Failed to start attendance event');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not start attendance event');
    }
  };

  const endAttendanceEvent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/end-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deanEmail: user.email }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Attendance event ended and report sent to your email');
      } else {
        Alert.alert('Error', 'Failed to end attendance event');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not end attendance event');
    }
  };

  // Function to notify all absent students
  const notifyAbsentStudents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notify-absent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deanEmail: user.email }),
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

  const renderStudentItem = ({ item }) => (
    <View style={[styles.item, getStatusStyle(item)]}>
      <Text style={styles.itemText}>{`${item.student.firstName} ${item.student.lastName}`}</Text>
    </View>
  );

  const getStatusStyle = (item) => {
    switch (item.status) {
      case 'present':
        return { borderColor: 'green' };
      case 'excused':
        return { borderColor: 'yellow' };
      case 'absent':
        return { borderColor: 'red' };
      default:
        return { borderColor: 'gray' };
    }
  };

  const renderHiddenItem = ({ item }) => (
    <View style={styles.hiddenItemContainer}>
      {item.status !== 'present' && (
        <TouchableOpacity
          style={[styles.button, styles.presentButton]}
          onPress={() => updateStudentStatus(item.student.email, 'present')}
        >
          <Text style={styles.buttonText}>Mark Present</Text>
        </TouchableOpacity>
      )}
      {item.status !== 'excused' && (
        <TouchableOpacity
          style={[styles.button, styles.excusedButton]}
          onPress={() => updateStudentStatus(item.student.email, 'excused')}
        >
          <Text style={styles.buttonText}>Mark Excused</Text>
        </TouchableOpacity>
      )}
      {item.status !== 'absent' && (
        <TouchableOpacity
          style={[styles.button, styles.absentButton]}
          onPress={() => updateStudentStatus(item.student.email, 'absent')}
        >
          <Text style={styles.buttonText}>Mark Absent</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update student status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Welcome, Dean {user.firstName}</Text>
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={startAttendanceEvent} style={styles.startButton}>
        <Text style={styles.buttonText}>Start Attendance Event</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={notifyAbsentStudents} style={styles.notifyButton}>
        <Text style={styles.buttonText}>Notify Absent Students</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={endAttendanceEvent} style={styles.endButton}>
        <Text style={styles.buttonText}>End Attendance Event</Text>
      </TouchableOpacity>
      <SwipeListView
        data={attendanceData}
        renderItem={renderStudentItem}
        renderHiddenItem={renderHiddenItem}
        rightOpenValue={-180}
        disableRightSwipe
        keyExtractor={(item) => item.student.email}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  logoutButton: {
    marginRight: 'auto',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#4285f4',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 15,
    borderRadius: 5,
    marginVertical: 10,
    alignItems: 'center',
  },
  notifyButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 15,
    borderRadius: 5,
    marginVertical: 10,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#f44336',
    paddingVertical: 15,
    borderRadius: 5,
    marginVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  item: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderWidth: 2,
    marginVertical: 5,
    borderRadius: 5,
  },
  itemText: {
    fontSize: 18,
  },
  hiddenItemContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 15,
  },
  button: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  presentButton: {
    backgroundColor: 'green',
    right: 120,
  },
  excusedButton: {
    backgroundColor: 'yellow',
    right: 60,
  },
  absentButton: {
    backgroundColor: 'red',
    right: 0,
  },
});

export default DeanScreen;


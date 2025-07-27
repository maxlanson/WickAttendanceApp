import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';

const API_BASE_URL = 'http://localhost:3000'; // Change this to your computer's IP for device testing

const LoginScreen = ({ onLogin, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleSignIn = async () => {
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // For testing, we'll simulate the backend verification
      // In production, this would use real Google OAuth
      const response = await fetch(`${API_BASE_URL}/test`);
      const testData = await response.json();
      
      // Check if the entered email matches our test data
      const student = testData.students.find(s => s.email === email);
      const dean = testData.deans.find(d => d.email === email);
      
      if (student) {
        onLogin(student, 'student');
      } else if (dean) {
        onLogin(dean, 'dean');
      } else {
        navigation.navigate('Error', { 
          message: "Sorry, you don't seem to be registered in Brunswick's system. Try 'mlanson@brunswickschool.org' or 'maxjlanson@gmail.com'",
          onRetry: () => navigation.navigate('Login')
        });
      }
    } catch (error) {
      console.error('Sign-in error:', error);
      alert('Failed to connect to server. Make sure the backend is running on localhost:3000');
    } finally {
      setLoading(false);
    }
  };

  const fillTestEmail = (testEmail) => {
    setEmail(testEmail);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Brunswick School</Text>
        <Text style={styles.subtitle}>Attendance App</Text>
        
        <TextInput
          style={styles.emailInput}
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.signInButton, loading && styles.disabledButton]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.testSection}>
          <Text style={styles.testTitle}>Test Accounts:</Text>
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => fillTestEmail('mlanson@brunswickschool.org')}
          >
            <Text style={styles.testButtonText}>Student: mlanson@brunswickschool.org</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.testButton}
            onPress={() => fillTestEmail('maxjlanson@gmail.com')}
          >
            <Text style={styles.testButtonText}>Dean: maxjlanson@gmail.com</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#c5cae9',
    marginBottom: 40,
    textAlign: 'center',
  },
  emailInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: '#4285f4',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testSection: {
    alignItems: 'center',
  },
  testTitle: {
    color: '#c5cae9',
    fontSize: 16,
    marginBottom: 10,
  },
  testButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    marginBottom: 10,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default LoginScreen;

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { Parser } = require('json2csv');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// In-memory storage (in production, use a proper database)
let students = [];
let deans = [];
let currentAttendanceEvent = null;
let attendanceData = {};

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Load student/dean data from CSV
function loadDataFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        students = results.filter(person => !person.isDean);
        deans = results.filter(person => person.isDean === 'true');
        resolve({ students, deans });
      })
      .on('error', reject);
  });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 5280; // Convert to feet
  return distance;
}

// Routes

// Upload CSV file with student/dean data
app.post('/upload-data', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    await loadDataFromCSV(req.file.path);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      message: 'Data loaded successfully', 
      studentsCount: students.length,
      deansCount: deans.length 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

// Google Sign-In verification
app.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;
    
    // Check if user is a student or dean
    const student = students.find(s => s.email === email);
    const dean = deans.find(d => d.email === email);
    
    if (student) {
      res.json({ 
        success: true, 
        userType: 'student', 
        userData: student 
      });
    } else if (dean) {
      res.json({ 
        success: true, 
        userType: 'dean', 
        userData: dean 
      });
    } else {
      res.json({ 
        success: false, 
        message: "Sorry, you don't seem to be registered in Brunswick's system. Did you use your Brunswick email adress?" 
      });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Start attendance event (dean only)
app.post('/start-attendance', (req, res) => {
  const { deanEmail, deanLocation } = req.body;
  
  const dean = deans.find(d => d.email === deanEmail);
  if (!dean) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  currentAttendanceEvent = {
    id: uuidv4(),
    deanEmail,
    deanGrade: dean.grade,
    deanLocation,
    startTime: new Date(),
    active: true
  };
  
  // Initialize attendance data for all students in dean's grade
  const gradeStudents = students.filter(s => s.grade === dean.grade);
  attendanceData = {};
  
  gradeStudents.forEach(student => {
    attendanceData[student.email] = {
      status: 'absent',
      student: student,
      checkInTime: null
    };
  });
  
  // Notify all students in the grade
  io.emit('attendance_started', {
    grade: dean.grade,
    message: 'Please check in for attendance!'
  });
  
  res.json({ success: true, eventId: currentAttendanceEvent.id });
});

// End attendance event
app.post('/end-attendance', async (req, res) => {
  const { deanEmail } = req.body;
  
  if (!currentAttendanceEvent || currentAttendanceEvent.deanEmail !== deanEmail) {
    return res.status(403).json({ error: 'Unauthorized or no active event' });
  }
  
  currentAttendanceEvent.active = false;
  const finalData = { ...attendanceData };
  
  // Generate CSV
  const csvData = Object.values(finalData).map(entry => ({
    firstName: entry.student.firstName,
    lastName: entry.student.lastName,
    email: entry.student.email,
    grade: entry.student.grade,
    status: entry.status,
    checkInTime: entry.checkInTime || 'N/A'
  }));
  
  const parser = new Parser();
  const csv = parser.parse(csvData);
  
  // Send email with CSV attachment
  const dean = deans.find(d => d.email === deanEmail);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: deanEmail,
    subject: `Attendance Report - Grade ${dean.grade} - ${new Date().toLocaleDateString()}`,
    text: 'Please find the attendance report attached.',
    attachments: [{
      filename: `attendance_${dean.grade}_${Date.now()}.csv`,
      content: csv
    }]
  };
  
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, finalData: csvData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
  
  // Reset attendance data
  currentAttendanceEvent = null;
  attendanceData = {};
});

// Student check-in
app.post('/check-in', (req, res) => {
  const { studentEmail, studentLocation } = req.body;
  
  if (!currentAttendanceEvent || !currentAttendanceEvent.active) {
    return res.status(400).json({ error: 'No active attendance event' });
  }
  
  if (!attendanceData[studentEmail]) {
    return res.status(404).json({ error: 'Student not found in current event' });
  }
  
  // Check distance
  const distance = calculateDistance(
    studentLocation.latitude,
    studentLocation.longitude,
    currentAttendanceEvent.deanLocation.latitude,
    currentAttendanceEvent.deanLocation.longitude
  );
  
  const allowedDistance = parseFloat(process.env.CHECK_IN_DISTANCE || 30);
  
  if (distance > allowedDistance) {
    return res.status(400).json({ 
      error: 'Out of range', 
      distance: Math.round(distance),
      allowedDistance 
    });
  }
  
  // Update attendance
  attendanceData[studentEmail].status = 'present';
  attendanceData[studentEmail].checkInTime = new Date();
  
  // Notify dean of update
  io.emit('attendance_updated', {
    eventId: currentAttendanceEvent.id,
    studentEmail,
    newStatus: 'present',
    attendanceData
  });
  
  res.json({ success: true, status: 'present' });
});

// Update student status (dean only)
app.post('/update-status', (req, res) => {
  const { deanEmail, studentEmail, newStatus } = req.body;
  
  if (!currentAttendanceEvent || currentAttendanceEvent.deanEmail !== deanEmail) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  if (!attendanceData[studentEmail]) {
    return res.status(404).json({ error: 'Student not found' });
  }
  
  if (attendanceData[studentEmail].status === 'present') {
    return res.status(400).json({ error: 'Cannot move present students' });
  }
  
  attendanceData[studentEmail].status = newStatus;
  
  // Notify all connected clients
  io.emit('attendance_updated', {
    eventId: currentAttendanceEvent.id,
    studentEmail,
    newStatus,
    attendanceData
  });
  
  res.json({ success: true });
});

// Notify absent students
app.post('/notify-absent', (req, res) => {
  const { deanEmail } = req.body;
  
  if (!currentAttendanceEvent || currentAttendanceEvent.deanEmail !== deanEmail) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Get all absent students
  const absentStudents = Object.values(attendanceData)
    .filter(entry => entry.status === 'absent')
    .map(entry => entry.student.email);
  
  // Send notification
  io.emit('absent_notification', {
    students: absentStudents,
    message: 'You are still marked as Absent. Please check in!'
  });
  
  res.json({ success: true, notifiedCount: absentStudents.length });
});

// Get current attendance data
app.get('/attendance-data', (req, res) => {
  if (!currentAttendanceEvent) {
    return res.json({ active: false });
  }
  
  res.json({
    active: true,
    event: currentAttendanceEvent,
    data: attendanceData
  });
});

// Get configuration
app.get('/config', (req, res) => {
  res.json({
    checkInDistance: parseFloat(process.env.CHECK_IN_DISTANCE || 30)
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_event', (eventId) => {
    socket.join(eventId);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

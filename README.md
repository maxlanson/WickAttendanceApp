# Brunswick School Attendance App

A mobile attendance application for high school students and deans with location-based check-in functionality.

## Features

- **Google OAuth Authentication** - Students and deans sign in with their school email
- **Location-based Check-in** - Students can only check in when within 30 feet of their dean
- **Real-time Updates** - Live attendance status updates using Socket.IO
- **Push Notifications** - Notifications for attendance events and reminders
- **CSV Export** - Automatic attendance report generation and email delivery

## Architecture

- **Backend**: Node.js/Express with Socket.IO for real-time communication
- **Mobile App**: React Native for cross-platform iOS/Android support
- **Authentication**: Google OAuth 2.0
- **Location Services**: React Native Geolocation
- **Notifications**: React Native Push Notifications

## Setup

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   PORT=3000
   GOOGLE_CLIENT_ID=your_google_client_id_here
   EMAIL_USER=your_email@domain.com
   EMAIL_PASS=your_app_password_here
   CHECK_IN_DISTANCE=30
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

### Mobile App Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   npm install
   ```

2. Update the Google Client ID in `App.js`

3. Run the app:
   ```bash
   npm start
   ```

## Data Format

The app expects a CSV file with the following columns:
- `firstName`: Student/Dean first name
- `lastName`: Student/Dean last name  
- `email`: School email address
- `grade`: Student grade (9-12)
- `isDean`: "true" for deans, "false" for students
- `deanGrade`: Grade that the dean supervises (only for deans)

## Test Data

Current test setup includes:
- Student: Max Lanson (mlanson@brunswickschool.org, Grade 12)
- Dean: Max Lanson (maxjlanson@gmail.com, Dean of Grade 12)

## API Endpoints

- `POST /upload-data` - Upload student/dean CSV data
- `POST /verify-token` - Verify Google OAuth token
- `POST /start-attendance` - Start attendance event (dean only)
- `POST /end-attendance` - End attendance event and send report
- `POST /check-in` - Student check-in
- `POST /update-status` - Update student status (dean only)
- `POST /notify-absent` - Send notifications to absent students
- `GET /attendance-data` - Get current attendance data
- `GET /config` - Get app configuration

## Configuration

The check-in distance can be modified by changing the `CHECK_IN_DISTANCE` environment variable in the backend `.env` file without requiring an app update.

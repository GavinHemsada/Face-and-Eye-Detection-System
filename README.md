# Face-and-Eye-Detection-System
A comprehensive monitoring solution that combines computer vision, facial recognition, and eye detection to provide intelligent behavior analysis for educational, security, and productivity applications.

✨ Features
🎯 Core Detection Capabilities

Real-time Face Detection - Advanced facial recognition using OpenCV Haar Cascades
Eye Tracking & Analysis - Comprehensive eye detection with behavior analysis
Multi-modal Monitoring - Webcam, screen capture, or dual monitoring modes
Intelligent Behavior Analysis - AI-powered suspicious activity detection
Time-based Analysis - Configurable detection thresholds and timing

👁️ Advanced Eye Detection

Eye Count Detection - Tracks number of visible eyes
Eye Position Analysis - Detects looking away or sideways behavior
Closed Eye Detection - Identifies when eyes are closed or heavily squinted
Eye Ratio Calculation - Measures eye area relative to face size
Behavioral Pattern Recognition - Analyzes eye movement patterns

📊 Monitoring Features

Live Status Dashboard - Real-time monitoring interface
Automated Screenshot Capture - Evidence collection with metadata
Session Statistics - Comprehensive analytics and reporting
Configurable Settings - Customizable sensitivity and intervals
Alert History - Detailed log of all detection events

🎨 Modern UI/UX

Responsive Design - Works on desktop, tablet, and mobile
Real-time Updates - Live status indicators and notifications
Interactive Dashboard - Intuitive controls and visualizations
Dark/Light Themes - Professional appearance

🏗️ Architecture
┌─────────────────┐    HTTP/WebSocket    ┌─────────────────┐
│                 │ ◄──────────────────► │                 │
│  React Frontend │                      │ Flask Backend   │
│                 │      JSON API        │                 │
└─────────────────┘                      └─────────────────┘
         │                                        │
         │                                        │
    ┌────▼────┐                              ┌────▼────┐
    │ Webcam  │                              │ OpenCV  │
    │ Screen  │                              │ Vision  │
    │ Capture │                              │ Engine  │
    └─────────┘                              └─────────┘
🚀 Quick Start
Prerequisites

Python 3.8+
Node.js 16+
Webcam (for webcam monitoring)
Modern Browser (Chrome, Firefox, Safari, Edge)

Backend Setup

Clone the repository
bashgit clone https://github.com/yourusername/smart-monitor-pro.git
cd smart-monitor-pro

Install Python dependencies
bashpip install -r requirements.txt

Start the Flask server
bashpython app.py
Server will start on http://localhost:5000

Frontend Setup

Navigate to frontend directory
bashcd frontend

Install Node.js dependencies
bashnpm install

Start the React development server
bashnpm start
Application will open on http://localhost:3000

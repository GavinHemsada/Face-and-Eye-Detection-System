import cv2
import numpy as np
import base64
import os
from flask import Flask, request, jsonify
from PIL import Image
from io import BytesIO
import time
from flask_cors import CORS
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Create screenshots directory if it doesn't exist
if not os.path.exists('screenshots'):
    os.makedirs('screenshots')

cheat_start_time = None
cheat_threshold = 3  
last_cheat_status = "Safe"
total_detections = 0
session_screenshots = []

# Face and eye detection classifiers
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Eye detection configuration
eye_closed_threshold = 0.7  # Threshold for detecting closed eyes
no_eyes_threshold = 2.0  # Time in seconds before flagging no eyes detected

def detect_eyes_in_face(face_roi):
    """
    Detect eyes within a face region
    Returns: (eyes_detected, eye_ratio, eyes_count)
    """
    try:
        if len(face_roi.shape) == 3:
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_RGB2GRAY)
        else:
            gray_face = face_roi
            
        # Detect eyes in the face region
        eyes = eye_cascade.detectMultiScale(
            gray_face,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(10, 10),
            maxSize=(50, 50)
        )
        
        eyes_count = len(eyes)
        eyes_detected = eyes_count >= 1  # At least one eye should be visible
        
        # Calculate eye area ratio 
        eye_ratio = 0
        if eyes_count > 0:
            total_eye_area = sum([w * h for (x, y, w, h) in eyes])
            face_area = gray_face.shape[0] * gray_face.shape[1]
            eye_ratio = total_eye_area / face_area
        
        return eyes_detected, eye_ratio, eyes_count, eyes
        
    except Exception as e:
        print(f"Eye detection error: {e}")
        return False, 0, 0, []

def analyze_eye_behavior(eyes_detected, eye_ratio, eyes_count):
    """
    Analyze eye behavior for suspicious activity
    Returns: (is_suspicious, confidence, details)
    """
    suspicious = False
    confidence = 0
    details = []
    
    if not eyes_detected:
        suspicious = True
        confidence = 85
        details.append("No eyes detected - person may be looking away or eyes closed")
    elif eyes_count == 1:
        suspicious = True
        confidence = 60
        details.append("Only one eye detected - person may be looking sideways")
    elif eye_ratio < 0.003:  # Very small eye area
        suspicious = True
        confidence = 75
        details.append("Eyes appear closed or heavily squinted")
    elif eyes_count > 2:
        suspicious = True
        confidence = 70
        details.append(f"Unusual number of eyes detected ({eyes_count}) - possible multiple faces")
    
    return suspicious, confidence, details

def detect_cheat(frame_np):
    """
    Enhanced cheat detection with face and eye analysis
    Returns: status, confidence, details
    """
    global cheat_start_time, last_cheat_status, total_detections, session_screenshots
    
    try:
        gray = cv2.cvtColor(frame_np, cv2.COLOR_RGB2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30)
        )
        
        cheat_detected = False
        details = []
        confidence = 0
        eye_analysis = {}
        
        # Face-level analysis
        if len(faces) == 0:
            cheat_detected = True
            details.append("No face detected - person may have moved away")
            confidence = 80
            eye_analysis = {
                'eyes_detected': False,
                'eyes_count': 0,
                'eye_ratio': 0,
                'eye_details': ['No face detected for eye analysis']
            }
        elif len(faces) > 1:
            cheat_detected = True
            details.append(f"Multiple faces detected ({len(faces)}) - possible unauthorized person")
            confidence = 90
            # For multiple faces, analyze the largest face
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face
            face_roi = frame_np[y:y+h, x:x+w]
            eyes_detected, eye_ratio, eyes_count, eyes = detect_eyes_in_face(face_roi)
            eye_analysis = {
                'eyes_detected': eyes_detected,
                'eyes_count': eyes_count,
                'eye_ratio': eye_ratio,
                'eye_details': [f'Analysis on largest of {len(faces)} faces']
            }
        else:
            face = faces[0]
            x, y, w, h = face
            
            # Face position and size analysis
            face_area = w * h
            frame_area = frame_np.shape[0] * frame_np.shape[1]
            face_ratio = face_area / frame_area
            
            if face_ratio < 0.02:
                cheat_detected = True
                details.append("Face too small - person may be too far from camera")
                confidence = max(confidence, 70)
            
            # Check face position
            frame_center_x = frame_np.shape[1] // 2
            face_center_x = x + w // 2
            
            if abs(face_center_x - frame_center_x) > frame_np.shape[1] * 0.3:
                cheat_detected = True
                details.append("Face positioned at edge - person may be looking away")
                confidence = max(confidence, 60)
            
            # Eye detection and analysis
            face_roi = frame_np[y:y+h, x:x+w]
            eyes_detected, eye_ratio, eyes_count, eyes = detect_eyes_in_face(face_roi)
            
            # Analyze eye behavior
            eye_suspicious, eye_confidence, eye_details = analyze_eye_behavior(
                eyes_detected, eye_ratio, eyes_count
            )
            
            if eye_suspicious:
                cheat_detected = True
                confidence = max(confidence, eye_confidence)
                details.extend(eye_details)
            
            # Store eye analysis results
            eye_analysis = {
                'eyes_detected': eyes_detected,
                'eyes_count': eyes_count,
                'eye_ratio': round(eye_ratio, 6),
                'eye_details': eye_details if eye_details else ['Normal eye behavior detected'],
                'eye_positions': [{'x': int(ex), 'y': int(ey), 'w': int(ew), 'h': int(eh)} 
                                for (ex, ey, ew, eh) in eyes] if len(eyes) > 0 else []
            }
        
        now = time.time()
        current_time = datetime.now()
        
        if cheat_detected:
            if cheat_start_time is None:
                cheat_start_time = now
                return {
                    'status': 'Suspicious',
                    'confidence': confidence,
                    'details': details,
                    'duration': 0,
                    'faces_count': len(faces),
                    'eye_analysis': eye_analysis
                }
            else:
                duration = now - cheat_start_time
                if duration > cheat_threshold:
                    timestamp = current_time.strftime('%Y%m%d_%H%M%S')
                    filename = f"screenshots/cheat_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
                    
                    # Convert RGB back to BGR for OpenCV and save with eye detection overlay
                    frame_bgr = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)
                    
                    # Draw face and eye detection boxes for debugging
                    debug_frame = frame_bgr.copy()
                    for (fx, fy, fw, fh) in faces:
                        cv2.rectangle(debug_frame, (fx, fy), (fx+fw, fy+fh), (255, 0, 0), 2)
                        face_roi_bgr = debug_frame[fy:fy+fh, fx:fx+fw]
                        if len(eye_analysis.get('eye_positions', [])) > 0:
                            for eye_pos in eye_analysis['eye_positions']:
                                ex, ey, ew, eh = eye_pos['x'], eye_pos['y'], eye_pos['w'], eye_pos['h']
                                cv2.rectangle(debug_frame, (fx+ex, fy+ey), (fx+ex+ew, fy+ey+eh), (0, 255, 0), 1)
                    
                    cv2.imwrite(filename, debug_frame)
                    
                    # Store screenshot info with eye analysis
                    screenshot_info = {
                        'filename': filename,
                        'timestamp': current_time.isoformat(),
                        'details': details,
                        'confidence': confidence,
                        'faces_count': len(faces),
                        'eye_analysis': eye_analysis
                    }
                    session_screenshots.append(screenshot_info)
                    
                    total_detections += 1
                    last_cheat_status = "Cheating Detected"
                    
                    return {
                        'status': 'Cheating Detected',
                        'confidence': confidence,
                        'details': details,
                        'duration': duration,
                        'faces_count': len(faces),
                        'eye_analysis': eye_analysis,
                        'screenshot_taken': True,
                        'screenshot_path': filename
                    }
                else:
                    return {
                        'status': 'Suspicious',
                        'confidence': confidence,
                        'details': details,
                        'duration': duration,
                        'faces_count': len(faces),
                        'eye_analysis': eye_analysis
                    }
        else:
            cheat_start_time = None
            last_cheat_status = "Safe"
            
            return {
                'status': 'Safe',
                'confidence': 95,
                'details': ['Normal behavior detected'],
                'duration': 0,
                'faces_count': len(faces),
                'eye_analysis': eye_analysis
            }
            
    except Exception as e:
        return {
            'status': 'Error',
            'confidence': 0,
            'details': [f'Analysis error: {str(e)}'],
            'duration': 0,
            'faces_count': 0,
            'eye_analysis': {
                'eyes_detected': False,
                'eyes_count': 0,
                'eye_ratio': 0,
                'eye_details': ['Error in eye detection']
            }
        }

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze uploaded image for cheating behavior"""
    try:
        data = request.json
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        image_data = data['image']
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes)).convert('RGB')
        frame_np = np.array(image)
        
        result = detect_cheat(frame_np)
        
        return jsonify({
            'success': True,
            'result': result,
            'total_detections': total_detections,
            'session_screenshots': len(session_screenshots)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get current session statistics with eye detection stats"""
    return jsonify({
        'total_detections': total_detections,
        'screenshots_count': len(session_screenshots),
        'last_status': last_cheat_status,
        'screenshots': session_screenshots[-10:]  # Last 10 screenshots with eye data
    })

@app.route('/reset', methods=['POST'])
def reset_session():
    """Reset session data"""
    global cheat_start_time, last_cheat_status, total_detections, session_screenshots
    
    cheat_start_time = None
    last_cheat_status = "Safe"
    total_detections = 0
    session_screenshots = []
    
    return jsonify({
        'success': True,
        'message': 'Session reset successfully'
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'opencv_version': cv2.__version__,
        'face_cascade_loaded': face_cascade.empty() == False,
        'eye_cascade_loaded': eye_cascade.empty() == False
    })

@app.route('/config', methods=['GET', 'POST'])
def config():
    """Get or update configuration"""
    global cheat_threshold, eye_closed_threshold, no_eyes_threshold
    
    if request.method == 'GET':
        return jsonify({
            'cheat_threshold': cheat_threshold,
            'eye_closed_threshold': eye_closed_threshold,
            'no_eyes_threshold': no_eyes_threshold,
            'screenshots_dir': 'screenshots'
        })
    else:
        data = request.json
        if 'cheat_threshold' in data:
            cheat_threshold = max(1, min(10, data['cheat_threshold']))
        if 'eye_closed_threshold' in data:
            eye_closed_threshold = max(0.1, min(1.0, data['eye_closed_threshold']))
        if 'no_eyes_threshold' in data:
            no_eyes_threshold = max(1, min(5, data['no_eyes_threshold']))
        
        return jsonify({
            'success': True,
            'cheat_threshold': cheat_threshold,
            'eye_closed_threshold': eye_closed_threshold,
            'no_eyes_threshold': no_eyes_threshold
        })

if __name__ == '__main__':
    print("Starting Flask server with Eye Detection...")
    print(f"OpenCV version: {cv2.__version__}")
    print(f"Face cascade loaded: {not face_cascade.empty()}")
    print(f"Eye cascade loaded: {not eye_cascade.empty()}")
    print("Server will run on http://localhost:5000")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
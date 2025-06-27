import React, { useRef, useState, useEffect } from 'react';
import { Camera, Play, Square, AlertTriangle, CheckCircle, Eye, EyeOff, Download, Trash2, Settings, Shield, Clock, Users, Monitor, Share, CameraOff } from 'lucide-react';

const WebcamMonitor = () => {
  const webcamRef = useRef(null);
  const videoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const [status, setStatus] = useState('Ready to monitor');
  const [monitoring, setMonitoring] = useState(false);
  const [screenshots, setScreenshots] = useState([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [totalDetections, setTotalDetections] = useState(0);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isScreenReady, setIsScreenReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [captureInterval, setCaptureInterval] = useState(2);
  const [captureMode, setCaptureMode] = useState('webcam'); // 'webcam', 'screen', 'both'
  const [screenStream, setScreenStream] = useState(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);
  const [lastEyeAnalysis, setLastEyeAnalysis] = useState(null);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream, screenStream]);

  const startWebcam = async () => {
    try {
      setStatus('Starting webcam...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: false 
      });
      
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsWebcamReady(true);
        setIsWebcamOn(true);
        setStatus('Webcam ready');
      }
    } catch (err) {
      console.error('Webcam access denied:', err);
      setStatus('Webcam access denied. Please enable camera permissions.');
      setIsWebcamOn(false);
      setIsWebcamReady(false);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsWebcamReady(false);
    setIsWebcamOn(false);
    setStatus('Webcam stopped');
    
    // Stop monitoring if it was using webcam
    if (monitoring && (captureMode === 'webcam' || captureMode === 'both')) {
      stopMonitoring();
    }
  };

  const toggleWebcam = () => {
    if (isWebcamOn) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  const startScreenCapture = async () => {
    try {
      setStatus('Starting screen capture...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: false
      });
      
      setScreenStream(stream);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        setIsScreenReady(true);
        setStatus('Screen capture ready');
      }

      // Handle screen share stop
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenReady(false);
        setScreenStream(null);
        setStatus('Screen capture stopped');
        if (captureMode === 'screen' && monitoring) {
          stopMonitoring();
        }
      };
    } catch (err) {
      console.error('Screen capture failed:', err);
      setStatus('Screen capture access denied or cancelled.');
    }
  };

  const stopScreenCapture = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenReady(false);
      setStatus('Screen capture stopped');
      if (captureMode === 'screen' && monitoring) {
        stopMonitoring();
      }
    }
    
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
  };

    //Add eye detection state variables 
  const [eyeStatus, setEyeStatus] = useState({
    detected: false,
    count: 0,
    ratio: 0,
    details: []
  });

  const captureScreenshot = () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (captureMode === 'webcam' && videoRef.current && isWebcamReady) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    } else if (captureMode === 'screen' && screenVideoRef.current && isScreenReady) {
      canvas.width = screenVideoRef.current.videoWidth;
      canvas.height = screenVideoRef.current.videoHeight;
      context.drawImage(screenVideoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    } else if (captureMode === 'both' && videoRef.current && screenVideoRef.current && isWebcamReady && isScreenReady) {
      // Create a combined screenshot
      const webcamWidth = videoRef.current.videoWidth;
      const webcamHeight = videoRef.current.videoHeight;
      const screenWidth = screenVideoRef.current.videoWidth;
      const screenHeight = screenVideoRef.current.videoHeight;
      
      canvas.width = Math.max(webcamWidth, screenWidth);
      canvas.height = webcamHeight + screenHeight + 20; // 20px gap
      
      // Draw screen capture first (top)
      context.drawImage(screenVideoRef.current, 0, 0, screenWidth, screenHeight);
      
      // Draw webcam below with gap
      context.drawImage(videoRef.current, 0, screenHeight + 20, webcamWidth, webcamHeight);
      
      // Add labels
      context.fillStyle = 'white';
      context.font = '16px Arial';
      context.fillText('Screen Capture', 10, 20);
      context.fillText('Webcam', 10, screenHeight + 40);
      
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    
    return null;
  };

 const analyzeFrame = async () => {
  const imageSrc = captureScreenshot();
  if (!imageSrc) return;

  try {
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageSrc
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      const result = data.result;
      let statusText = result.status;
      
      // Update eye detection status
      if (result.eye_analysis) {
        setEyeStatus({
          detected: result.eye_analysis.eyes_detected,
          count: result.eye_analysis.eyes_count,
          ratio: result.eye_analysis.eye_ratio,
          details: result.eye_analysis.eye_details || []
        });
        setLastEyeAnalysis(result.eye_analysis);
      }
      
      // Add eye details to status if available
      if (result.eye_analysis && result.eye_analysis.eye_details.length > 0) {
        statusText += ` | Eyes: ${result.eye_analysis.eye_details[0]}`;
      }
      
      setStatus(statusText);
      
      // Enhanced screenshot data with eye analysis
      if (result.status === 'Cheating Detected' || result.status === 'Suspicious') {
        const severity = result.confidence > 80 ? 'high' : 'medium';
        
        setScreenshots(prev => [...prev, {
          id: Date.now(),
          image: imageSrc,
          timestamp: new Date().toLocaleString(),
          severity: severity,
          source: captureMode,
          confidence: result.confidence,
          details: result.details,
          facesCount: result.faces_count,
          duration: result.duration,
          // Add eye analysis data
          eyeAnalysis: result.eye_analysis
        }]);
        
        if (result.status === 'Cheating Detected') {
          setTotalDetections(prev => prev + 1);
        }
      }
      
      if (data.total_detections !== undefined) {
        setTotalDetections(data.total_detections);
      }
    } else {
      setStatus(`Analysis failed: ${data.error}`);
    }
  } catch (err) {
    console.error('Analysis error:', err);
    setStatus('Connection error - check if Flask server is running');
  }
};

  const startMonitoring = () => {
    if (captureMode === 'webcam' && !isWebcamReady) {
      setStatus('Please turn on webcam first');
      return;
    }
    if (captureMode === 'screen' && !isScreenReady) {
      setStatus('Please start screen capture first');
      return;
    }
    if (captureMode === 'both' && (!isWebcamReady || !isScreenReady)) {
      setStatus('Please enable both webcam and screen capture');
      return;
    }
    
    setMonitoring(true);
    setStatus('Monitoring active...');
    setSessionTime(0);
    
    intervalRef.current = setInterval(analyzeFrame, captureInterval * 1000);
    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
  };

  const stopMonitoring = () => {
    setMonitoring(false);
    setStatus('Monitoring stopped');
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const downloadScreenshot = (screenshot) => {
    const link = document.createElement('a');
    link.href = screenshot.image;
    link.download = `detection_${screenshot.timestamp.replace(/[\/\s:]/g, '_')}.jpg`;
    link.click();
  };

  const clearScreenshots = () => {
    setScreenshots([]);
    setTotalDetections(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    if (status.includes('Suspicious') || status.includes('Detected')) return 'text-red-500';
    if (status.includes('Monitoring') || status.includes('Normal')) return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Smart Monitor Pro</h1>
                <p className="text-slate-600">Advanced behavior analysis system</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-slate-100 hover:bg-slate-200 p-3 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Capture Mode
                </label>
                <select
                  value={captureMode}
                  onChange={(e) => setCaptureMode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="webcam">Webcam Only</option>
                  <option value="screen">Screen Only</option>
                  <option value="both">Both Webcam & Screen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Detection Sensitivity: {sensitivity}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Capture Interval: {captureInterval}s
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={captureInterval}
                  onChange={(e) => setCaptureInterval(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Monitor Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  {captureMode === 'webcam' && <Camera className="w-6 h-6 mr-2" />}
                  {captureMode === 'screen' && <Monitor className="w-6 h-6 mr-2" />}
                  {captureMode === 'both' && <Share className="w-6 h-6 mr-2" />}
                  {captureMode === 'webcam' ? 'Webcam Monitor' : 
                   captureMode === 'screen' ? 'Screen Monitor' : 'Dual Monitor'}
                </h2>
              </div>
              
              <div className="p-6">
                {/* Capture Mode Controls */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setCaptureMode('webcam')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      captureMode === 'webcam' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Camera className="w-4 h-4 inline mr-2" />
                    Webcam
                  </button>
                  <button
                    onClick={() => setCaptureMode('screen')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      captureMode === 'screen' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Monitor className="w-4 h-4 inline mr-2" />
                    Screen
                  </button>
                  <button
                    onClick={() => setCaptureMode('both')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      captureMode === 'both' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Share className="w-4 h-4 inline mr-2" />
                    Both
                  </button>
                </div>

                {/* Camera and Screen Controls */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {/* Webcam Controls */}
                  {(captureMode === 'webcam' || captureMode === 'both') && (
                    <button
                      onClick={toggleWebcam}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                        isWebcamOn
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {isWebcamOn ? (
                        <>
                          <CameraOff className="w-4 h-4 mr-2" />
                          Turn Off Camera
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Turn On Camera
                        </>
                      )}
                    </button>
                  )}
                  
                  {/* Screen Capture Controls */}
                  {(captureMode === 'screen' || captureMode === 'both') && (
                    <>
                      {!isScreenReady ? (
                        <button
                          onClick={startScreenCapture}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                        >
                          <Monitor className="w-4 h-4 mr-2" />
                          Start Screen Capture
                        </button>
                      ) : (
                        <button
                          onClick={stopScreenCapture}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop Screen Capture
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Video Display */}
                <div className={`${captureMode === 'both' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''} mb-4`}>
                  {/* Webcam Video */}
                  {(captureMode === 'webcam' || captureMode === 'both') && (
                    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                      />
                      {!isWebcamOn && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                          <div className="text-center text-white">
                            <CameraOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Camera is off</p>
                            <button
                              onClick={toggleWebcam}
                              className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                              Turn on camera
                            </button>
                          </div>
                        </div>
                      )}
                      {monitoring && isWebcamOn && captureMode !== 'screen' && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                          ● LIVE
                        </div>
                      )}
                      {captureMode === 'both' && (
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                          Webcam {isWebcamOn ? '(ON)' : '(OFF)'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Screen Video */}
                  {(captureMode === 'screen' || captureMode === 'both') && (
                    <div className="relative bg-slate-900 rounded-lg overflow-hidden">
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                      />
                      {!isScreenReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                          <div className="text-center text-white">
                            <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Screen capture not active</p>
                            <button
                              onClick={startScreenCapture}
                              className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                              Start screen capture
                            </button>
                          </div>
                        </div>
                      )}
                      {monitoring && isScreenReady && captureMode !== 'webcam' && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                          ● REC
                        </div>
                      )}
                      {captureMode === 'both' && (
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                          Screen {isScreenReady ? '(ACTIVE)' : '(INACTIVE)'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className={`text-lg font-semibold ${getStatusColor()}`}>
                    {status}
                  </div>
                  <div className="flex items-center space-x-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(sessionTime)}</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={startMonitoring}
                    disabled={monitoring || 
                      (captureMode === 'webcam' && !isWebcamReady) ||
                      (captureMode === 'screen' && !isScreenReady) ||
                      (captureMode === 'both' && (!isWebcamReady || !isScreenReady))
                    }
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Monitoring
                  </button>
                  <button
                    onClick={stopMonitoring}
                    disabled={!monitoring}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop Monitoring
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <Eye className="w-5 h-5 mr-2 text-blue-500" />
                Live Detection Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Webcam:</span>
                  <span className={`font-medium ${isWebcamOn ? 'text-green-500' : 'text-red-500'}`}>
                    {isWebcamOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Eyes Detected:</span>
                  <div className="flex items-center">
                    {eyeStatus.detected ? (
                      <Eye className="w-4 h-4 text-green-500 mr-1" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-red-500 mr-1" />
                    )}
                    <span className={`font-medium ${eyeStatus.detected ? 'text-green-500' : 'text-red-500'}`}>
                      {eyeStatus.count} eyes
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Eye Ratio:</span>
                  <span className="font-mono font-medium text-sm">
                    {eyeStatus.ratio.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Monitor Status:</span>
                  <span className={`font-medium ${getStatusColor()}`}>
                    {monitoring ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Session Time:</span>
                  <span className="font-mono font-medium">{formatTime(sessionTime)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Detections:</span>
                  <span className="font-medium text-red-500">{totalDetections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Screenshots:</span>
                  <span className="font-medium">{screenshots.length}</span>
                </div>
              </div>
              
              {/* Eye Analysis Details */}
              {eyeStatus.details.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Eye Analysis</h4>
                  <div className="space-y-1">
                    {eyeStatus.details.map((detail, index) => (
                      <p key={index} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>


            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Alert History</h3>
                {screenshots.length > 0 && (
                  <button
                    onClick={clearScreenshots}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Alerts list with horizontal scroll */}
              <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-auto">
                {screenshots.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No detections yet</p>
                ) : (
                  screenshots
                    .slice(-5)
                    .reverse()
                    .map((screenshot) => (
                      <div
                        key={screenshot.id}
                        className="flex items-center justify-between bg-slate-50 p-3 rounded-lg min-w-[500px]"
                      >
                        {/* Left column */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-800">Detection Alert</p>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {screenshot.eyeAnalysis?.eyes_detected ? (
                                <Eye className="w-3 h-3 text-green-500" />
                              ) : (
                                <EyeOff className="w-3 h-3 text-red-500" />
                              )}
                              <span className="text-xs text-slate-600">
                                {screenshot.eyeAnalysis?.eyes_count ?? 0} eyes
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{screenshot.timestamp}</p>
                          {screenshot.eyeAnalysis?.eye_details?.length > 0 && (
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              {screenshot.eyeAnalysis.eye_details[0]}
                            </p>
                          )}
                        </div>

                        {/* Severity + download */}
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              screenshot.severity === "high"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {screenshot.severity}
                          </span>
                          <button
                            onClick={() => downloadScreenshot(screenshot)}
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Screenshots Gallery */}
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="relative group">
              <img
                src={screenshot.image}
                alt={`Detection ${screenshot.id}`}
                className="w-full h-32 object-cover rounded-lg border border-slate-200 group-hover:scale-105 transition-transform cursor-pointer"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center">
                <button
                  onClick={() => downloadScreenshot(screenshot)}
                  className="opacity-0 group-hover:opacity-100 bg-white text-slate-800 p-2 rounded-full hover:bg-slate-100 transition-all"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              
              {/* Eye Detection Indicator */}
              <div className="absolute top-2 left-2">
                {screenshot.eyeAnalysis?.eyes_detected ? (
                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    {screenshot.eyeAnalysis.eyes_count}
                  </div>
                ) : (
                  <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <EyeOff className="w-3 h-3 mr-1" />
                    0
                  </div>
                )}
              </div>
              
              {/* Confidence Badge */}
              <div className="absolute top-2 right-2">
                <div className="bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {screenshot.confidence}%
                </div>
              </div>
              
              <div className="absolute bottom-2 left-2 right-2">
                <div className="bg-black bg-opacity-75 text-white text-xs p-1 rounded text-center">
                  {screenshot.timestamp.split(' ')[1]}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default WebcamMonitor;
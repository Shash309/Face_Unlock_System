import React, { useRef, useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, RotateCcw, Clock, Zap, Shield, Camera as CameraIcon } from 'lucide-react';
import { AccessStatus, LogEntry } from '../App';

interface StatusSectionProps {
  status: AccessStatus;
  recognizedName: string;
  onReset: () => void;
  onScanComplete: (success: boolean, name: string, processedImage: string | undefined) => void;
  processedImage: string | undefined;
}

const StatusSection: React.FC<StatusSectionProps> = ({ status, recognizedName, onReset, onScanComplete, processedImage }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access camera. Please ensure you have a camera connected and grant permissions.");
      onReset(); // Reset status if camera access fails
    }
  };

  const stopCamera = () => {
    if (stream) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null; // Clear the source object
      }
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (status === 'scanning') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [status]);

  const capturePhoto = async () => {
    if (videoRef.current && photoRef.current) {
      const context = photoRef.current.getContext('2d');
      if (context) {
        photoRef.current.width = videoRef.current.videoWidth;
        photoRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        const imageData = photoRef.current.toDataURL('image/jpeg');
        setCapturedImage(imageData);

        try {
          const response = await fetch('http://127.0.0.1:8000/unlock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();
          onScanComplete(result.success, result.identity, result.processed_image);
          stopCamera(); // Stop camera after processing

        } catch (error) {
          console.error("Error sending image to backend:", error);
          alert("Error processing face. Please try again.");
          onScanComplete(false, 'Error', undefined); // Indicate scan failure
          stopCamera(); // Stop camera even on error
        }
      }
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'scanning':
        return {
          icon: Loader,
          title: 'Scanning Face...',
          subtitle: 'Please look directly at the camera',
          color: 'text-cyan-400',
          bgGradient: 'from-cyan-500/20 via-blue-500/20 to-purple-500/20',
          borderGlow: 'border-cyan-500/50',
          glowColor: 'cyan-400/30',
          animation: 'animate-spin',
        };
      case 'granted':
        return {
          icon: CheckCircle,
          title: 'Access Granted',
          subtitle: `Welcome back, ${recognizedName}`,
          color: 'text-emerald-400',
          bgGradient: 'from-emerald-500/20 via-green-500/20 to-teal-500/20',
          borderGlow: 'border-emerald-500/50',
          glowColor: 'emerald-400/30',
          animation: 'animate-bounce-gentle',
        };
      case 'denied':
        return {
          icon: XCircle,
          title: 'Access Denied',
          subtitle: recognizedName === 'Unknown User' ? 'Face not recognized in database' : `Access denied for ${recognizedName}`,
          color: 'text-red-400',
          bgGradient: 'from-red-500/20 via-pink-500/20 to-rose-500/20',
          borderGlow: 'border-red-500/50',
          glowColor: 'red-400/30',
          animation: 'animate-shake',
        };
      default:
        return {
          icon: Clock,
          title: 'System Ready',
          subtitle: 'Awaiting scan initiation',
          color: 'text-gray-400',
          bgGradient: 'from-gray-500/20 via-slate-500/20 to-gray-500/20',
          borderGlow: 'border-gray-500/50',
          glowColor: 'gray-400/30',
          animation: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fade-in-up">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
          System Status
        </h2>
        <p className="text-xl text-gray-300">Real-time facial recognition feedback</p>
      </div>

      {/* Main Status Display */}
      <div className="flex justify-center">
        <div className={`relative backdrop-blur-2xl bg-gradient-to-br ${config.bgGradient} border-2 ${config.borderGlow} rounded-[3rem] p-16 text-center max-w-lg w-full shadow-2xl transition-all duration-700 hover:scale-105 group`}>
          {/* Status Icon or Camera Feed */}
          <div className="relative mb-8">
            {status === 'scanning' ? (
              <div className="w-full h-auto rounded-xl overflow-hidden shadow-lg border border-white/20">
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover rounded-xl"></video>
                <canvas ref={photoRef} style={{ display: 'none' }}></canvas>
                <button 
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors"
                  title="Capture Photo"
                >
                  <CameraIcon className="w-6 h-6" />
                </button>
              </div>
            ) : processedImage ? (
              <div className="w-full h-auto rounded-xl overflow-hidden shadow-lg border border-white/20">
                <img src={processedImage} alt="Processed Face" className="w-full h-full object-cover rounded-xl" />
              </div>
            ) : (
              <div className={`w-40 h-40 bg-gradient-to-br ${config.bgGradient} rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-white/20 relative overflow-hidden`}>
                <Icon className={`w-20 h-20 ${config.color} ${config.animation} drop-shadow-2xl`} />
                
                {/* Inner status elements, apply to default icon case only */}
                {/* Success Ripple */}
                {status === 'granted' && (
                  <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                )}
                
                {/* Error Pulse */}
                {status === 'denied' && (
                  <div className="absolute inset-0 rounded-full bg-red-400/20 animate-pulse-fast"></div>
                )}
              </div>
            )}
            
            {/* Outer Glow */}
            <div className={`absolute inset-0 w-40 h-40 bg-${config.glowColor} rounded-full blur-3xl mx-auto animate-pulse-glow`}></div>
          </div>
          
          {/* Status Text */}
          <div className="space-y-4">
            <h3 className={`text-3xl font-bold ${config.color} drop-shadow-lg`}>
              {config.title}
            </h3>
            <p className="text-gray-200 text-lg font-medium">
              {config.subtitle}
            </p>
          </div>

          {/* Action Button */}
          {status !== 'idle' && status !== 'scanning' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-center space-x-3 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              
              <button
                onClick={onReset}
                className="group inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 border border-white/20 rounded-2xl text-white transition-all duration-300 hover:scale-105 hover:rotate-1 backdrop-blur-sm"
              >
                <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                <span className="font-semibold">Scan Again</span>
              </button>
            </div>
          )}
          
          {/* Card Glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-700 -z-10`}></div>
        </div>
      </div>

      {/* Live Analysis Panel */}
      {status === 'scanning' && (
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 max-w-3xl mx-auto animate-slide-up shadow-2xl">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-4 h-4 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full animate-pulse"></div>
            <h4 className="text-2xl font-bold text-white">Live Analysis</h4>
            <div className="flex-1 h-px bg-gradient-to-r from-cyan-400/50 to-transparent"></div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { step: 'Face Detection', status: 'complete', icon: Shield },
              { step: 'Feature Extraction', status: 'complete', icon: Zap },
              { step: 'Database Matching', status: 'processing', icon: Loader },
              { step: 'Identity Verification', status: 'pending', icon: CheckCircle },
            ].map((item, index) => {
              const StepIcon = item.icon;
              return (
                <div key={index} className="flex items-center space-x-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all duration-300">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    item.status === 'complete' 
                      ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30' 
                      : item.status === 'processing' 
                      ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' 
                      : 'bg-gradient-to-br from-gray-500/20 to-slate-500/20 border border-gray-500/30'
                  }`}>
                    <StepIcon className={`w-6 h-6 ${
                      item.status === 'complete' 
                        ? 'text-emerald-400' 
                        : item.status === 'processing' 
                        ? 'text-cyan-400 animate-spin' 
                        : 'text-gray-400'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <span className={`font-semibold ${
                      item.status === 'complete' 
                        ? 'text-emerald-400' 
                        : item.status === 'processing' 
                        ? 'text-cyan-400' 
                        : 'text-gray-400'
                    }`}>
                      {item.step}
                    </span>
                    <div className="w-full bg-gray-700/50 rounded-full h-2 mt-2">
                      <div className={`h-2 rounded-full transition-all duration-1000 ${
                        item.status === 'complete' 
                          ? 'w-full bg-gradient-to-r from-emerald-500 to-teal-500' 
                          : item.status === 'processing' 
                          ? 'w-3/4 bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse' 
                          : 'w-0 bg-gray-600'
                      }`}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusSection;
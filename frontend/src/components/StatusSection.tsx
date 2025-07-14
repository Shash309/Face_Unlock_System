import React, { useRef, useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader, RotateCcw, Clock, Zap, Shield, Camera as CameraIcon, Video, Square } from 'lucide-react';
import { AccessStatus, LogEntry } from '../App';

interface StatusSectionProps {
  status: AccessStatus;
  recognizedName: string;
  onReset: () => void;
  onScanComplete: (result: { success: boolean, name: string, processedImg?: string, step: 'done' | 'intermediate' }) => void;
  processedImage: string | undefined;
}

const StatusSection: React.FC<StatusSectionProps> = ({ status, recognizedName, onReset, onScanComplete, processedImage }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [livenessResult, setLivenessResult] = useState<any>(null);
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_SECONDS = 3;
  // Move CHALLENGES above useState
  const CHALLENGES = [
    { key: 'blink', label: 'Blink your eyes', icon: <CameraIcon className="w-10 h-10 text-cyan-400 animate-pulse" /> },
    { key: 'open_mouth', label: 'Open your mouth', icon: <Zap className="w-10 h-10 text-yellow-400 animate-bounce" /> },
    { key: 'show_two_fingers', label: 'Show two fingers', icon: <span className="w-10 h-10 text-pink-400 text-4xl">✌️</span> },
    { key: 'show_one_hand', label: 'Show your hand', icon: <span className="w-10 h-10 text-blue-400 text-4xl">🖐️</span> },
    { key: 'thumbs_up', label: 'Show thumbs up', icon: <span className="w-10 h-10 text-green-400 text-4xl">👍</span> },
  ];
  // Now useState for challenge can safely use CHALLENGES
  const [challenge, setChallenge] = useState(() => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
  const [step, setStep] = useState<'recognition' | 'challenge' | 'done' | 'gesture-fail'>('recognition');
  const [progress, setProgress] = useState(0);
  // Notification state for face match
  const [notification, setNotification] = useState<string | null>(null);
  // Add a state to track if face was matched
  const [faceMatched, setFaceMatched] = useState(false);
  // Countdown state for redirect
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const redirectStarted = useRef(false);

  // Notification component
  const Notification = ({ message }: { message: string }) => (
    <div className="fixed top-8 right-8 z-50">
      <div className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold text-lg animate-slide-in-right">
        {message}
      </div>
      <style>{`
        @keyframes slide-in-right {
          0% { transform: translateX(120%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 1.5s cubic-bezier(0.4,0,0.2,1) both;
        }
      `}</style>
    </div>
  );

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
      onReset();
    }
  };

  const stopCamera = () => {
    if (stream) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (status === 'scanning') {
      setStep('recognition');
      setRecognitionResult(null);
      setLivenessResult(null);
      setProgress(0);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, [status]);

  // Ensure camera is always started for both steps
  useEffect(() => {
    if ((step === 'recognition' || step === 'challenge') && !stream) {
      startCamera();
    }
    // Do not stop camera between steps
    // Only stop camera when status changes away from 'scanning' (handled in other useEffect)
    // eslint-disable-next-line
  }, [step]);

  // Always re-attach stream to video element on stream or step change
  useEffect(() => {
    if ((step === 'recognition' || step === 'challenge') && videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [stream, step]);

  // Step 1: Face Recognition
  const uploadForRecognition = async (blob: Blob) => {
    setIsUploading(true);
    setProgress(30);
    try {
      const formData = new FormData();
      formData.append('video', blob, 'unlock_face_step1.webm');
      const response = await fetch('http://127.0.0.1:8000/unlock_face', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setRecognitionResult(data);
      setProgress(60);
      if (data.success) {
        setFaceMatched(true);
        setNotification(`Face matched: ${data.identity || 'Unknown'}`);
        setTimeout(() => {
          setNotification(null);
          setStep('challenge');
          setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
          setRecordedBlob(null);
          setProgress(70);
        }, 1500);
      } else {
        setFaceMatched(false);
        setStep('done');
        setProgress(100);
        // Show result overlay for 2.5s, then call onScanComplete
        setTimeout(() => {
          onScanComplete({ success: false, name: data.identity || 'Unknown', step: 'done' });
        }, 2500);
      }
    } catch (error) {
      setFaceMatched(false);
      setStep('done');
      setProgress(100);
      setTimeout(() => {
        onScanComplete({ success: false, name: 'Error', step: 'done' });
      }, 2500);
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2: Challenge Liveness
  const uploadForLiveness = async (blob: Blob) => {
    setIsUploading(true);
    setProgress(80);
    try {
      const formData = new FormData();
      formData.append('video', blob, 'challenge_liveness.webm');
      formData.append('challenge', challenge.key);
      const response = await fetch('http://127.0.0.1:8000/challenge_liveness', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setLivenessResult(data.liveness_report);
      setProgress(100);
      if (data.success) {
        setFaceMatched(true);
        if (!recognitionResult) {
          setRecognitionResult({ success: true, identity: recognizedName, processed_image: processedImage });
        }
        setStep('done');
        // Always use recognitionResult from step 1 for name and image
        setTimeout(() => {
          onScanComplete({
            success: true,
            name: recognitionResult?.identity || recognizedName || '',
            processedImg: recognitionResult?.processed_image,
            step: 'done',
          });
        }, 2500);
      } else {
        setStep('gesture-fail'); // New step for gesture fail
      }
    } catch (error) {
      setStep('gesture-fail');
    } finally {
      setIsUploading(false);
    }
  };

  // Recording logic (shared for both steps)
  useEffect(() => {
    if (recordedBlob && !isRecording && status === 'scanning') {
      if (step === 'recognition') {
        uploadForRecognition(recordedBlob);
      } else if (step === 'challenge') {
        uploadForLiveness(recordedBlob);
      }
    }
    // eslint-disable-next-line
  }, [recordedBlob, isRecording, status, step]);

  const startRecording = async () => {
    if (!stream) return;
    setIsRecording(true);
    setRecordingTime(0);
    setRecordedBlob(null);
    setLivenessResult(null);
    setRecognitionResult(null);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(blob);
      setIsRecording(false);
      setRecordingTime(0);
    };
    mediaRecorder.start();
    let elapsed = 0;
    recordingIntervalRef.current = setInterval(() => {
      elapsed += 0.1;
      setRecordingTime(Number(elapsed.toFixed(1)));
    }, 100);
    stopTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    }, MAX_RECORDING_SECONDS * 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
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

  // Robust countdown and redirect logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (
      step === 'done' &&
      faceMatched &&
      recognitionResult &&
      recognitionResult.success &&
      livenessResult &&
      livenessResult.liveness
    ) {
      if (!redirectStarted.current) {
        redirectStarted.current = true;
        setRedirectCountdown(5);
      } else if (redirectCountdown > 0) {
        interval = setInterval(() => {
          setRedirectCountdown((prev) => {
            if (prev === 1) {
              clearInterval(interval!);
              redirectStarted.current = false;
              onReset();
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      redirectStarted.current = false;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, faceMatched, recognitionResult, livenessResult, onReset, redirectCountdown]);

  return (
    <div className="relative w-full min-h-[520px] flex flex-col items-center justify-center animate-fade-in-up">
      {notification && <Notification message={notification} />}
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-400 transition-all duration-700" style={{ width: `${progress}%` }}></div>
      </div>
      {/* Step 1: Recognition */}
      {step === 'recognition' && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <video ref={videoRef} autoPlay muted playsInline className="w-[340px] h-[340px] md:w-[480px] md:h-[480px] rounded-3xl shadow-2xl border-4 border-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 animate-camera-glow object-cover z-0" style={{ background: '#181a20' }} />
          {(!isRecording && !isUploading && !recordedBlob) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <div className="mb-8 animate-bounce-slow pointer-events-none"><CameraIcon className="w-16 h-16 md:w-24 md:h-24 text-cyan-400 animate-pulse drop-shadow-lg" /></div>
                <div className="text-5xl md:text-6xl font-extrabold gradient-text mb-2 animate-gradient-x drop-shadow-lg pointer-events-none">Step 1: Face Recognition</div>
                <div className="text-2xl md:text-3xl text-white font-medium drop-shadow pointer-events-none mb-4">Look directly at the camera and press Start</div>
                <button 
                  onClick={startRecording}
                  className="mt-10 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-16 py-7 rounded-2xl font-bold text-3xl transition-all duration-300 hover:scale-105 flex items-center space-x-4 shadow-xl pointer-events-auto animate-fade-in-up relative overflow-hidden">
                  <Video className="w-10 h-10" />
                  <span>Start</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></span>
                </button>
              </div>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/60">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <div className="w-24 h-24 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-6"></div>
                <div className="text-cyan-400 font-bold text-3xl">Analyzing face...</div>
              </div>
            </div>
          )}
          {recognitionResult && !recognitionResult.success && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/70">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <XCircle className="w-20 h-20 text-red-400 animate-shake mb-6" />
                <div className="text-4xl md:text-5xl font-extrabold text-red-400 mb-2">Access Denied: Face not recognized</div>
              </div>
            </div>
          )}
          <style>{`
            @keyframes camera-glow {
              0%, 100% { box-shadow: 0 0 32px 8px #06b6d4, 0 0 0 0 #f472b6; }
              50% { box-shadow: 0 0 48px 16px #f472b6, 0 0 0 0 #06b6d4; }
            }
            .animate-camera-glow { animation: camera-glow 2.5s infinite alternate; }
          `}</style>
        </div>
      )}
      {/* Step 2: Challenge Liveness */}
      {step === 'challenge' && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <video ref={videoRef} autoPlay muted playsInline className="w-[340px] h-[340px] md:w-[480px] md:h-[480px] rounded-3xl shadow-2xl border-4 border-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 animate-camera-glow object-cover z-0" style={{ background: '#181a20' }} />
          {/* Show error if stream is missing */}
          {!stream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/80">
              <div className="text-3xl text-red-400 font-bold mb-4">Camera not available</div>
              <div className="text-lg text-white mb-4">Please check your camera connection and permissions.</div>
              <button onClick={startCamera} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-bold text-xl shadow-lg hover:scale-105 transition-all duration-300">Retry Camera</button>
            </div>
          )}
          {/* Overlay for instructions and start button, always semi-transparent */}
          {(!isRecording && !isUploading && !recordedBlob) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-black/20">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <div className="mb-8 animate-bounce-slow pointer-events-none">{challenge.icon}</div>
                <div className="text-5xl md:text-6xl font-extrabold gradient-text mb-2 animate-gradient-x drop-shadow-lg pointer-events-none">Step 2: {challenge.label}</div>
                <div className="text-2xl md:text-3xl text-white font-medium drop-shadow pointer-events-none mb-4">Follow the prompt while recording for spoof-proof security.</div>
                <button 
                  onClick={startRecording}
                  className="mt-8 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-16 py-7 rounded-2xl font-bold text-3xl transition-all duration-300 hover:scale-105 flex items-center space-x-4 shadow-xl pointer-events-auto animate-fade-in-up relative overflow-hidden">
                  <Video className="w-10 h-10" />
                  <span>Start</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></span>
                </button>
              </div>
            </div>
          )}
          {/* Loading overlay, semi-transparent, always show video underneath */}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/40">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <div className="w-24 h-24 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-6"></div>
                <div className="text-cyan-400 font-bold text-3xl">Analyzing your action...</div>
              </div>
            </div>
          )}
          {/* Fallback for unexpected backend response */}
          {(!isUploading && recordedBlob && !livenessResult && step === 'challenge') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/60">
              <div className="glass-strong p-10 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <XCircle className="w-20 h-20 text-yellow-400 animate-shake mb-6" />
                <div className="text-4xl md:text-5xl font-extrabold text-yellow-400 mb-2">Something went wrong</div>
                <div className="text-2xl md:text-3xl text-white font-medium mb-4">Could not process your gesture. Please try again.</div>
                <button onClick={() => { setStep('challenge'); setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]); setRecordedBlob(null); setLivenessResult(null); }} className="mt-8 px-12 py-6 rounded-2xl bg-gradient-to-r from-yellow-500 to-pink-500 text-white font-bold text-3xl shadow-lg hover:scale-105 transition-all duration-300 relative overflow-hidden">
                  Try Another Gesture
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Step 3: Done (Success) */}
      {step === 'done' && faceMatched && recognitionResult && recognitionResult.success && livenessResult && livenessResult.liveness && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          {/* Confetti animation */}
          <div className="absolute inset-0 pointer-events-none z-30">
            <svg className="absolute w-full h-full animate-confetti" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="30" r="8" fill="#06b6d4"/>
              <circle cx="120" cy="80" r="6" fill="#f472b6"/>
              <circle cx="200" cy="40" r="10" fill="#facc15"/>
              <circle cx="300" cy="60" r="7" fill="#34d399"/>
              <circle cx="350" cy="100" r="8" fill="#a78bfa"/>
              <circle cx="80" cy="150" r="7" fill="#f472b6"/>
              <circle cx="180" cy="180" r="6" fill="#06b6d4"/>
              <circle cx="320" cy="170" r="9" fill="#facc15"/>
            </svg>
            <style>{`
              @keyframes confetti {
                0% { opacity: 0; transform: translateY(-40px) scale(0.7); }
                10% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; transform: translateY(60px) scale(1.2); }
              }
              .animate-confetti { animation: confetti 2s ease-in-out infinite; }
            `}</style>
          </div>
          <div className="glass-strong p-12 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up z-20 bg-gradient-to-br from-cyan-900/60 via-pink-900/40 to-purple-900/60 border-4 border-cyan-400/30">
            <CheckCircle className="w-32 h-32 text-emerald-400 animate-bounce mb-6 z-20 drop-shadow-lg" />
            <div className="text-7xl md:text-8xl font-extrabold gradient-text mb-4 animate-gradient-x drop-shadow-lg animate-bounce">Unlocked!</div>
            <div className="text-4xl md:text-5xl text-white mb-2 z-20 drop-shadow-lg animate-fade-in-up">Welcome, <span className="font-bold text-cyan-300">{recognitionResult.identity}</span></div>
            <div className="text-2xl md:text-3xl text-gray-300 z-20 mb-4 drop-shadow animate-fade-in-up">Liveness Confirmed: <span className="font-semibold text-pink-300">{livenessResult.challenge}</span></div>
            <div className="mt-8 text-2xl text-emerald-300 font-semibold animate-pulse animate-fade-in-up">Access granted! Redirecting to home in {redirectCountdown}s...</div>
            <div className="mt-4 text-lg text-cyan-200 animate-fade-in-up">Enjoy your secure access 🎉</div>
          </div>
        </div>
      )}
      {/* Fallback for done step if data is missing */}
      {step === 'done' && (!faceMatched || !recognitionResult || !recognitionResult.success || !livenessResult || !livenessResult.liveness) && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <div className="glass-strong p-12 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up z-20">
            <XCircle className="w-32 h-32 text-red-400 animate-shake mb-6 z-20 drop-shadow-lg" />
            <div className="text-5xl md:text-6xl font-extrabold text-red-400 mb-2 z-20">Something went wrong</div>
            <div className="text-2xl md:text-3xl text-white mb-2 z-20">Could not complete the unlock process. Please try again.</div>
            <button onClick={onReset} className="mt-8 px-12 py-6 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-3xl shadow-lg hover:scale-105 transition-all duration-300">Return Home</button>
          </div>
        </div>
      )}
      {/* Step 3: Gesture Fail (Face matched, gesture not recognized) */}
      {step === 'gesture-fail' && faceMatched && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <div className="glass-strong p-12 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up z-20">
            <XCircle className="w-28 h-28 text-yellow-400 animate-shake mb-6 z-20 drop-shadow-lg" />
            <div className="text-6xl md:text-7xl font-extrabold text-yellow-400 mb-2 z-20">Gesture Not Recognized</div>
            <div className="text-3xl md:text-4xl text-white mb-2 z-20">Please try a different gesture for liveness check.</div>
            <button onClick={() => { setStep('challenge'); setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]); setRecordedBlob(null); setLivenessResult(null); }} className="mt-10 px-16 py-7 rounded-2xl bg-gradient-to-r from-yellow-500 to-pink-500 text-white font-bold text-3xl shadow-lg hover:scale-110 transition-all duration-300 relative overflow-hidden animate-bounce">
              Try Another Gesture
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></span>
            </button>
          </div>
        </div>
      )}
      {/* Fallback for gesture-fail if data is missing */}
      {step === 'gesture-fail' && !faceMatched && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <div className="glass-strong p-12 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up z-20">
            <XCircle className="w-28 h-28 text-yellow-400 animate-shake mb-6 z-20 drop-shadow-lg" />
            <div className="text-5xl md:text-6xl font-extrabold text-yellow-400 mb-2 z-20">Something went wrong</div>
            <div className="text-2xl md:text-3xl text-white mb-2 z-20">Could not process your gesture. Please try again.</div>
            <button onClick={onReset} className="mt-8 px-12 py-6 rounded-2xl bg-gradient-to-r from-yellow-500 to-pink-500 text-white font-bold text-3xl shadow-lg hover:scale-105 transition-all duration-300">Return Home</button>
          </div>
        </div>
      )}
      {/* Step 3: Done (Failure, face not matched) */}
      {step === 'done' && !faceMatched && (
        <div className="relative flex flex-col items-center justify-center w-full min-h-[420px] md:min-h-[520px]">
          <div className="glass-strong p-12 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in-up z-20">
            <XCircle className="w-32 h-32 text-red-400 animate-shake mb-6 z-20 drop-shadow-lg" />
            <div className="text-7xl md:text-8xl font-extrabold text-red-400 mb-4 z-20">Access Denied</div>
            <div className="text-3xl md:text-4xl text-white mb-2 z-20">Face not recognized in the system.</div>
            <div className="mt-8 text-xl text-red-300 font-semibold animate-pulse">Returning to home...</div>
          </div>
        </div>
      )}

      {/* Live Analysis Panel */}
      {/* (Removed as per request) */}
    </div>
  );
};

export default StatusSection;
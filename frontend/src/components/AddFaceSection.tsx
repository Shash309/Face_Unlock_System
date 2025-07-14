import React, { useState, useRef, useCallback } from 'react';
import { Upload, User, CheckCircle, AlertCircle, Camera, X, Sparkles, Shield, Video, Square } from 'lucide-react';

interface AddFaceSectionProps {
  onAddFace: (name: string, imageFile: File | null) => void;
}

const AddFaceSection: React.FC<AddFaceSectionProps> = ({ onAddFace }) => {
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errors, setErrors] = useState<{ name?: string; file?: string; general?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_SECONDS = 3; // Change to 5 for 5 seconds
  const [showRecorded, setShowRecorded] = useState(false);
  const [isPlayback, setIsPlayback] = useState(false);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      setRecordingTime(0);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setShowRecorded(false);
      setIsPlayback(false);
      setPreviewUrl(null);
      setSelectedFile(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.controls = false;
        videoRef.current.autoplay = true;
      }
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], 'face_video.webm', { type: 'video/webm' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setShowRecorded(true);
        setIsPlayback(true);
        setErrors(prev => ({ ...prev, file: undefined }));
        // Stop the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      let elapsed = 0;
      recordingIntervalRef.current = setInterval(() => {
        elapsed += 0.1;
        setRecordingTime(Number(elapsed.toFixed(1)));
      }, 100);
      stopTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setErrors(prev => ({
        ...prev,
        general: 'Unable to access camera. Please ensure camera permissions are granted.'
      }));
    }
  }, [stopRecording]);

  // Handle switching video element between live and playback
  React.useEffect(() => {
    if (isRecording && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.controls = false;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
    } else if (isPlayback && previewUrl && videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = previewUrl;
      videoRef.current.controls = true;
      videoRef.current.muted = false;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = false;
    }
  }, [isRecording, isPlayback, previewUrl]);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrors(prev => ({ ...prev, file: undefined }));
    } else if (file.type.startsWith('video/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrors(prev => ({ ...prev, file: undefined }));
    } else {
      setErrors(prev => ({ ...prev, file: 'Please select a valid image or video file' }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const validateForm = () => {
    const newErrors: { name?: string; file?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!selectedFile) {
      newErrors.file = 'Please record a video or select an image file';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      if (selectedFile?.type.startsWith('video/')) {
        // Handle video upload
        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('name', name.trim());

        const response = await fetch('http://127.0.0.1:8000/upload_video', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload video');
        }

        setIsSubmitted(true);
        onAddFace(name.trim(), selectedFile);
      } else {
        // Handle image upload (existing functionality)
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile!);
        
        reader.onload = async () => {
          const base64Image = reader.result as string;
          
          const response = await fetch('http://127.0.0.1:8000/add_face', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image,
              name: name.trim()
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to add face');
          }

          setIsSubmitted(true);
          onAddFace(name.trim(), selectedFile);
        };

        reader.onerror = () => {
          throw new Error('Failed to read image file');
        };
      }
      
      // Reset form after successful submission
      setTimeout(() => {
        setName('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsSubmitted(false);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      }, 2000);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : 'Failed to add face'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrors(prev => ({ ...prev, file: undefined }));
  };

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in-up">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
          Add New Face
        </h2>
        <p className="text-xl text-gray-300">Register a new person for facial recognition access</p>
      </div>

      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-[2rem] p-10 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-700">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Name Input */}
          <div className="space-y-3">
            <label htmlFor="name" className="block text-lg font-semibold text-gray-200 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-cyan-400" />
              </div>
              <span>Full Name</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors(prev => ({ ...prev, name: undefined }));
                }
              }}
              placeholder="Enter full name"
              className={`w-full px-6 py-4 bg-white/[0.05] border rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-300 backdrop-blur-sm text-lg ${
                errors.name 
                  ? 'border-red-500/50 focus:ring-red-400/50 focus:border-red-400/50' 
                  : 'border-white/20 focus:ring-cyan-400/50 focus:border-cyan-400/50 hover:border-white/30'
              }`}
            />
            {errors.name && (
              <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.name}</span>
              </div>
            )}
          </div>

          {/* Video/Image Capture Area */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-200 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-cyan-400" />
              </div>
              <span>Face Capture</span>
            </label>
            
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-500 backdrop-blur-sm group ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-400/10 scale-105'
                  : errors.file
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-white/30 hover:border-cyan-400/50 hover:bg-white/[0.02] hover:scale-[1.02]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              {isRecording ? (
                <div className="space-y-6">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="max-h-64 mx-auto rounded-2xl shadow-2xl border border-white/20"
                      autoPlay
                      muted
                      playsInline
                      controls={false}
                      style={{ background: '#222', width: '100%', minHeight: '180px' }}
                    />
                    <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                      REC
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      {recordingTime.toFixed(1)}s
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2 mx-auto"
                  >
                    <Square className="w-5 h-5" />
                    <span>Stop Recording</span>
                  </button>
                </div>
              ) : previewUrl && showRecorded ? (
                <div className="relative">
                  <div className="relative inline-block">
                    <video
                      src={previewUrl}
                      className="max-h-64 mx-auto rounded-2xl shadow-2xl border border-white/20"
                      controls
                      style={{ background: '#222', width: '100%', minHeight: '180px' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl pointer-events-none"></div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                      setShowRecorded(false);
                      setIsPlayback(false);
                    }}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-lg pointer-events-auto"
                    style={{ top: '-1.5rem', right: '-1.5rem' }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="mt-6 text-gray-300 font-medium">
                    {selectedFile?.name}
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-2xl shadow-2xl border border-white/20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 via-pink-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-500">
                      <Video className={`w-12 h-12 transition-all duration-500 ${
                        isDragOver ? 'text-cyan-400 scale-110' : 'text-gray-400 group-hover:text-cyan-400'
                      }`} />
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-gray-200">
                      {isDragOver ? 'Drop the file here' : 'Record a 3-second video or upload a file'}
                    </p>
                    <p className="text-gray-400">
                      Supports: Video recording (3s) or image files
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
                    >
                      <Video className="w-5 h-5" />
                      <span>Record Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Upload File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {errors.file && (
              <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.file}</span>
              </div>
            )}
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitted || isLoading || isRecording}
            className={`w-full py-5 rounded-3xl font-bold text-xl transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-slate-900 relative overflow-hidden group ${
              isSubmitted
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white cursor-not-allowed'
                : isLoading
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white cursor-wait'
                : isRecording
                ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 via-pink-600 to-purple-600 text-white hover:scale-105 hover:rotate-1 focus:ring-cyan-400/50 shadow-2xl hover:shadow-cyan-500/25'
            }`}
          >
            <div className="relative z-10 flex items-center justify-center space-x-4">
              {isSubmitted ? (
                <>
                  <CheckCircle className="w-7 h-7 animate-bounce" />
                  <span>Face Added Successfully!</span>
                </>
              ) : isLoading ? (
                <>
                  <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding Face...</span>
                </>
              ) : isRecording ? (
                <>
                  <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording in Progress...</span>
                </>
              ) : (
                <>
                  <User className="w-7 h-7 group-hover:scale-110 transition-transform duration-300" />
                  <span>Add New Face</span>
                </>
              )}
            </div>
          </button>
        </form>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.12] transition-all duration-500 hover:scale-105 group">
          <h4 className="font-bold text-xl text-white mb-4 flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
              <Video className="w-6 h-6 text-cyan-400" />
            </div>
            <span>Video Guidelines</span>
          </h4>
          <ul className="text-gray-300 space-y-3">
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>3-second video recording</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>Look directly at camera</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>Good lighting conditions</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>No face coverings</span>
            </li>
          </ul>
        </div>
        
        <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.12] transition-all duration-500 hover:scale-105 group">
          <h4 className="font-bold text-xl text-white mb-4 flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <span>Security & Privacy</span>
          </h4>
          <ul className="text-gray-300 space-y-3">
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
              <span>Videos encrypted at rest</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
              <span>Biometric data secured</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
              <span>GDPR compliant processing</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
              <span>Data never shared</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddFaceSection;
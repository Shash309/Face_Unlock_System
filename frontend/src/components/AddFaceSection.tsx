import React, { useState, useRef } from 'react';
import { Upload, User, CheckCircle, AlertCircle, Camera, X, Sparkles, Shield } from 'lucide-react';

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
  const [errors, setErrors] = useState<{ name?: string; file?: string; general?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrors(prev => ({ ...prev, file: undefined }));
    } else {
      setErrors(prev => ({ ...prev, file: 'Please select a valid image file' }));
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
      newErrors.file = 'Please select an image file';
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
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile!);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        
        // Send to backend
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
      };

      reader.onerror = () => {
        throw new Error('Failed to read image file');
      };
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

          {/* File Upload Area */}
          <div className="space-y-3">
            <label className="block text-lg font-semibold text-gray-200 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-cyan-400" />
              </div>
              <span>Profile Photo</span>
            </label>
            
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-500 backdrop-blur-sm group ${
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
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="relative">
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-2xl shadow-2xl border border-white/20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110 shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="mt-6 text-gray-300 font-medium">
                    {selectedFile?.name}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/20 via-pink-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-500">
                      <Upload className={`w-12 h-12 transition-all duration-500 ${
                        isDragOver ? 'text-cyan-400 scale-110' : 'text-gray-400 group-hover:text-cyan-400'
                      }`} />
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xl font-semibold text-gray-200">
                      {isDragOver ? 'Drop the image here' : 'Drop image here or click to browse'}
                    </p>
                    <p className="text-gray-400">
                      Supports: JPG, PNG, GIF (Max 10MB)
                    </p>
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
            disabled={isSubmitted || isLoading}
            className={`w-full py-5 rounded-3xl font-bold text-xl transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-offset-4 focus:ring-offset-slate-900 relative overflow-hidden group ${
              isSubmitted
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white cursor-not-allowed'
                : isLoading
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white cursor-wait'
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
              <Camera className="w-6 h-6 text-cyan-400" />
            </div>
            <span>Photo Guidelines</span>
          </h4>
          <ul className="text-gray-300 space-y-3">
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>Clear, well-lit face photo</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>Look directly at camera</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>No sunglasses or face coverings</span>
            </li>
            <li className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full"></div>
              <span>Minimum 300x300 pixels</span>
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
              <span>Images encrypted at rest</span>
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
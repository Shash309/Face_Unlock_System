import React from 'react';
import { Camera, Shield, Zap, Lock, Sparkles } from 'lucide-react';

interface HomePageProps {
  onStartScan: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onStartScan }) => {
  return (
    <div className="space-y-16 animate-fade-in-up">
      {/* Hero Section */}
      <div className="text-center space-y-10">
        <div className="space-y-6 animate-hero-enter">
          <div className="relative inline-block">
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent leading-tight animate-gradient-x">
              Face Unlock System
            </h1>
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/20 via-pink-400/20 to-purple-400/20 blur-3xl -z-10 animate-pulse-glow"></div>
          </div>
          
          <div className="space-y-4">
            <p className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent">
              Secure. Smart. Seamless.
            </p>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Experience the future of authentication with our advanced facial recognition technology. 
              Fast, secure, and effortless access control powered by next-generation AI.
            </p>
          </div>
        </div>

        {/* Main CTA */}
        <div className="animate-cta-enter">
          <button
            onClick={onStartScan}
            className="group relative px-10 py-5 bg-gradient-to-r from-cyan-600 via-pink-600 to-purple-600 rounded-3xl text-white font-bold text-xl transition-all duration-500 hover:scale-110 hover:rotate-1 focus:outline-none focus:ring-4 focus:ring-cyan-400/50 focus:ring-offset-4 focus:ring-offset-slate-900 overflow-hidden shadow-2xl hover:shadow-cyan-500/25"
          >
            <div className="relative z-10 flex items-center space-x-4">
              <div className="relative">
                <Camera className="w-8 h-8 group-hover:rotate-12 transition-transform duration-500" />
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 animate-ping" />
              </div>
              <span>Start Face Scan</span>
            </div>
            
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-pink-600 to-purple-600 animate-gradient-x"></div>
            
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-pink-600 to-purple-600 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 -z-10"></div>
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>
          </button>
        </div>
      </div>

      {/* Webcam Preview Area */}
      <div className="max-w-3xl mx-auto animate-camera-enter">
        <div className="relative backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-700 group">
          <div className="aspect-video bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden backdrop-blur-sm">
            {/* Webcam Placeholder */}
            <div className="text-center space-y-6 z-10">
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 via-pink-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-white/10 group-hover:scale-110 transition-transform duration-500">
                  <Camera className="w-16 h-16 text-cyan-400 group-hover:text-pink-400 transition-colors duration-500" />
                </div>
                <div className="absolute inset-0 w-32 h-32 bg-gradient-to-r from-cyan-400/20 to-pink-400/20 rounded-full blur-2xl mx-auto animate-pulse-glow"></div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-semibold text-white">Camera Ready</p>
                <p className="text-gray-400">Click "Start Face Scan" to begin authentication</p>
              </div>
            </div>

            {/* Scanning Grid Animation */}
            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
                {Array.from({ length: 96 }).map((_, i) => (
                  <div
                    key={i}
                    className="border border-cyan-400/30 animate-grid-pulse"
                    style={{
                      animationDelay: `${i * 0.02}s`,
                      animationDuration: '3s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Corner Brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400/60 rounded-tl-lg"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-400/60 rounded-tr-lg"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-400/60 rounded-bl-lg"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-400/60 rounded-br-lg"></div>
          </div>
          
          {/* Glow Border */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-pink-500/20 to-purple-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10"></div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 animate-features-enter">
        {[
          {
            icon: Shield,
            title: 'Ultra Secure',
            description: 'Military-grade encryption with advanced biometric authentication and zero-knowledge architecture',
            gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
            glowColor: 'emerald-500/20',
          },
          {
            icon: Zap,
            title: 'Lightning Fast',
            description: 'Sub-second recognition with real-time processing and optimized neural networks',
            gradient: 'from-yellow-500 via-orange-500 to-red-500',
            glowColor: 'yellow-500/20',
          },
          {
            icon: Lock,
            title: 'AI Powered',
            description: '99.9% accuracy with continuous learning algorithms and adaptive recognition',
            gradient: 'from-purple-500 via-pink-500 to-rose-500',
            glowColor: 'purple-500/20',
          },
        ].map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={index}
              className="group relative backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.12] transition-all duration-500 hover:scale-105 hover:-rotate-1 cursor-pointer overflow-hidden"
              style={{
                animationDelay: `${index * 0.2}s`
              }}
            >
              <div className="relative z-10">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-lg`}>
                  <Icon className="w-8 h-8 text-white drop-shadow-lg" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-300 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                  {feature.description}
                </p>
              </div>
              
              {/* Hover Glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl`}></div>
              
              {/* Border Glow */}
              <div className={`absolute inset-0 bg-${feature.glowColor} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}></div>
              
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-3xl"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
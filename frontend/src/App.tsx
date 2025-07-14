import React, { useState } from 'react';
import { Camera, Shield, UserPlus, History, CheckCircle, XCircle, Scan } from 'lucide-react';
import HomePage from './components/HomePage';
import StatusSection from './components/StatusSection';
import AddFaceSection from './components/AddFaceSection';
import LogsSection from './components/LogsSection';
import AnimatedBackground from './components/AnimatedBackground';

export type AccessStatus = 'idle' | 'scanning' | 'granted' | 'denied';

export interface LogEntry {
  id: string;
  name: string;
  status: 'granted' | 'denied';
  timestamp: Date;
  thumbnail?: string;
}

function App() {
  const [activeSection, setActiveSection] = useState<'home' | 'status' | 'add' | 'logs'>('home');
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('idle');
  const [recognizedName, setRecognizedName] = useState<string>('');
  const [processedImage, setProcessedImage] = useState<string | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      name: 'John Doe',
      status: 'granted',
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: '2',
      name: 'Unknown User',
      status: 'denied',
      timestamp: new Date(Date.now() - 600000),
    },
    {
      id: '3',
      name: 'Jane Smith',
      status: 'granted',
      timestamp: new Date(Date.now() - 900000),
    },
  ]);

  const handleStartScan = () => {
    setActiveSection('status');
    setAccessStatus('scanning');
    setRecognizedName('');
    setProcessedImage(undefined);
    // Remove the simulation logic here
  };

  const handleAddFace = (name: string, imageFile: File | null) => {
    console.log('Adding face:', name, imageFile);
    // Backend integration point
  };

  const navigationItems = [
    { id: 'home', label: 'Home', icon: Shield },
    { id: 'status', label: 'Status', icon: Scan },
    { id: 'add', label: 'Add Face', icon: UserPlus },
    { id: 'logs', label: 'Logs', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden relative">
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Main Container */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 backdrop-blur-xl bg-white/[0.02] border-b border-white/[0.08] shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4 group">
              <div className="relative">
                <Shield className="w-10 h-10 text-cyan-400 group-hover:text-pink-400 transition-all duration-500 drop-shadow-lg" />
                <div className="absolute inset-0 w-10 h-10 bg-cyan-400/20 rounded-full blur-xl group-hover:bg-pink-400/20 transition-all duration-500"></div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient-x">
                Face Unlock System
              </h1>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex space-x-2">
              {navigationItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id as any)}
                    className={`group relative px-6 py-3 rounded-2xl transition-all duration-500 flex items-center space-x-3 overflow-hidden ${
                      activeSection === item.id
                        ? 'bg-gradient-to-r from-cyan-500/20 to-pink-500/20 text-white backdrop-blur-xl border border-white/20 shadow-2xl'
                        : 'text-gray-300 hover:text-white hover:bg-white/[0.05] hover:backdrop-blur-xl hover:border hover:border-white/10'
                    }`}
                    style={{
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div className="relative z-10 flex items-center space-x-3">
                      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {activeSection === item.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-pink-600/10 animate-pulse"></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as any)}
                className="bg-white/[0.05] backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-300"
              >
                {navigationItems.map((item) => (
                  <option key={item.id} value={item.id} className="bg-slate-800">
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-section-enter">
              {activeSection === 'home' && (
                <HomePage onStartScan={handleStartScan} />
              )}
              {activeSection === 'status' && (
                <StatusSection 
                  status={accessStatus} 
                  recognizedName={recognizedName}
                  onReset={() => {
                    setAccessStatus('idle');
                    setRecognizedName('');
                    setProcessedImage(undefined);
                    setActiveSection('home');
                  }}
                  onScanComplete={({ success, name, processedImg, step }) => {
                    if (step === 'done') {
                      setAccessStatus(success ? 'granted' : 'denied');
                      setRecognizedName(name);
                      setProcessedImage(processedImg ? `data:image/jpeg;base64,${processedImg}` : undefined);
                      // Add to logs
                      const newLog: LogEntry = {
                        id: Date.now().toString(),
                        name: name,
                        status: success ? 'granted' : 'denied',
                        timestamp: new Date(),
                      };
                      setLogs(prev => [newLog, ...prev]);
                    }
                  }}
                  processedImage={processedImage}
                />
              )}
              {activeSection === 'add' && (
                <AddFaceSection onAddFace={handleAddFace} />
              )}
              {activeSection === 'logs' && (
                <LogsSection logs={logs} />
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 backdrop-blur-xl bg-white/[0.02] border-t border-white/[0.08]">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-gray-400 font-medium">
              &copy; 2025 Face Unlock System. 
              <span className="bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent ml-2">
                Secure. Smart. Seamless.
              </span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
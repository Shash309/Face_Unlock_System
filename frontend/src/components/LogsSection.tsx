import React, { useState } from 'react';
import { Search, Filter, CheckCircle, XCircle, Clock, User, Calendar, Download, TrendingUp, Activity } from 'lucide-react';
import { LogEntry as AppLogEntry } from '../App';

interface LogEntry extends AppLogEntry {
  processedImage?: string;
}

interface LogsSectionProps {
  logs: LogEntry[];
}

const LogsSection: React.FC<LogsSectionProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'granted' | 'denied'>('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || log.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: 'granted' | 'denied') => {
    return status === 'granted' ? CheckCircle : XCircle;
  };

  const getStatusColor = (status: 'granted' | 'denied') => {
    return status === 'granted' 
      ? 'text-emerald-400 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30' 
      : 'text-red-400 bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-500/30';
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `face_unlock_logs_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const stats = {
    total: logs.length,
    granted: logs.filter(log => log.status === 'granted').length,
    denied: logs.filter(log => log.status === 'denied').length,
    successRate: logs.length > 0 ? Math.round((logs.filter(log => log.status === 'granted').length / logs.length) * 100) : 0
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-fade-in-up">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
          Access Logs
        </h2>
        <p className="text-xl text-gray-300">Complete history of facial recognition attempts</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Attempts', value: stats.total, icon: Activity, iconColor: 'text-blue-400' },
          { label: 'Access Granted', value: stats.granted, icon: CheckCircle, iconColor: 'text-emerald-400' },
          { label: 'Access Denied', value: stats.denied, icon: XCircle, iconColor: 'text-red-400' },
          { label: 'Success Rate', value: `${stats.successRate}%`, icon: TrendingUp, iconColor: 'text-purple-400' },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="group relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-white/[0.10] to-white/[0.03] border border-white/10 rounded-3xl p-8 text-center shadow-xl hover:shadow-cyan-500/10 transition-all duration-500 hover:scale-105 hover:-rotate-1 cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative z-10 flex flex-col items-center">
                <Icon className={`w-10 h-10 mb-2 ${stat.iconColor} drop-shadow-lg`} />
                <div className="text-4xl font-extrabold text-white mb-2 group-hover:text-cyan-300 transition-colors duration-300 animate-pulse">
                  {stat.value}
                </div>
                <div className="text-base text-gray-300 font-semibold tracking-wide uppercase letter-spacing-wider mb-1">{stat.label}</div>
                <div className="w-10 h-1 bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full mx-auto mb-2 opacity-60"></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/[0.05] border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-300 backdrop-blur-sm"
            />
          </div>

          {/* Filter and Export */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'granted' | 'denied')}
                className="bg-white/[0.05] border border-white/20 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50 backdrop-blur-sm"
              >
                <option value="all" className="bg-slate-800">All Status</option>
                <option value="granted" className="bg-slate-800">Granted</option>
                <option value="denied" className="bg-slate-800">Denied</option>
              </select>
            </div>

            <button
              onClick={exportLogs}
              className="group flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/20 hover:to-white/10 border border-white/20 rounded-2xl text-white transition-all duration-300 hover:scale-105 backdrop-blur-sm"
            >
              <Download className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              <span className="font-medium">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-6">
        {filteredLogs.length === 0 ? (
          <div className="backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-16 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-500/20 to-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">No logs found</h3>
            <p className="text-gray-400 text-lg">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Access attempts will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredLogs.map((log, index) => {
              const StatusIcon = getStatusIcon(log.status);
              return (
                <div
                  key={log.id}
                  className="group backdrop-blur-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.12] transition-all duration-500 hover:scale-[1.02] hover:-rotate-1 cursor-pointer"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      {/* Avatar/Thumbnail */}
                      <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-pink-500/20 to-purple-500/20 flex items-center justify-center backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300 overflow-hidden shadow-lg">
                          {log.thumbnail ? (
                            <img
                              src={log.thumbnail}
                              alt={log.name}
                              className="w-20 h-20 rounded-2xl object-cover border-2 border-cyan-400/40"
                            />
                          ) : log.processedImage ? (
                            <img
                              src={log.processedImage}
                              alt={log.name}
                              className="w-20 h-20 rounded-2xl object-cover border-2 border-pink-400/40"
                            />
                          ) : (
                            <User className="w-10 h-10 text-gray-400" />
                          )}
                        </div>
                        <div className="text-center mt-2 text-sm font-semibold text-white bg-gradient-to-r from-cyan-400/20 to-pink-400/20 rounded-xl px-2 py-1 shadow">
                          {log.name}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">
                          {log.name}
                        </h3>
                        <div className="flex items-center space-x-6 text-gray-400">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium">{log.timestamp.toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{log.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status and Time */}
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-400 font-medium mb-1">
                          {formatTimeAgo(log.timestamp)}
                        </div>
                      </div>
                      
                      <div className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border backdrop-blur-sm ${getStatusColor(log.status)} group-hover:scale-105 transition-transform duration-300`}>
                        <StatusIcon className="w-5 h-5" />
                        <span className="font-bold capitalize">{log.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load More Button */}
      {filteredLogs.length > 0 && (
        <div className="text-center">
          <button className="group px-10 py-4 bg-gradient-to-r from-white/5 to-white/10 hover:from-white/10 hover:to-white/20 border border-white/20 rounded-2xl text-white transition-all duration-300 hover:scale-105 backdrop-blur-sm font-semibold">
            <span className="group-hover:text-cyan-300 transition-colors duration-300">Load More Logs</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LogsSection;
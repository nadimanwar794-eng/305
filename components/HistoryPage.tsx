import React, { useState, useEffect } from 'react';
import { LessonContent, User, SystemSettings } from '../types';
import { BookOpen, Calendar, ChevronDown, ChevronUp, Trash2, Search, FileText, CheckCircle2, Lock } from 'lucide-react';
import { LessonView } from './LessonView';
import { saveUserToLive } from '../firebase';
import { CustomAlert, CustomConfirm } from './CustomDialogs';

interface Props {
    user: User;
    onUpdateUser: (u: User) => void;
    settings?: SystemSettings;
}

export const HistoryPage: React.FC<Props> = ({ user, onUpdateUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'ACTIVITY' | 'SAVED'>('ACTIVITY');
  
  // SAVED NOTES STATE
  const [history, setHistory] = useState<LessonContent[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  
  // USAGE HISTORY STATE (ACTIVITY LOG)
  const [usageLog, setUsageLog] = useState<any[]>([]);

  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
      isOpen: false, 
      message: '', 
      onConfirm: () => {}
  });

  useEffect(() => {
    // Load Saved Notes
    const stored = localStorage.getItem('nst_user_history');
    if (stored) {
        try {
            setHistory(JSON.parse(stored).reverse()); // Newest first
        } catch (e) { console.error("History parse error", e); }
    }

    // Load Activity Log from User Object
    if (user.usageHistory) {
        setUsageLog(user.usageHistory);
    }
  }, [user.usageHistory]);

  const executeOpenItem = (item: LessonContent, cost: number) => {
      if (cost > 0) {
          const updatedUser = { ...user, credits: user.credits - cost };
          onUpdateUser(updatedUser);
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser);
      }
      setSelectedLesson(item);
  };

  const handleOpenItem = (item: LessonContent) => {
      // 1. Check Cost
      // If it's an MCQ type and there is a cost configured
      if (item.type.includes('MCQ')) {
          const cost = settings?.mcqHistoryCost ?? 1;
          
          if (cost > 0) {
              // 2. Check Exemption (Admin or Premium)
              const isExempt = user.role === 'ADMIN' || 
                              (user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date());
              
              if (!isExempt) {
                  if (user.credits < cost) {
                      setAlertConfig({isOpen: true, message: `Insufficient Credits! Viewing history costs ${cost} coins.`});
                      return;
                  }
                  
                  setConfirmConfig({
                      isOpen: true,
                      message: `View Result for ${cost} Credits?`,
                      onConfirm: () => executeOpenItem(item, cost)
                  });
                  return;
              }
          }
      }
      
      executeOpenItem(item, 0);
  };

  const filteredHistory = history.filter(h => 
    h.title.toLowerCase().includes(search.toLowerCase()) || 
    h.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
  };

  if (selectedLesson) {
      return (
          <div className="animate-in slide-in-from-right duration-300">
              <button 
                onClick={() => setSelectedLesson(null)}
                className="mb-4 text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                  &larr; Back to History
              </button>
              {/* Reuse LessonView but mock props usually passed from API */}
              <LessonView 
                 content={selectedLesson}
                 subject={{id: 'hist', name: selectedLesson.subjectName, icon: 'book', color: 'bg-slate-100'}} 
                 classLevel={'10'} // Display only
                 chapter={{id: 'hist', title: selectedLesson.title}}
                 loading={false}
                 onBack={() => setSelectedLesson(null)}
              />
          </div>
      )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CustomAlert 
            isOpen={alertConfig.isOpen} 
            message={alertConfig.message} 
            onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
        />
        <CustomConfirm
            isOpen={confirmConfig.isOpen}
            message={confirmConfig.message}
            onConfirm={() => {
                confirmConfig.onConfirm();
                setConfirmConfig({...confirmConfig, isOpen: false});
            }}
            onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        />
        
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                 <FileText className="text-blue-600" /> Study History
            </h3>
        </div>

        {/* TABS */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button 
                onClick={() => setActiveTab('ACTIVITY')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'ACTIVITY' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Activity Log
            </button>
            <button 
                onClick={() => setActiveTab('SAVED')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'SAVED' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Saved Notes
            </button>
        </div>

        {activeTab === 'ACTIVITY' && (
            <div className="space-y-4">
                {usageLog.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        <p>No study activity recorded yet.</p>
                    </div>
                ) : (
                    usageLog.map((log, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                    log.type === 'VIDEO' ? 'bg-red-500' : 
                                    log.type === 'PDF' ? 'bg-blue-500' : 'bg-purple-500'
                                }`}>
                                    {log.type === 'VIDEO' ? '▶' : log.type === 'PDF' ? '📄' : '?'}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm line-clamp-1">{log.itemTitle}</p>
                                    <p className="text-xs text-slate-500">{log.subject} • {new Date(log.timestamp).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-700 text-sm">{formatDuration(log.durationSeconds)}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Time Spent</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {activeTab === 'SAVED' && (
            <>
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search your notes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No saved notes yet. Start learning to build your library!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => handleOpenItem(item)}
                                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group relative"
                            >
                                {/* COST BADGE */}
                                {!user.isPremium && item.type.includes('MCQ') && (settings?.mcqHistoryCost ?? 1) > 0 && (
                                    <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10 border border-yellow-200">
                                        <Lock size={8} /> Pay {settings?.mcqHistoryCost ?? 1} CR
                                    </div>
                                )}

                                <div className="p-4 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                                {item.subjectName}
                                            </span>
                                            {item.type === 'NOTES_PREMIUM' && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-yellow-300 to-orange-400 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                                    Premium
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                                            {item.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <Calendar size={12} />
                                            {new Date(item.dateCreated).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Preview Footer */}
                                <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center">
                                     <span className="text-xs text-slate-500 font-medium">Click to read full note</span>
                                     <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <ChevronDown size={16} className="-rotate-90" />
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
    </div>
  );
};
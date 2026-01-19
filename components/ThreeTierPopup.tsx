import React, { useState, useEffect } from 'react';
import { X, Crown, Zap, Star, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
  onUpgrade: () => void;
  isOpen: boolean;
  config?: {
      autoCloseSeconds?: number;
      skipDelaySeconds?: number;
  };
}

export const ThreeTierPopup: React.FC<Props> = ({ onClose, onUpgrade, isOpen, config }) => {
  const [slide, setSlide] = useState(0); // 0: Free, 1: Basic, 2: Ultra
  const [timer, setTimer] = useState(config?.autoCloseSeconds || 15); 
  const [skipTimer, setSkipTimer] = useState(config?.skipDelaySeconds || 5); 

  useEffect(() => {
    if (!isOpen) return;

    setTimer(config?.autoCloseSeconds || 15);
    setSkipTimer(config?.skipDelaySeconds || 5);

    // Slide cycler (every 3s)
    const slideInterval = setInterval(() => {
      setSlide(prev => (prev + 1) % 3);
    }, 5000);

    // Global countdown
    const globalTimer = setInterval(() => {
        setTimer(prev => {
            if (prev <= 1) {
                onClose(); // Auto close
                return 0;
            }
            return prev - 1;
        });
        setSkipTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => {
      clearInterval(slideInterval);
      clearInterval(globalTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
        {/* SKIP BUTTON */}
        <div className="absolute top-8 right-8 z-50">
            {skipTimer > 0 ? (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border-2 border-white/20">
                    {skipTimer}
                </div>
            ) : (
                <button 
                    onClick={onClose}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-xs font-bold transition-all border border-white/20"
                >
                    Skip & Close
                </button>
            )}
        </div>

        {/* CONTENT */}
        <div className="w-full max-w-sm mx-4 relative perspective-1000">
            {/* CARDS */}
            <div className="relative h-[500px] w-full">
                {/* FREE CARD */}
                <div className={`absolute inset-0 bg-white rounded-3xl p-6 transition-all duration-700 ease-in-out transform ${slide === 0 ? 'opacity-100 translate-x-0 scale-100 z-30' : 'opacity-0 -translate-x-full scale-90 z-10'}`}>
                    <div className="h-full flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Star size={40} className="text-slate-500" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2">🆓 Free Plan</h2>
                        <p className="text-slate-500 text-sm mb-8">(Sabhi Students ke liye)</p>
                        
                        <ul className="space-y-3 text-left w-full pl-4 mb-auto">
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Leaderboard: Global Leaderboard View (New)</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Study Material: Basic Subject Notes</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Practice: Chapter-wise Practice MCQs</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Tracking: Daily Study Streak Tracker</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Rewards: Daily Login Bonus (3 Coins/Day)</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Fun: Spin Wheel (2 Spins/Day)</li>
                            <li className="flex items-center gap-3 text-slate-700 text-sm font-bold"><Check size={16} className="text-green-500" /> ✅ Access: Mobile Access & Basic Class Notifications</li>
                        </ul>
                    </div>
                </div>

                {/* BASIC CARD */}
                <div className={`absolute inset-0 bg-gradient-to-b from-blue-50 to-white rounded-3xl p-6 transition-all duration-700 ease-in-out transform ${slide === 1 ? 'opacity-100 translate-x-0 scale-100 z-30' : slide > 1 ? 'opacity-0 -translate-x-full scale-90 z-10' : 'opacity-0 translate-x-full scale-90 z-10'}`}>
                    <div className="h-full flex flex-col items-center text-center border-2 border-blue-500 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-blue-500"></div>
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 mt-6">
                            <Zap size={40} className="text-blue-600" />
                        </div>
                        <h2 className="text-3xl font-black text-blue-900 mb-2">🔷 Basic Plan</h2>
                        <p className="text-blue-600 text-sm mb-8 font-bold">(Free wale saare features + Ye extra fayde)</p>
                        
                        <ul className="space-y-3 text-left w-full pl-8 mb-auto">
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 Better Rewards: Login Bonus Badhkar 10 Credits/Day</li>
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 More Fun: Spin Wheel Limit Badhkar 5 Spins/Day</li>
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 Full Access: Full MCQs Unlocked (Sab kuch)</li>
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 Better Notes: Premium Notes (Standard)</li>
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 Visual Learning: AI Videos (2D Basic)</li>
                            <li className="flex items-center gap-3 text-slate-800 text-sm font-bold"><Check size={16} className="text-blue-500" /> 🔹 Help: Team Support Access</li>
                        </ul>
                    </div>
                </div>

                {/* ULTRA CARD */}
                <div className={`absolute inset-0 bg-gradient-to-b from-purple-900 to-indigo-900 rounded-3xl p-6 transition-all duration-700 ease-in-out transform ${slide === 2 ? 'opacity-100 translate-x-0 scale-100 z-30' : 'opacity-0 translate-x-full scale-90 z-10'}`}>
                    <div className="h-full flex flex-col items-center text-center text-white border-2 border-yellow-400 rounded-3xl relative overflow-hidden shadow-2xl shadow-purple-500/50">
                        <div className="absolute top-4 right-4 animate-bounce"><Crown size={24} className="text-yellow-400" /></div>
                        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 mt-6 backdrop-blur-sm border border-white/20">
                            <Crown size={40} className="text-yellow-400" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">👑 Ultra Plan</h2>
                        <p className="text-purple-200 text-sm mb-8 font-bold">(Sabse Top Features)</p>
                        
                        <ul className="space-y-3 text-left w-full pl-8 mb-auto">
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Max Rewards: Login Bonus Badhkar 20 Credits/Day</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Max Fun: Spin Wheel Limit Badhkar 10 Spins/Day</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Deep Learning: Deep Concept Long Videos & 2D + 3D Deep Dive AI Videos</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Best Material: Detailed Multi-Part Notes & Diagrams</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Competition: Competitive Mode Unlocked 🏆</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 VIP Status: VIP Badge & Custom Profile</li>
                            <li className="flex items-center gap-3 text-white text-sm font-bold"><Check size={16} className="text-yellow-400" /> 👑 Direct Access: Direct Teacher Support</li>
                        </ul>

                        <div className="flex flex-col gap-2 w-full mt-4">
                            <button 
                                onClick={onUpgrade}
                                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black py-4 rounded-xl shadow-lg animate-pulse"
                            >
                                GET ULTRA NOW
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* INDICATORS */}
            <div className="flex justify-center gap-2 mt-6">
                {[0, 1, 2].map(i => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-300 ${slide === i ? 'w-8 bg-white' : 'w-2 bg-white/30'}`} />
                ))}
            </div>
        </div>
    </div>
  );
};

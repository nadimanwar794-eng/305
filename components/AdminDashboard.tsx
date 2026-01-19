
import React, { useEffect, useState, useRef } from 'react';
import { User, ViewState, SystemSettings, Subject, Chapter, MCQItem, RecoveryRequest, ActivityLogEntry, LeaderboardEntry, RecycleBinItem, Stream, Board, ClassLevel, GiftCode, SubscriptionPlan, CreditPackage, WatermarkConfig, SpinReward, HtmlModule, PremiumNoteSlot, ContentInfoConfig, ContentInfoItem, SubscriptionHistoryEntry } from '../types';
import { Users, Search, Trash2, Save, X, Eye, Shield, Megaphone, CheckCircle, ListChecks, Database, FileText, Monitor, Sparkles, Banknote, BrainCircuit, AlertOctagon, ArrowLeft, Key, Bell, ShieldCheck, Lock, Globe, Layers, Zap, PenTool, RefreshCw, RotateCcw, Plus, LogOut, Download, Upload, CreditCard, Ticket, Video, Image as ImageIcon, Type, Link, FileJson, Activity, AlertTriangle, Gift, Book, Mail, Edit3, MessageSquare, ShoppingBag, Cloud, Rocket, Code2, Layers as LayersIcon, Wifi, WifiOff, Copy, Crown, Gamepad2, Calendar, BookOpen, Image, HelpCircle, Youtube, Play, Star, Trophy, Palette } from 'lucide-react';
import { getSubjectsList, DEFAULT_SUBJECTS, DEFAULT_APP_FEATURES, DEFAULT_CONTENT_INFO_CONFIG, ADMIN_PERMISSIONS } from '../constants';
import { fetchChapters, fetchLessonContent } from '../services/gemini';
import { saveChapterData, bulkSaveLinks, checkFirebaseConnection, saveSystemSettings, subscribeToUsers, rtdb, saveUserToLive, db, getChapterData, saveCustomSyllabus, deleteCustomSyllabus } from '../firebase'; // IMPORT FIREBASE
import { ref, set, onValue, update, push } from "firebase/database";
import { doc, deleteDoc } from "firebase/firestore";
import { SimpleRichTextEditor } from './SimpleRichTextEditor';
import { ImageCropper } from './ImageCropper';
import { DEFAULT_SYLLABUS, MonthlySyllabus } from '../syllabus_data';
import { CustomAlert } from './CustomDialogs';
import { AdminDevAssistant } from './AdminDevAssistant';
import { UniversalChat } from './UniversalChat';
import { ChallengeCreator20 } from './admin/ChallengeCreator20';
// @ts-ignore
import JSZip from 'jszip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF Worker (CDN for stability)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  onNavigate: (view: ViewState) => void;
  settings?: SystemSettings;
  onUpdateSettings?: (s: SystemSettings) => void;
  onImpersonate?: (user: User) => void;
  logActivity: (action: string, details: string) => void;
}

// --- TAB DEFINITIONS ---
type AdminTab = 
  | 'DASHBOARD' 
  | 'USERS' 
  | 'SUBSCRIPTION_MANAGER'
  | 'CODES'
  | 'SUBJECTS_MGR'
  | 'LEADERBOARD' 
  | 'NOTICES' 
  | 'DATABASE'
  | 'DEPLOY'         
  | 'ACCESS' 
  | 'SUB_ADMINS'
  | 'LOGS' 
  | 'DEMAND' 
  | 'RECYCLE' 
  | 'SYLLABUS_MANAGER' 
  | 'CONTENT_PDF' 
  | 'CONTENT_VIDEO'
  | 'CONTENT_MCQ' 
  | 'CONTENT_TEST' 
      /* | 'CONTENT_NOTES' - REMOVED */
  | 'BULK_UPLOAD'    
  | 'CONFIG_GENERAL' 
  | 'CONFIG_SECURITY' 
  | 'CONFIG_VISIBILITY' 
  | 'CONFIG_AI' 
  | 'CONFIG_ADS' 
  | 'CONFIG_GAME'
  | 'CONFIG_PAYMENT'
  | 'CONFIG_EXTERNAL_APPS'
  | 'PRICING_MGMT'
  | 'SUBSCRIPTION_PLANS_EDITOR'
  | 'CONFIG_REWARDS'
  | 'FEATURED_CONTENT'
  | 'CONFIG_CHAT'
  | 'CONFIG_FEATURES'
  | 'CONFIG_WATERMARK'
  | 'CONFIG_INFO' // NEW: Info Popups
  | 'UNIVERSAL_PLAYLIST'
  | 'CONFIG_POPUP_THREE_TIER'
  | 'CONFIG_CHALLENGE'
  | 'CHALLENGE_CREATOR_20'
  | 'AI_STUDIO';

interface ContentConfig {
    freeLink?: string;
    premiumLink?: string;
    freeVideoLink?: string;
    premiumVideoLink?: string;
    freeNotesHtml?: string;
    premiumNotesHtml?: string;
    videoCreditsCost?: number;
    price?: number;
    ultraPdfLink?: string;
    ultraPdfPrice?: number;
    aiImageLink?: string; // NEW: AI Generated Image Notes
    aiHtmlContent?: string; // NEW: AI HTML Notes
    aiImagePrice?: number; // Price for AI Image Notes
    chapterAiImage?: string; // NEW: Per-Chapter AI Loading Image
    watermarkText?: string; // NEW: Watermark Text
    watermarkConfig?: WatermarkConfig; // NEW: Full Config
    schoolVideoPlaylist?: {title: string, url: string, price?: number, access?: 'FREE' | 'BASIC' | 'ULTRA'}[];
    competitionVideoPlaylist?: {title: string, url: string, price?: number, access?: 'FREE' | 'BASIC' | 'ULTRA'}[];
    schoolPdfLink?: string;
    schoolPdfPrice?: number;
    competitionPdfLink?: string;
    competitionPdfPrice?: number;
    schoolPdfPremiumSlots?: PremiumNoteSlot[];
    competitionPdfPremiumSlots?: PremiumNoteSlot[];
    videoPlaylist?: {title: string, url: string, price?: number, access?: 'FREE' | 'BASIC' | 'ULTRA'}[]; // Legacy
    htmlModules?: HtmlModule[]; // NEW: HTML Modules
    premiumNoteSlots?: PremiumNoteSlot[]; // NEW: 20 Slots for Premium Notes
    manualMcqData?: MCQItem[];
    weeklyTestMcqData?: MCQItem[];
}

interface Props {
  onNavigate: (view: ViewState) => void;
  settings?: SystemSettings;
  onUpdateSettings?: (s: SystemSettings) => void;
  onImpersonate?: (user: User) => void;
  logActivity: (action: string, details: string) => void;
  user?: User; // Pass current user to check permissions
}

export const AdminDashboard: React.FC<Props> = ({ onNavigate, settings, onUpdateSettings, onImpersonate, logActivity }) => {
  // --- GLOBAL STATE ---
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  
  // CURRENT USER CONTEXT (From Props or LocalStorage if missing)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
      const stored = localStorage.getItem('nst_current_user');
      if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  // --- PERMISSION HELPER ---
  const hasPermission = (perm: string) => {
      if (!currentUser) return false;
      if (currentUser.role === 'ADMIN') return true; // Main Admin has all
      if (currentUser.role === 'SUB_ADMIN') {
          return (currentUser.permissions || []).includes(perm);
      }
      return false;
  };

  const [universalVideos, setUniversalVideos] = useState<any[]>([]);
  const [aiGenType, setAiGenType] = useState<ContentType>('NOTES_SIMPLE');
  const [aiPreview, setAiPreview] = useState<LessonContent | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // UNIVERSAL PLAYLIST LOADER
  useEffect(() => {
      if (activeTab === 'UNIVERSAL_PLAYLIST') {
          getChapterData('nst_universal_playlist').then(data => {
              if (data && data.videoPlaylist) setUniversalVideos(data.videoPlaylist);
              else setUniversalVideos([]);
          });
      }
  }, [activeTab]);

  const saveUniversalPlaylist = async () => {
      await saveChapterData('nst_universal_playlist', { videoPlaylist: universalVideos });
      alert("Universal Playlist Saved!");
  };
  const [showAdminAi, setShowAdminAi] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  
  // NOTIFICATION STATE
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const prevUsersRef = useRef<User[]>([]);

  // --- DATA LISTS ---
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>([]);
  const [demands, setDemands] = useState<{id:string, details:string, timestamp:string}[]>([]);
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);

  // --- DATABASE EDITOR ---
  const [dbKey, setDbKey] = useState('nst_users');
  const [dbContent, setDbContent] = useState('');

  // Calculate Online Users (Active in last 5 mins)
  const onlineCount = users.filter(u => {
      if (!u.lastActiveTime) return false;
      try {
          const diff = Date.now() - new Date(u.lastActiveTime).getTime();
          return diff < 5 * 60 * 1000;
      } catch(e) { return false; }
  }).length;

  // --- IMAGE CROPPER STATE ---
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // --- SETTINGS STATE ---
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings || {
      appName: 'IDEAL INSPIRATION CLASSES',
      themeColor: '#3b82f6',
      maintenanceMode: false,
      maintenanceMessage: 'We are upgrading our servers.',
      customCSS: '',
      apiKeys: [],
      adminCode: '', adminEmail: '', adminPhones: [{id: '1', number: '8227070298', name: 'Admin', isDefault: true}], footerText: 'Developed by Nadim Anwar',
      showFooter: true,
      footerColor: '',
      welcomeTitle: 'Unlock Smart Learning', 
      welcomeMessage: 'Experience the power of AI-driven education. IIC AI filters out the noise of traditional textbooks to deliver only the essential, high-yield topics you need for success. Study smarter, not harder.',
      termsText: 'By using this app, you agree to our terms. Content is for personal use only. Sharing accounts may lead to a permanent ban.', supportEmail: 'nadiman0636indo@gmail.com', aiModel: 'gemini-2.5-flash',
      aiInstruction: '',
      marqueeLines: ["Welcome to IIC ONLINE CLASSES"],
      liveMessage1: '', liveMessage2: '',
      wheelRewards: [0,1,2,5],
      chatCost: 1, dailyReward: 3, signupBonus: 2,
      isChatEnabled: true, isGameEnabled: true, allowSignup: true, loginMessage: '',
      gameCost: 0, spinLimitUltra: 10, spinLimitBasic: 5, spinLimitFree: 2,
      allowedClasses: ['6', '7', '8', '9', '10', '11', '12'],
      allowedBoards: ['CBSE', 'BSEB'], allowedStreams: ['Science', 'Commerce', 'Arts'],
      hiddenSubjects: [], storageCapacity: '100 GB',
      isPaymentEnabled: true, upiId: '', upiName: '', qrCodeUrl: '', paymentInstructions: '',
      syllabusType: 'DUAL',
      playerBrandingText: 'NSTA',
      playerBlockShare: true,
      packages: [
          { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
          { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
          { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
          { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
          { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
          { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
          { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
      ],
      subscriptionPlans: [
          { id: 'weekly', name: 'Weekly', duration: '7 days', basicPrice: 49, basicOriginalPrice: 99, ultraPrice: 79, ultraOriginalPrice: 149, features: ['Premium Content'], popular: false },
          { id: 'monthly', name: 'Monthly', duration: '30 days', basicPrice: 149, basicOriginalPrice: 299, ultraPrice: 199, ultraOriginalPrice: 399, features: ['Everything in Weekly', 'Live Chat'], popular: true },
          { id: 'quarterly', name: 'Quarterly', duration: '3 months', basicPrice: 399, basicOriginalPrice: 799, ultraPrice: 499, ultraOriginalPrice: 999, features: ['Everything in Monthly', 'Priority Support'], popular: false },
          { id: 'yearly', name: 'Yearly', duration: '365 days', basicPrice: 999, basicOriginalPrice: 1999, ultraPrice: 1499, ultraOriginalPrice: 2999, features: ['Everything in Quarterly', 'Priority Support'], popular: false },
          { id: 'lifetime', name: 'Lifetime', duration: 'Forever', basicPrice: 4999, basicOriginalPrice: 9999, ultraPrice: 7499, ultraOriginalPrice: 14999, features: ['VIP Status'], popular: true }
      ],
      startupAd: { 
          enabled: true, 
          duration: 10, 
          title: "🚀 UPGRADE TO ULTRA PREMIUM", 
          features: [
              "💎 All Subject PDF Notes Unlocked",
              "🎥 Ad-Free 4K Video Lectures",
              "🏆 Exclusive Weekly Mock Tests",
              "🤖 AI Homework Helper Access",
              "📉 Detailed Performance Analytics",
              "🏅 VIP Badge on Leaderboard",
              "🎁 Monthly 500 Bonus Credits",
              "📞 1-on-1 Teacher Support",
              "🔄 Offline Video Download Mode",
              "📅 Personal Study Planner"
          ], 
          bgColor: "#581c87", 
          textColor: "#ffffff" 
      },
      featurePopup: {
      enabled: true,
      intervalMinutes: 60,
      freeFeatures: [
        "📝 Normal Video Lessons",
        "📄 Basic Subject Notes",
        "❓ Chapter MCQs (Limit: 50)",
        "📈 Daily Study Streak Tracker",
        "🎮 2 Daily Spin Wheel Games",
        "📱 Mobile Access Anywhere",
        "🏆 Global Leaderboard View",
        "📅 Academic Calendar Support",
        "💬 Public Chatroom Access",
        "🎁 Daily 3-Coin Login Bonus"
      ],
      premiumFeatures: [
        "💎 Deep Concept Long Videos",
        "🎞️ Animated Educational Content",
        "📚 Detailed Multi-Part Notes",
        "🖼️ Diagrams & Visual Figures",
        "🎰 Unlimited Spin (100+ daily)",
        "❓ Full Chapter MCQs Access",
        "🏆 Weekly Pro Mock Tests & Prizes",
        "🏅 VIP Badge & Custom Profile",
        "🎁 500+ Monthly Bonus Credits",
        "📞 Direct Teacher Support Access",
        "🔄 Offline Video Downloads"
      ],
      showToPremiumUsers: true,
      showNearExpiryHours: 24
    },
    dailyChallengeConfig: {
      mode: 'AUTO',
      rewardPercentage: 90,
      selectedChapterIds: []
    },
    themeConfig: {
      freeTheme: 'BASIC',
      enableTop3Gold: true
    }
  });

  // SYNC WITH PROP UPDATES (Ensure Admin sees live changes)
  useEffect(() => {
      if (settings) {
          setLocalSettings(prev => ({ ...prev, ...settings }));
      }
  }, [settings]);

  // --- PACKAGE MANAGER STATE ---
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [newPkgCredits, setNewPkgCredits] = useState('');

  // --- CONTENT SELECTION STATE ---
  const [selBoard, setSelBoard] = useState<Board>('CBSE');
  const [selClass, setSelClass] = useState<ClassLevel>('10');
  const [selStream, setSelStream] = useState<Stream>('Science');
  const [selSubject, setSelSubject] = useState<Subject | null>(null);
  const [selChapters, setSelChapters] = useState<Chapter[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  
  // --- BULK UPLOAD STATE ---
  const [bulkData, setBulkData] = useState<Record<string, {free: string, premium: string, price: number}>>({});

  // --- EDITING STATE ---
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [syllabusMode, setSyllabusMode] = useState<'SCHOOL' | 'COMPETITION'>('SCHOOL');

  // Helper to get correct field based on mode
  const getModeField = (baseField: string) => {
    if (syllabusMode === 'SCHOOL') return `school${baseField.charAt(0).toUpperCase() + baseField.slice(1)}`;
    return `competition${baseField.charAt(0).toUpperCase() + baseField.slice(1)}`;
  };

  const handleModeSwitch = (newMode: 'SCHOOL' | 'COMPETITION') => {
      if (newMode === syllabusMode) return;
      
      // 1. Save current UI state to local config
      const currentVideoField = syllabusMode === 'SCHOOL' ? 'schoolVideoPlaylist' : 'competitionVideoPlaylist';
      const currentSlotsField = syllabusMode === 'SCHOOL' ? 'schoolPdfPremiumSlots' : 'competitionPdfPremiumSlots';
      
      const updatedConfig = {
          ...editConfig,
          [currentVideoField]: videoPlaylist,
          [currentSlotsField]: premiumNoteSlots
      };
      setEditConfig(updatedConfig);

      // 2. Load new mode data
      // STRICT SEPARATION: Only fallback to legacy for SCHOOL mode
      if (newMode === 'SCHOOL') {
          // @ts-ignore
          setVideoPlaylist(updatedConfig.schoolVideoPlaylist || updatedConfig.videoPlaylist || []);
          // @ts-ignore
          setPremiumNoteSlots(updatedConfig.schoolPdfPremiumSlots || updatedConfig.premiumNoteSlots || []);
      } else {
          // @ts-ignore
          setVideoPlaylist(updatedConfig.competitionVideoPlaylist || []);
          // @ts-ignore
          setPremiumNoteSlots(updatedConfig.competitionPdfPremiumSlots || []);
      }
      
      setSyllabusMode(newMode);
  };

  const [isContentLoading, setIsContentLoading] = useState(false);
  const [editConfig, setEditConfig] = useState<ContentConfig>({ freeLink: '', premiumLink: '', price: 0 });
  const [videoPlaylist, setVideoPlaylist] = useState<{title: string, url: string, price?: number, access?: 'FREE' | 'BASIC' | 'ULTRA'}[]>([]);
  const [premiumNoteSlots, setPremiumNoteSlots] = useState<PremiumNoteSlot[]>([]);
  const [editingMcqs, setEditingMcqs] = useState<MCQItem[]>([]);
  const [editingTestMcqs, setEditingTestMcqs] = useState<MCQItem[]>([]);
  const [importText, setImportText] = useState('');
  const [syllabusImportText, setSyllabusImportText] = useState('');
  
  // --- PDF PREVIEW STATE ---
  const [previewPdfFile, setPreviewPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
      setNumPages(numPages);
  }

  // --- PRICING MANAGEMENT STATE ---
  const [editingPlanIdx, setEditingPlanIdx] = useState<number | null>(null);
  const [editingPkg, setEditingPkg] = useState<{id: string, name: string, credits: number, price: number} | null>(null);
  
  // --- SUB-ADMIN STATE ---
  const [subAdminSearch, setSubAdminSearch] = useState('');
  const [newSubAdminId, setNewSubAdminId] = useState('');
  const [viewingSubAdminReport, setViewingSubAdminReport] = useState<string | null>(null);
  
  // --- USER EDIT MODAL STATE ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserCredits, setEditUserCredits] = useState(0);
  const [editUserPass, setEditUserPass] = useState('');
  const [dmText, setDmText] = useState('');
  const [dmUser, setDmUser] = useState<User | null>(null);
  const [giftType, setGiftType] = useState<'NONE' | 'CREDITS' | 'SUBSCRIPTION' | 'ANIMATION'>('NONE');
  const [giftValue, setGiftValue] = useState<string | number>('');
  const [giftDuration, setGiftDuration] = useState(24); // Hours
  const [editSubscriptionTier, setEditSubscriptionTier] = useState<'FREE' | 'WEEKLY' | 'MONTHLY' | '3_MONTHLY' | 'YEARLY' | 'LIFETIME' | 'CUSTOM'>('FREE');
  const [editSubscriptionLevel, setEditSubscriptionLevel] = useState<'BASIC' | 'ULTRA'>('BASIC');
  const [editSubscriptionYears, setEditSubscriptionYears] = useState(0);
  const [editSubscriptionMonths, setEditSubscriptionMonths] = useState(0);
  const [editSubscriptionDays, setEditSubscriptionDays] = useState(0);
  const [editSubscriptionHours, setEditSubscriptionHours] = useState(0);
  const [editSubscriptionMinutes, setEditSubscriptionMinutes] = useState(0);
  const [editSubscriptionSeconds, setEditSubscriptionSeconds] = useState(0);
  const [editSubscriptionPrice, setEditSubscriptionPrice] = useState(0);
  const [editCustomSubName, setEditCustomSubName] = useState('');
  
  // SUBSCRIPTION PRICES (ADMIN CUSTOMIZABLE)
  const [subPrices, setSubPrices] = useState<{
    WEEKLY: { BASIC: number, ULTRA: number },
    MONTHLY: { BASIC: number, ULTRA: number },
    "3_MONTHLY": { BASIC: number, ULTRA: number },
    YEARLY: { BASIC: number, ULTRA: number },
    LIFETIME: { BASIC: number, ULTRA: number }
  }>({
      WEEKLY: { BASIC: 49, ULTRA: 99 },
      MONTHLY: { BASIC: 199, ULTRA: 399 },
      "3_MONTHLY": { BASIC: 499, ULTRA: 899 },
      YEARLY: { BASIC: 999, ULTRA: 1999 },
      LIFETIME: { BASIC: 4999, ULTRA: 9999 }
  });

  // Sync subPrices with localSettings
  useEffect(() => {
      if (localSettings.subscriptionPlans) {
          const newPrices = { ...subPrices };
          localSettings.subscriptionPlans.forEach((plan: any) => {
              const tier = plan.id.toUpperCase() as keyof typeof subPrices;
              if (newPrices[tier]) {
                  newPrices[tier].BASIC = plan.basicPrice || newPrices[tier].BASIC;
                  newPrices[tier].ULTRA = plan.ultraPrice || newPrices[tier].ULTRA;
              }
          });
          setSubPrices(newPrices);
      }
  }, [localSettings.subscriptionPlans]);

  // --- LOGO BACKGROUND CONFIG ---
  const logoBgColor = localSettings.themeColor || '#000000'; // Admin can customize via theme color or we can add specific field

  const updatePriceForSelection = (tier: typeof editSubscriptionTier, level: typeof editSubscriptionLevel) => {
      if (tier !== 'FREE' && tier !== 'CUSTOM') {
          const tierPrices = subPrices[tier as keyof typeof subPrices];
          if (tierPrices) {
              setEditSubscriptionPrice(tierPrices[level]);
          }
      } else if (tier === 'CUSTOM') {
          setEditSubscriptionPrice(0);
      }
  };
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  

  const handleBulkGenerateMCQs = async () => {
      if (!selSubject || !editingChapterId) {
          alert("Please select a subject and chapter first.");
          return;
      }
      setIsGeneratingBulk(true);
      try {
          const content = await fetchLessonContent(
              selBoard,
              selClass,
              selStream,
              selSubject,
              { id: editingChapterId, title: selChapters.find(c => c.id === editingChapterId)?.title || 'Chapter' },
              state.language,
              'MCQ_SIMPLE',
              0,
              true,
              200, // User requested 200 MCQ
              "",
              true
          );
          if (content && content.mcqData) {
              setEditingMcqs(content.mcqData);
              alert(`Successfully generated ${content.mcqData.length} MCQs!`);
          }
      } catch (error) {
          console.error("Bulk Gen Error:", error);
          alert("Failed to generate bulk MCQs. Check API keys.");
      } finally {
          setIsGeneratingBulk(false);
      }
  };

  // --- GIFT CODE STATE ---
  const [newCodeType, setNewCodeType] = useState<'CREDITS' | 'SUBSCRIPTION'>('CREDITS');
  const [newCodeAmount, setNewCodeAmount] = useState(10);
  const [newCodeSubTier, setNewCodeSubTier] = useState<any>('WEEKLY');
  const [newCodeSubLevel, setNewCodeSubLevel] = useState<any>('BASIC');
  const [newCodeCount, setNewCodeCount] = useState(1);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1); // Default 1 (Single Use)

  // --- SPIN GAME CONFIG STATE ---
  const [newReward, setNewReward] = useState<SpinReward>({ id: '', type: 'COINS', value: 10, label: '10 Coins', color: '#3b82f6' });

  // --- CHAT MANAGER STATE ---
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');

  // --- SUBJECT MANAGER STATE ---
  const [customSubjects, setCustomSubjects] = useState<any>({});
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('book');
  const [newSubColor, setNewSubColor] = useState('bg-slate-50 text-slate-600');

  // --- WEEKLY TEST CREATION STATE ---
  const [testName, setTestName] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [testDuration, setTestDuration] = useState(120);
  const [testPassScore, setTestPassScore] = useState(50);
  const [testSelectedSubjects, setTestSelectedSubjects] = useState<string[]>([]);
  const [testSelectedChapters, setTestSelectedChapters] = useState<string[]>([]);
  const [testClassLevel, setTestClassLevel] = useState<ClassLevel>('10');

  // --- WEEKLY TEST SAVE HANDLER (NEW) ---
  const handleSaveWeeklyTest = () => {
      if (!testName || editingTestMcqs.length === 0) {
          alert("Please provide a Test Name and add at least one question.");
          return;
      }

      const newTest = {
          id: `test-${Date.now()}`,
          name: testName,
          description: testDesc,
          isActive: true,
          classLevel: testClassLevel,
          questions: editingTestMcqs,
          totalQuestions: editingTestMcqs.length,
          passingScore: testPassScore,
          createdAt: new Date().toISOString(),
          durationMinutes: testDuration,
          selectedSubjects: testSelectedSubjects,
          selectedChapters: testSelectedChapters,
          autoSubmitEnabled: true
      };

      const updatedTests = [...(localSettings.weeklyTests || []), newTest];
      setLocalSettings({...localSettings, weeklyTests: updatedTests});
      
      // Save immediately
      localStorage.setItem('nst_system_settings', JSON.stringify({...localSettings, weeklyTests: updatedTests}));
      
      // Reset Form
      setTestName('');
      setTestDesc('');
      setEditingTestMcqs([]);
      setTestSelectedSubjects([]);
      setTestSelectedChapters([]);
      alert("✅ Weekly Test Created Successfully!");
  };

  // --- INITIAL LOAD & AUTO REFRESH ---
  useEffect(() => {
      loadData();
      
      // Initial Check
      setIsFirebaseConnected(checkFirebaseConnection());
      
      const interval = setInterval(() => {
          loadData();
          // Poll Connection Status
          setIsFirebaseConnected(checkFirebaseConnection());
      }, 5000); 

      // SUBSCRIBE TO USERS (Live Sync)
      const unsubUsers = subscribeToUsers((cloudUsers) => {
          if (cloudUsers && cloudUsers.length > 0) {
              // 1. Detect New Users (Real-time)
              const prevUsers = prevUsersRef.current;
              if (prevUsers.length > 0) { 
                  const newUsers = cloudUsers.filter(u => !prevUsers.some(p => p.id === u.id));
                  if (newUsers.length > 0) {
                      const names = newUsers.map(u => u.name).join(', ');
                      // Disabled new user popup as per request
                      // setAlertConfig({
                      //     isOpen: true, 
                      //     message: `🎉 New Student Registered: ${names}`
                      // });
                  }
              }

              // 2. Sort by CreatedAt DESC (Newest First)
              const sortedUsers = [...cloudUsers].sort((a,b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return dateB - dateA;
              });

              setUsers(sortedUsers);
              prevUsersRef.current = sortedUsers;
              localStorage.setItem('nst_users', JSON.stringify(sortedUsers));
          }
      });

      // SUBSCRIBE TO RECOVERY REQUESTS (Live Sync)
      const reqRef = ref(rtdb, 'recovery_requests');
      const unsubReqs = onValue(reqRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
              const reqList: RecoveryRequest[] = Object.values(data);
              setRecoveryRequests(reqList.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
              setRecoveryRequests([]);
          }
      });

      return () => {
          clearInterval(interval);
          unsubUsers();
          unsubReqs();
      };
  }, []);

  useEffect(() => {
      if (activeTab === 'DATABASE') {
          setDbContent(localStorage.getItem(dbKey) || '');
      }
  }, [activeTab, dbKey]);

  // Clear selections when switching main tabs
  useEffect(() => {
      if (!['SYLLABUS_MANAGER', 'CONTENT_PDF', 'CONTENT_VIDEO', 'CONTENT_MCQ', 'CONTENT_TEST', 'CONTENT_NOTES', 'CONTENT_HTML', 'BULK_UPLOAD'].includes(activeTab)) {
          setSelSubject(null);
          setEditingChapterId(null);
      }
  }, [activeTab]);

  const handleCropComplete = (croppedImage: string) => {
      setLocalSettings({ ...localSettings, appLogo: croppedImage });
      setCropImageSrc(null);
  };

  const loadData = () => {
      const storedUsersStr = localStorage.getItem('nst_users');
      if (storedUsersStr) setUsers(JSON.parse(storedUsersStr));
      
      const demandStr = localStorage.getItem('nst_demand_requests');
      if (demandStr) setDemands(JSON.parse(demandStr));

      // const reqStr = localStorage.getItem('nst_recovery_requests');
      // if (reqStr) setRecoveryRequests(JSON.parse(reqStr));

      const logsStr = localStorage.getItem('nst_activity_log');
      if (logsStr) setLogs(JSON.parse(logsStr));

      const codesStr = localStorage.getItem('nst_admin_codes');
      if (codesStr) setGiftCodes(JSON.parse(codesStr));

      const subStr = localStorage.getItem('nst_custom_subjects_pool');
      if (subStr) setCustomSubjects(JSON.parse(subStr));

      const binStr = localStorage.getItem('nst_recycle_bin');
      if (binStr) {
          const binItems: RecycleBinItem[] = JSON.parse(binStr);
          const now = new Date();
          const validItems = binItems.filter(item => new Date(item.expiresAt) > now);
          if (validItems.length !== binItems.length) {
              localStorage.setItem('nst_recycle_bin', JSON.stringify(validItems));
          }
          setRecycleBin(validItems);
      }

      const boardNotesStr = localStorage.getItem('nst_board_notes');
      if (boardNotesStr) setBoardNotes(JSON.parse(boardNotesStr));

  };

  // --- SETTINGS HANDLERS ---
  // --- DRAGGABLE BUTTON STATE ---
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: buttonPos.x,
      initialY: buttonPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setButtonPos({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);



  const renderWatermarkConfig = () => (
    <div className="p-6 space-y-8 animate-in fade-in">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-2xl font-black text-slate-800">Watermark Settings</h2>
                <p className="text-slate-500">Customize how your watermark appears on the video player.</p>
            </div>
            <button 
                onClick={handleSaveSettings}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
            >
                <Save size={20} /> Save Changes
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">Show Watermark</p>
                                <p className="text-xs text-slate-500">Enable or disable video overlay</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setLocalSettings({
                                ...localSettings,
                                watermarkConfig: { 
                                    ...(localSettings.watermarkConfig || {
                                        text: localSettings.appName || 'IIC',
                                        opacity: 0.2,
                                        color: '#ffffff',
                                        backgroundColor: 'transparent',
                                        fontSize: 24,
                                        isRepeating: true,
                                        positionX: 50,
                                        positionY: 50,
                                        rotation: -12,
                                        enabled: true
                                    }),
                                    enabled: !localSettings.watermarkConfig?.enabled 
                                }
                            })}
                            className={`w-14 h-8 rounded-full transition-all relative ${localSettings.watermarkConfig?.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${localSettings.watermarkConfig?.enabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-sm font-bold text-slate-700 ml-1">Watermark Text</span>
                            <input 
                                type="text"
                                value={localSettings.watermarkConfig?.text || ''}
                                onChange={(e) => setLocalSettings({
                                    ...localSettings,
                                    watermarkConfig: { ...(localSettings.watermarkConfig || {}), text: e.target.value } as any
                                })}
                                className="w-full mt-2 p-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-100"
                                placeholder="Enter watermark text..."
                            />
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 ml-1">Font Size (px)</span>
                                <input 
                                    type="number"
                                    value={localSettings.watermarkConfig?.fontSize || 24}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        watermarkConfig: { ...(localSettings.watermarkConfig || {}), fontSize: parseInt(e.target.value) } as any
                                    })}
                                    className="w-full mt-2 p-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-medium"
                                />
                            </label>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 ml-1">Rotation (deg)</span>
                                <input 
                                    type="number"
                                    value={localSettings.watermarkConfig?.rotation || 0}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        watermarkConfig: { ...(localSettings.watermarkConfig || {}), rotation: parseInt(e.target.value) } as any
                                    })}
                                    className="w-full mt-2 p-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-medium"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 ml-1">Text Color</span>
                                <div className="flex gap-2 mt-2">
                                    <input 
                                        type="color"
                                        value={localSettings.watermarkConfig?.color || '#ffffff'}
                                        onChange={(e) => setLocalSettings({
                                            ...localSettings,
                                            watermarkConfig: { ...(localSettings.watermarkConfig || {}), color: e.target.value } as any
                                        })}
                                        className="w-12 h-12 rounded-xl cursor-pointer border-none p-0"
                                    />
                                    <input 
                                        type="text"
                                        value={localSettings.watermarkConfig?.color || '#ffffff'}
                                        onChange={(e) => setLocalSettings({
                                            ...localSettings,
                                            watermarkConfig: { ...(localSettings.watermarkConfig || {}), color: e.target.value } as any
                                        })}
                                        className="flex-1 p-3 bg-slate-50 border-none rounded-xl text-xs uppercase"
                                    />
                                </div>
                            </label>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 ml-1">Opacity (%)</span>
                                <input 
                                    type="range"
                                    min="0" max="1" step="0.1"
                                    value={localSettings.watermarkConfig?.opacity || 0.2}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        watermarkConfig: { ...(localSettings.watermarkConfig || {}), opacity: parseFloat(e.target.value) } as any
                                    })}
                                    className="w-full mt-4 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1 px-1">
                                    <span>0%</span>
                                    <span>100%</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            <LayersIcon size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800">Layout Style</h3>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            onClick={() => setLocalSettings({
                                ...localSettings,
                                watermarkConfig: { ...(localSettings.watermarkConfig || {}), isRepeating: true } as any
                            })}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${localSettings.watermarkConfig?.isRepeating ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                        >
                            <p className="font-bold">Grid Pattern</p>
                            <p className="text-[10px] opacity-70">Repeats everywhere</p>
                        </button>
                        <button 
                            onClick={() => setLocalSettings({
                                ...localSettings,
                                watermarkConfig: { ...(localSettings.watermarkConfig || {}), isRepeating: false } as any
                            })}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${!localSettings.watermarkConfig?.isRepeating ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                        >
                            <p className="font-bold">Fixed Position</p>
                            <p className="text-[10px] opacity-70">Single placement</p>
                        </button>
                    </div>

                    {!localSettings.watermarkConfig?.isRepeating && (
                        <div className="space-y-4 pt-4 border-t border-slate-50 animate-in slide-in-from-top-4">
                            <label className="block">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-700 ml-1">Horizontal Pos (%)</span>
                                    <span className="text-sm font-bold text-blue-600">{localSettings.watermarkConfig?.positionX || 50}%</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0" max="100"
                                    value={localSettings.watermarkConfig?.positionX || 50}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        watermarkConfig: { ...(localSettings.watermarkConfig || {}), positionX: parseInt(e.target.value) } as any
                                    })}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </label>
                            <label className="block">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-700 ml-1">Vertical Pos (%)</span>
                                    <span className="text-sm font-bold text-blue-600">{localSettings.watermarkConfig?.positionY || 50}%</span>
                                </div>
                                <input 
                                    type="range"
                                    min="0" max="100"
                                    value={localSettings.watermarkConfig?.positionY || 50}
                                    onChange={(e) => setLocalSettings({
                                        ...localSettings,
                                        watermarkConfig: { ...(localSettings.watermarkConfig || {}), positionY: parseInt(e.target.value) } as any
                                    })}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest ml-4">
                    <Eye size={14} /> Live Preview
                </div>
                <div className="aspect-video bg-slate-900 rounded-[32px] overflow-hidden border-8 border-white shadow-2xl relative group">
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                         <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                            <Play size={32} className="text-white/40 ml-1" />
                         </div>
                    </div>
                    
                    {localSettings.watermarkConfig?.enabled && (
                        <div 
                            className="absolute pointer-events-none z-10 select-none flex items-center justify-center overflow-hidden"
                            style={{
                                left: localSettings.watermarkConfig.isRepeating ? 0 : `${localSettings.watermarkConfig.positionX}%`,
                                top: localSettings.watermarkConfig.isRepeating ? 0 : `${localSettings.watermarkConfig.positionY}%`,
                                right: localSettings.watermarkConfig.isRepeating ? 0 : 'auto',
                                bottom: localSettings.watermarkConfig.isRepeating ? 0 : 'auto',
                                opacity: localSettings.watermarkConfig.opacity || 0.2,
                                transform: !localSettings.watermarkConfig.isRepeating ? `translate(-50%, -50%) rotate(${localSettings.watermarkConfig.rotation || 0}deg)` : 'none'
                            }}
                        >
                            {localSettings.watermarkConfig.isRepeating ? (
                                <div className="flex flex-col gap-8 items-center justify-center w-full h-full" style={{ transform: `rotate(${localSettings.watermarkConfig.rotation || -12}deg)` }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex gap-8">
                                            {[1, 2, 3].map(j => (
                                                <span 
                                                    key={`${i}-${j}`} 
                                                    className="font-black uppercase tracking-[0.2em] whitespace-nowrap"
                                                    style={{ 
                                                        fontSize: `${(localSettings.watermarkConfig?.fontSize || 24) * 0.6}px`,
                                                        color: localSettings.watermarkConfig.color || '#ffffff',
                                                        backgroundColor: localSettings.watermarkConfig.backgroundColor || 'transparent'
                                                    }}
                                                >
                                                    {localSettings.watermarkConfig.text || localSettings.appName}
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span 
                                    className="font-black uppercase tracking-[0.2em] whitespace-nowrap"
                                    style={{ 
                                        fontSize: `${(localSettings.watermarkConfig?.fontSize || 24) * 0.6}px`,
                                        color: localSettings.watermarkConfig.color || '#ffffff',
                                        backgroundColor: localSettings.watermarkConfig.backgroundColor || 'transparent'
                                    }}
                                >
                                    {localSettings.watermarkConfig.text || localSettings.appName}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="absolute bottom-6 left-6 right-6 h-1 bg-white/20 rounded-full">
                        <div className="w-1/3 h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    </div>
                </div>
                <p className="text-center text-xs text-slate-400 font-medium">The preview above simulates how the watermark will look on student's devices.</p>
            </div>
        </div>
    </div>
  );



  const handleSaveSettings = () => {
      if (onUpdateSettings) {
          onUpdateSettings(localSettings);
          localStorage.setItem('nst_system_settings', JSON.stringify(localSettings));
          
          // SYNC TO FIREBASE
          if (isFirebaseConnected) {
             saveSystemSettings(localSettings);
          }
          
          logActivity("SETTINGS_UPDATE", "Updated system settings");
          alert("Settings Saved to Cloud!");
      }
  };

  const toggleSetting = (key: keyof SystemSettings) => {
      const newVal = !localSettings[key];
      const updated = { ...localSettings, [key]: newVal };
      setLocalSettings(updated);
      if(onUpdateSettings) onUpdateSettings(updated);
      localStorage.setItem('nst_system_settings', JSON.stringify(updated));
      logActivity("SETTINGS_TOGGLED", `Toggled ${key} to ${newVal}`);
  };

  const toggleItemInList = <T extends string>(list: T[] | undefined, item: T): T[] => {
      const current = list || [];
      return current.includes(item) ? current.filter(i => i !== item) : [...current, item];
  };


  // --- RECYCLE BIN HANDLERS ---
  const softDelete = (type: RecycleBinItem['type'], name: string, data: any, originalKey?: string, originalId?: string) => {
      if (!window.confirm(`DELETE "${name}"?\n(Moved to Recycle Bin for 90 days)`)) return false;

      const newItem: RecycleBinItem = {
          id: Date.now().toString(),
          originalId: originalId || Date.now().toString(),
          type,
          name,
          data,
          deletedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          restoreKey: originalKey
      };

      const newBin = [...recycleBin, newItem];
      setRecycleBin(newBin);
      localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      return true;
  };

  const handleRestoreItem = (item: RecycleBinItem) => {
      if (!window.confirm(`Restore "${item.name}"?`)) return;

      if (item.type === 'USER') {
          const stored = localStorage.getItem('nst_users');
          const users: User[] = stored ? JSON.parse(stored) : [];
          if (!users.some(u => u.id === item.data.id)) {
              users.push(item.data);
              localStorage.setItem('nst_users', JSON.stringify(users));
          } else {
              alert("User ID already exists. Cannot restore.");
              return;
          }
      } else if (item.type === 'MCQ_BATCH' && item.restoreKey) {
          const stored = localStorage.getItem(item.restoreKey);
          const current = stored ? JSON.parse(stored) : {};
          const isTest = item.data.isTest;
          if (isTest) {
              current.weeklyTestMcqData = [...(current.weeklyTestMcqData || []), ...item.data.mcqs];
          } else {
              current.manualMcqData = [...(current.manualMcqData || []), ...item.data.mcqs];
          }
          localStorage.setItem(item.restoreKey, JSON.stringify(current));
          if (isFirebaseConnected) saveChapterData(item.restoreKey, current);

      } else if (item.restoreKey) {
          if (item.type === 'CHAPTER') {
              const listStr = localStorage.getItem(item.restoreKey);
              const list = listStr ? JSON.parse(listStr) : [];
              list.push(item.data);
              localStorage.setItem(item.restoreKey, JSON.stringify(list));
          } else {
              localStorage.setItem(item.restoreKey, JSON.stringify(item.data));
          }
      }

      const newBin = recycleBin.filter(i => i.id !== item.id);
      setRecycleBin(newBin);
      localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      alert("Item Restored!");
      loadData(); 
  };

  const handlePermanentDelete = (id: string) => {
      if (window.confirm("PERMANENTLY DELETE? This cannot be undone.")) {
          const newBin = recycleBin.filter(i => i.id !== id);
          setRecycleBin(newBin);
          localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      }
  };

  // --- USER MANAGEMENT (Enhanced) ---
  const deleteUser = async (userId: string) => {
      const userToDelete = users.find(u => u.id === userId);
      if (!userToDelete) return;
      if (softDelete('USER', userToDelete.name, userToDelete, undefined, userToDelete.id)) {
          // Local Update
          const updated = users.filter(u => u.id !== userId);
          setUsers(updated);
          localStorage.setItem('nst_users', JSON.stringify(updated));
          
          // Cloud Update
          if (isFirebaseConnected) {
              try {
                  await deleteDoc(doc(db, "users", userId));
              } catch(e) { console.error("Cloud Delete Error:", e); }
          }

          logActivity("USER_DELETE", `Moved user ${userId} to Recycle Bin`);
      }
  };

  const openEditUser = (user: User) => {
      setEditingUser(user);
      setEditUserCredits(user.credits);
      setEditUserPass(user.password);
      setEditSubscriptionTier(user.subscriptionTier || 'FREE');
      setEditSubscriptionLevel(user.subscriptionLevel || 'BASIC');
      
      // Default customized values based on tier
      if (user.subscriptionTier === 'WEEKLY') setEditSubscriptionDays(7);
      else if (user.subscriptionTier === 'MONTHLY') setEditSubscriptionDays(30);
      else if (user.subscriptionTier === '3_MONTHLY') setEditSubscriptionDays(90);
      else if (user.subscriptionTier === 'YEARLY') setEditSubscriptionDays(365);
      else setEditSubscriptionDays(0);
      
      setEditSubscriptionHours(0);
      setEditSubscriptionMinutes(0);
      setEditSubscriptionSeconds(0);
      
      // Auto-fill price from store settings
      if (user.subscriptionTier && user.subscriptionTier !== 'FREE' && user.subscriptionTier !== 'CUSTOM') {
          const tierPrices = subPrices[user.subscriptionTier as keyof typeof subPrices];
          const level = user.subscriptionLevel || 'BASIC';
          setEditSubscriptionPrice(tierPrices ? tierPrices[level as keyof typeof tierPrices] : 0);
      } else {
          setEditSubscriptionPrice(0);
      }
      
      setEditCustomSubName(user.customSubscriptionName || '');
  };

  const saveEditedUser = async () => {
      if (!editingUser) return;
      
      let endDate = undefined;
      const now = new Date();
      if (editSubscriptionTier !== 'FREE') {
          if (editSubscriptionTier === 'WEEKLY') {
              endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'MONTHLY') {
              endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === '3_MONTHLY') {
              endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'YEARLY') {
              endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'LIFETIME') {
              endDate = null;
          } else if (editSubscriptionTier === 'CUSTOM') {
              const totalMs = (editSubscriptionYears * 365 * 24 * 60 * 60 * 1000) +
                              (editSubscriptionMonths * 30 * 24 * 60 * 60 * 1000) +
                              (editSubscriptionDays * 24 * 60 * 60 * 1000) + 
                              (editSubscriptionHours * 60 * 60 * 1000) + 
                              (editSubscriptionMinutes * 60 * 1000) +
                              (editSubscriptionSeconds * 1000);
              endDate = new Date(now.getTime() + totalMs);
          }
      }

      const isoEndDate = endDate ? endDate.toISOString() : (endDate === null ? undefined : undefined);

      // RECORD HISTORY
      let newHistory = editingUser.subscriptionHistory || [];
      if (editSubscriptionTier !== 'FREE') {
          const historyEntry: SubscriptionHistoryEntry = {
              id: `hist-${Date.now()}`,
              tier: editSubscriptionTier,
              level: editSubscriptionLevel,
              startDate: now.toISOString(),
              endDate: isoEndDate || 'LIFETIME',
              durationHours: endDate ? Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60)) : 999999,
              price: 0,
              originalPrice: editSubscriptionPrice,
              isFree: true,
              grantSource: 'ADMIN'
          };
          newHistory = [historyEntry, ...newHistory];
      }

      const updatedUser: User = { 
          ...editingUser, 
          credits: editUserCredits, 
          password: editUserPass,
          subscriptionTier: editSubscriptionTier,
          subscriptionLevel: editSubscriptionLevel,
          subscriptionEndDate: isoEndDate,
          subscriptionPrice: editSubscriptionPrice,
          grantedByAdmin: true,
          isPremium: editSubscriptionTier !== 'FREE',
          subscriptionHistory: newHistory,
          customSubscriptionName: editSubscriptionTier === 'CUSTOM' ? editCustomSubName : undefined,
          customSubscriptionDuration: editSubscriptionTier === 'CUSTOM' ? {
              years: editSubscriptionYears,
              months: editSubscriptionMonths,
              days: editSubscriptionDays,
              hours: editSubscriptionHours,
              minutes: editSubscriptionMinutes,
              seconds: editSubscriptionSeconds
          } : undefined
      };
      // 1. Determine GRANT MODE
      // The logic is moved to `handleGrantSubscription`. This function is deprecated or replaced.
      return; 
  };

  const handleGrantSubscription = async (mode: 'FREE' | 'PAID') => {
      if (!editingUser) return;
      
      let endDate = undefined;
      const now = new Date();
      
      if (editSubscriptionTier !== 'FREE') {
          if (editSubscriptionTier === 'WEEKLY') {
              endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'MONTHLY') {
              endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === '3_MONTHLY') {
              endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'YEARLY') {
              endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          } else if (editSubscriptionTier === 'LIFETIME') {
              endDate = null; // Forever
          } else if (editSubscriptionTier === 'CUSTOM') {
              const totalMs = (editSubscriptionYears * 365 * 24 * 60 * 60 * 1000) +
                              (editSubscriptionMonths * 30 * 24 * 60 * 60 * 1000) +
                              (editSubscriptionDays * 24 * 60 * 60 * 1000) + 
                              (editSubscriptionHours * 60 * 60 * 1000) + 
                              (editSubscriptionMinutes * 60 * 1000) +
                              (editSubscriptionSeconds * 1000);
              endDate = new Date(now.getTime() + totalMs);
          }
      }

      const isoEndDate = endDate ? endDate.toISOString() : (endDate === null ? undefined : undefined);

      // RECORD HISTORY
      let newHistory = editingUser.subscriptionHistory || [];
      if (editSubscriptionTier !== 'FREE') {
          const historyEntry: SubscriptionHistoryEntry = {
              id: `hist-${Date.now()}`,
              tier: editSubscriptionTier,
              level: editSubscriptionLevel,
              startDate: now.toISOString(),
              endDate: isoEndDate || 'LIFETIME',
              durationHours: endDate ? Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60)) : 999999,
              price: mode === 'PAID' ? editSubscriptionPrice : 0,
              originalPrice: editSubscriptionPrice,
              isFree: mode === 'FREE',
              grantSource: mode === 'FREE' ? 'ADMIN' : 'PURCHASE',
              grantedBy: currentUser?.id,
              grantedByName: currentUser?.name
          };
          newHistory = [historyEntry, ...newHistory];
      }

      const updatedUser: User = { 
          ...editingUser, 
          credits: editUserCredits, 
          password: editUserPass,
          subscriptionTier: editSubscriptionTier,
          subscriptionLevel: editSubscriptionLevel,
          subscriptionEndDate: isoEndDate,
          subscriptionPrice: editSubscriptionPrice,
          grantedByAdmin: mode === 'FREE',
          isPremium: editSubscriptionTier !== 'FREE',
          subscriptionHistory: newHistory,
          customSubscriptionName: editSubscriptionTier === 'CUSTOM' ? editCustomSubName : undefined,
          customSubscriptionDuration: editSubscriptionTier === 'CUSTOM' ? {
              years: editSubscriptionYears,
              months: editSubscriptionMonths,
              days: editSubscriptionDays,
              hours: editSubscriptionHours,
              minutes: editSubscriptionMinutes,
              seconds: editSubscriptionSeconds
          } : undefined
      };

      const updatedList = users.map(u => u.id === editingUser.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));

      // Cloud Sync
      if (isFirebaseConnected) {
          await saveUserToLive(updatedUser);
      }

      setEditingUser(null);
      alert(`✅ ${editingUser.name} subscription updated! (${mode} Grant)`);
  };

  const sendDirectMessage = async () => {
      if (!dmUser || !dmText) return;
      
      let giftPayload = undefined;
      if (giftType !== 'NONE') {
          giftPayload = {
              type: giftType,
              value: giftValue,
              durationHours: giftDuration
          };
      }

      const newMsg = { 
          id: `msg-${Date.now()}`, 
          text: dmText, 
          date: new Date().toISOString(), 
          read: false,
          type: giftType !== 'NONE' ? 'GIFT' : 'TEXT',
          gift: giftPayload,
          isClaimed: false
      };

      const updatedUser = { ...dmUser, inbox: [newMsg, ...(dmUser.inbox || [])] };
      const updatedList = users.map(u => u.id === dmUser.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));
      
      // Cloud Sync
      if (isFirebaseConnected) {
          await saveUserToLive(updatedUser);
      }

      setDmUser(null);
      setDmText('');
      setGiftType('NONE');
      alert("Message & Gift Sent!");
  };

  // --- GIFT CODE MANAGER (New) ---
  const generateCodes = () => {
      const newCodes: GiftCode[] = [];
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      
      for (let i = 0; i < newCodeCount; i++) {
          // Generate 20-char random mixed case string
          let code = '';
          for (let j = 0; j < 20; j++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          const newGiftCode: GiftCode = {
              id: Date.now().toString() + i,
              code,
              type: newCodeType,
              amount: newCodeType === 'CREDITS' ? newCodeAmount : undefined,
              subTier: newCodeType === 'SUBSCRIPTION' ? newCodeSubTier : undefined,
              subLevel: newCodeType === 'SUBSCRIPTION' ? newCodeSubLevel : undefined,
              createdAt: new Date().toISOString(),
              isRedeemed: false,
              generatedBy: 'ADMIN',
              maxUses: newCodeMaxUses,
              usedCount: 0,
              redeemedBy: []
          };
          newCodes.push(newGiftCode);
          set(ref(rtdb, `redeem_codes/${code}`), newGiftCode); // कोड क्लाउड पर बनेगा
      }
      const updated = [...newCodes, ...giftCodes];
      setGiftCodes(updated);
      localStorage.setItem('nst_admin_codes', JSON.stringify(updated));
      alert(`${newCodeCount} Codes Generated! (Max Uses: ${newCodeMaxUses})`);
  };

  const deleteCode = (id: string) => {
      const updated = giftCodes.filter(c => c.id !== id);
      setGiftCodes(updated);
      localStorage.setItem('nst_admin_codes', JSON.stringify(updated));
  };

  // --- SUBJECT MANAGER (New) ---
  const addSubject = () => {
      if (!newSubName) return;
      const id = newSubName.toLowerCase().replace(/\s+/g, '');
      const newSubject = { id, name: newSubName, icon: newSubIcon, color: newSubColor };
      const updatedPool = { ...DEFAULT_SUBJECTS, ...customSubjects, [id]: newSubject };
      setCustomSubjects(updatedPool); // This only stores custom ones technically in state, but logic handles merge
      localStorage.setItem('nst_custom_subjects_pool', JSON.stringify(updatedPool));
      setNewSubName('');
      alert("Subject Added!");
  };

  // --- PACKAGE MANAGER (New) ---
  const addPackage = () => {
      if (!newPkgName || !newPkgPrice || !newPkgCredits) return;
      const newPkg = {
          id: `pkg-${Date.now()}`,
          name: newPkgName,
          price: Number(newPkgPrice),
          credits: Number(newPkgCredits)
      };
      const currentPkgs = localSettings.packages || [];
      const updatedPkgs = [...currentPkgs, newPkg];
      setLocalSettings({ ...localSettings, packages: updatedPkgs });
      setNewPkgName(''); setNewPkgPrice(''); setNewPkgCredits('');
  };

  const removePackage = (id: string) => {
      const currentPkgs = localSettings.packages || [];
      setLocalSettings({ ...localSettings, packages: currentPkgs.filter(p => p.id !== id) });
  };

  // --- CONTENT & SYLLABUS LOGIC ---
  const handleSubjectClick = async (s: Subject) => {
      setSelSubject(s);
      setIsLoadingChapters(true);
      try {
          const ch = await fetchChapters(selBoard, selClass, selStream, s, 'English');
          setSelChapters(ch);
          
          if (activeTab === 'BULK_UPLOAD') {
              const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
              const tempBulk: any = {};
              ch.forEach(c => {
                  const key = `nst_content_${selBoard}_${selClass}${streamKey}_${s.name}_${c.id}`;
                  const stored = localStorage.getItem(key);
                  if (stored) {
                      const d = JSON.parse(stored);
                      tempBulk[c.id] = { free: d.freeLink || '', premium: d.premiumLink || '', price: d.price || 5 };
                  } else {
                      tempBulk[c.id] = { free: '', premium: '', price: 5 };
                  }
              });
              setBulkData(tempBulk);
          }

      } catch (e) { console.error(e); setSelChapters([]); }
      setIsLoadingChapters(false);
  };

  const loadChapterContent = async (chId: string) => {
      setEditingChapterId(chId); 
      setIsContentLoading(true); // Lock inputs
      
      // STRICT KEY MATCHING (Must match VideoPlaylistView logic)
      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject?.name}_${chId}`;
      
      // 1. Try Local First (Instant Load)
      const stored = localStorage.getItem(key);
      if (stored) {
          const data = JSON.parse(stored);
          applyContentData(data);
      } else {
          // Default State
          setEditConfig({ freeLink: '', premiumLink: '', price: 5 });
          setEditingMcqs([]);
          setEditingTestMcqs([]);
          setVideoPlaylist([]);
      }

      // 2. Fetch from Cloud (Background Sync to ensure Persistence)
      if (isFirebaseConnected) {
          try {
              const cloudData = await getChapterData(key);
              if (cloudData) {
                  // Update LocalStorage & State with Cloud Data (Source of Truth)
                  localStorage.setItem(key, JSON.stringify(cloudData));
                  applyContentData(cloudData);
              }
          } catch(e) { console.error("Cloud Fetch Error", e); }
      }
      setIsContentLoading(false); // Unlock inputs
  };

  const applyContentData = (data: any) => {
      setEditConfig(data);
      setEditingMcqs(data.manualMcqData || []);
      setEditingTestMcqs(data.weeklyTestMcqData || []);
      
      // Load based on CURRENT mode (default SCHOOL)
      // STRICT SEPARATION: Only fallback to legacy for SCHOOL mode
      if (syllabusMode === 'SCHOOL') {
          setVideoPlaylist(data.schoolVideoPlaylist || data.videoPlaylist || []); 
          setPremiumNoteSlots(data.schoolPdfPremiumSlots || data.premiumNoteSlots || []);
      } else {
          setVideoPlaylist(data.competitionVideoPlaylist || []); // No fallback
          setPremiumNoteSlots(data.competitionPdfPremiumSlots || []); // No fallback
      }
  };

  // --- UPDATED SAVE FUNCTION (WRITES TO FIREBASE) ---
  const saveChapterContent = () => {
      if (!editingChapterId || !selSubject) return;
      // STRICT KEY MATCHING (Must match VideoPlaylistView logic)
      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject.name}_${editingChapterId}`;
      const existing = localStorage.getItem(key);
      const existingData = existing ? JSON.parse(existing) : {};
      
      const newData = {
          ...existingData,
          ...editConfig,
          
          // DYNAMIC SAVE: Save current UI arrays to the correct mode-specific field
          [syllabusMode === 'SCHOOL' ? 'schoolVideoPlaylist' : 'competitionVideoPlaylist']: videoPlaylist,
          [syllabusMode === 'SCHOOL' ? 'schoolPdfPremiumSlots' : 'competitionPdfPremiumSlots']: premiumNoteSlots,

          // Legacy sync (ONLY Update if in SCHOOL mode to protect separation)
          ...(syllabusMode === 'SCHOOL' ? {
              videoPlaylist: videoPlaylist,
              premiumNoteSlots: premiumNoteSlots
          } : {}),

          manualMcqData: editingMcqs,
          weeklyTestMcqData: editingTestMcqs
      };
      
      // Save locally AND to Firebase
      localStorage.setItem(key, JSON.stringify(newData));
      if (isFirebaseConnected) {
          saveChapterData(key, newData); // <--- FIREBASE SAVE
          
          // Log Universal Update
          const chapterTitle = selChapters.find(c => c.id === editingChapterId)?.title || 'Chapter';
          const updateMsg = {
              id: `update-${Date.now()}`,
              text: `New Content Available: ${selSubject.name} - ${chapterTitle}`,
              type: 'CONTENT',
              timestamp: new Date().toISOString()
          };
          push(ref(rtdb, 'universal_updates'), updateMsg);

          alert("✅ Content Saved to Firebase Database!");
      } else {
          alert("⚠️ Saved Locally ONLY. Firebase is NOT Connected. Check services/firebase.ts");
      }
  };

  // --- UPDATED BULK SAVE FUNCTION (WRITES TO FIREBASE) ---
  const saveBulkData = async () => {
      if (!selSubject) return;
      const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
      
      const updates: Record<string, any> = {};

      Object.keys(bulkData).forEach(chId => {
          const d = bulkData[chId];
          const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject.name}_${chId}`;
          const existing = localStorage.getItem(key);
          const existingData = existing ? JSON.parse(existing) : {};
          
          const newData = {
              ...existingData,
              freeLink: d.free,
              premiumLink: d.premium,
              price: d.price
          };
          localStorage.setItem(key, JSON.stringify(newData));
          updates[key] = newData;
      });

      if (isFirebaseConnected) {
          await bulkSaveLinks(updates); 
          alert(`✅ Saved links for ${Object.keys(bulkData).length} chapters to CLOUD!\n\nStudents will see these updates instantly without redownloading the app.`);
      } else {
          alert("⚠️ Saved Locally ONLY. Please Configure Firebase in services/firebase.ts to enable Cloud Sync.");
      }
  };

  const saveSyllabusList = async () => {
      if (!selSubject) return;
      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const baseKey = `${selBoard}-${selClass}${streamKey}-${selSubject.name}`;
      
      const cacheKey = `nst_custom_chapters_${baseKey}-English`;
      localStorage.setItem(cacheKey, JSON.stringify(selChapters));
      // Save Hindi fallback
      const cacheKeyHindi = `nst_custom_chapters_${baseKey}-Hindi`;
      localStorage.setItem(cacheKeyHindi, JSON.stringify(selChapters));

      if (isFirebaseConnected) {
          await saveCustomSyllabus(`${baseKey}-English`, selChapters);
          await saveCustomSyllabus(`${baseKey}-Hindi`, selChapters);
          alert("✅ Syllabus Structure Saved to Cloud!");
      } else {
          alert("⚠️ Syllabus Saved Locally (Cloud Disconnected)");
      }
  };

  const deleteChapter = (idx: number) => {
      const ch = selChapters[idx];
      const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
      const cacheKey = `nst_custom_chapters_${selBoard}-${selClass}${streamKey}-${selSubject?.name}-English`;
      
      if (softDelete('CHAPTER', ch.title, ch, cacheKey)) {
          const updated = selChapters.filter((_, i) => i !== idx);
          setSelChapters(updated);
      }
  };

  // --- MCQ EDITING HELPERS ---
  const updateMcq = (isTest: boolean, idx: number, field: keyof MCQItem, val: any) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = [...list];
      updated[idx] = { ...updated[idx], [field]: val };
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };
  const updateMcqOption = (isTest: boolean, qIdx: number, oIdx: number, val: string) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = [...list];
      updated[qIdx].options[oIdx] = val;
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };
  const addMcq = (isTest: boolean) => {
      const newItem: MCQItem = { question: 'New Question', options: ['A','B','C','D'], correctAnswer: 0, explanation: '' };
      isTest ? setEditingTestMcqs([...editingTestMcqs, newItem]) : setEditingMcqs([...editingMcqs, newItem]);
  };
  const removeMcq = (isTest: boolean, idx: number) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = list.filter((_, i) => i !== idx);
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };

  const deleteAllMcqs = (isTest: boolean) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      if (list.length === 0) return;
      
      if (!window.confirm(`DELETE ALL ${list.length} Questions?\nThey will be moved to Recycle Bin.`)) return;

      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject?.name}_${editingChapterId}`;
      
      if (softDelete('MCQ_BATCH', `${isTest ? 'Test' : 'Practice'} MCQs (${list.length}) - ${selSubject?.name}`, { mcqs: list, isTest }, key)) {
          isTest ? setEditingTestMcqs([]) : setEditingMcqs([]);
      }
  };

  // --- GOOGLE SHEET IMPORT HANDLER (ROBUST & ASYNC) ---
  const handleGoogleSheetImport = (isTest: boolean) => {
      if (!importText.trim()) {
          alert("Please paste data first!");
          return;
      }

      setIsContentLoading(true); // Lock UI

      // Use timeout to allow UI render before heavy processing
      setTimeout(() => {
          try {
              const rawText = importText.trim();
              let newQuestions: MCQItem[] = [];

              // MODE A: Tab-Separated (Excel/Sheets/Copy-Paste) - PREFERRED
              if (rawText.includes('\t')) {
                  const rows = rawText.split('\n').filter(r => r.trim());
                  newQuestions = rows.map((row, idx) => {
                      let cols = row.split('\t');
                      
                      // Handle mixed CSV fallback
                      if (cols.length < 3 && row.includes(',')) cols = row.split(',');

                      cols = cols.map(c => c.trim());

                      // Flexible Column Check (Min: Q + 4 Opts + Ans = 6)
                      if (cols.length < 6) {
                          // Skip invalid rows gracefully in bulk mode, or log error
                          console.warn(`Row ${idx + 1} invalid. Found ${cols.length} columns.`);
                          return null; 
                      }

                      // Parse Answer (1-4 or A-D)
                      let ansIdx = parseInt(cols[5]) - 1;
                      if (isNaN(ansIdx)) {
                          const map: any = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                          if (map[cols[5]] !== undefined) ansIdx = map[cols[5]];
                      }

                      return {
                          question: cols[0],
                          options: [cols[1], cols[2], cols[3], cols[4]],
                          correctAnswer: (ansIdx >= 0 && ansIdx <= 3) ? ansIdx : 0, // Default to A if invalid
                          explanation: cols[6] || ''
                      };
                  }).filter(q => q !== null) as MCQItem[];
              } 
              // MODE B: Vertical Block Format (Flexible for Long Explanation)
              else {
                  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
                  let i = 0;
                  
                  while (i + 5 < lines.length) {
                      const q = lines[i];
                      const opts = [lines[i+1], lines[i+2], lines[i+3], lines[i+4]];
                      
                      let ansRaw = lines[i+5].replace(/^(Answer|Ans|Correct)[:\s-]*/i, '').trim();
                      let ansIdx = parseInt(ansRaw) - 1;
                      if (isNaN(ansIdx)) {
                          const firstChar = ansRaw.charAt(0).toUpperCase();
                          const map: any = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                          if (map[firstChar] !== undefined) ansIdx = map[firstChar];
                      }

                      let expLines = [];
                      let nextIndex = i + 6;
                      
                      while (nextIndex < lines.length) {
                          const line = lines[nextIndex];
                          const isNewQuestion = /^(Q\d+|Question|\d+[\.)])\s/.test(line);
                          if (isNewQuestion) break; 
                          expLines.push(line);
                          nextIndex++;
                      }

                      newQuestions.push({
                          question: q,
                          options: opts,
                          correctAnswer: (ansIdx >= 0 && ansIdx <= 3) ? ansIdx : 0,
                          explanation: expLines.join('\n')
                      });
                      
                      i = nextIndex;
                  }
              }

              if (newQuestions.length === 0) {
                  throw new Error("No valid questions detected. Use Tab-Separated columns OR Vertical Blocks.");
              }

              if (isTest) {
                  setEditingTestMcqs(prev => [...prev, ...newQuestions]);
              } else {
                  setEditingMcqs(prev => [...prev, ...newQuestions]);
              }
              
              setImportText('');
              alert(`Success! ${newQuestions.length} questions imported.`);

          } catch (error: any) {
              alert("Import Failed: " + error.message);
          } finally {
              setIsContentLoading(false); // Unlock UI
          }
      }, 100);
  };

  // --- ACCESS REQUEST HANDLERS ---
  const handleApproveRequest = async (req: RecoveryRequest) => {
      // 1. Update Request Status in RTDB
      const reqRef = ref(rtdb, `recovery_requests/${req.id}`);
      await update(reqRef, { status: 'RESOLVED' });

      // 2. Enable Passwordless Login for User
      const userToUpdate = users.find(u => u.id === req.id);
      if (userToUpdate) {
          const updatedUser = { ...userToUpdate, isPasswordless: true };
          // Save to Local & Cloud
          if (isFirebaseConnected) {
              await saveUserToLive(updatedUser);
          }
      }
      
      alert(`Access Approved for ${req.name}. They can now login without password.`);
  };

  // --- SUB ADMIN HANDLERS ---
  const promoteToSubAdmin = async (userId: string) => {
      const user = users.find(u => u.id === userId || u.email === userId);
      if (!user) {
          alert("User not found!");
          return;
      }
      
      const updatedUser: User = { 
          ...user, 
          role: 'SUB_ADMIN', 
          isSubAdmin: true,
          // Default Permissions: ONLY Subscription Management allowed initially
          permissions: ['MANAGE_SUBS'] 
      };
      
      // Update State
      const updatedList = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));
      
      // Update Cloud
      if (isFirebaseConnected) await saveUserToLive(updatedUser);
      
      alert(`✅ ${user.name} promoted to Sub-Admin!`);
      setNewSubAdminId('');
  };

  const demoteSubAdmin = async (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      if (!confirm(`Are you sure you want to remove Sub-Admin rights from ${user.name}?`)) return;

      const updatedUser: User = { 
          ...user, 
          role: 'STUDENT', 
          isSubAdmin: false,
          permissions: [] 
      };
      
      const updatedList = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));
      
      if (isFirebaseConnected) await saveUserToLive(updatedUser);
      
      alert(`ℹ️ ${user.name} is now a Student.`);
  };

  const toggleSubAdminPermission = async (userId: string, perm: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      const currentPerms = user.permissions || [];
      const newPerms = currentPerms.includes(perm) 
          ? currentPerms.filter(p => p !== perm) 
          : [...currentPerms, perm];
          
      const updatedUser = { ...user, permissions: newPerms };
      
      const updatedList = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedList);
      
      if (isFirebaseConnected) await saveUserToLive(updatedUser);
  };

  // --- SUB-COMPONENTS (RENDER HELPERS) ---
  const DashboardCard = ({ icon: Icon, label, onClick, color, count }: any) => (
      <button onClick={onClick} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 bg-white border-slate-200 hover:border-${color}-400 hover:bg-${color}-50`}>
          <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
              <Icon size={24} />
          </div>
          <span className="font-bold text-xs uppercase text-slate-600">{label}</span>
          {count !== undefined && <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-500`}>{count}</span>}
      </button>
  );

  const SubjectSelector = () => {
      // 1. BOARD BUTTONS
      const renderBoards = () => (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['CBSE', 'BSEB'].map(b => (
                  <button 
                      key={b}
                      onClick={() => setSelBoard(b as Board)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selBoard === b ? 'bg-slate-800 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                      {b}
                  </button>
              ))}
          </div>
      );

      // 2. CLASS BUTTONS (Explicit List)
      const renderClasses = () => (
          <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Class</p>
              <div className="flex flex-wrap gap-2">
                  {['6','7','8','9','10','11','12', 'COMPETITION'].map(c => (
                      <button 
                          key={c}
                          onClick={() => setSelClass(c as ClassLevel)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${selClass === c ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}
                          title={c === 'COMPETITION' ? 'Competitive Exam' : `Class ${c}`}
                      >
                          {c === 'COMPETITION' ? '🏆' : c}
                      </button>
                  ))}
              </div>
          </div>
      );

      // 3. STREAM BUTTONS (Conditional)
      const renderStreams = () => {
          if (!['11', '12'].includes(selClass)) return null;
          return (
              <div className="mb-4 animate-in fade-in slide-in-from-left-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Stream</p>
                  <div className="flex gap-2">
                      {['Science', 'Commerce', 'Arts'].map(s => (
                          <button 
                              key={s}
                              onClick={() => setSelStream(s as Stream)}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selStream === s ? 'bg-purple-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-purple-50'}`}
                          >
                              {s}
                          </button>
                      ))}
                  </div>
              </div>
          );
      };

      // 4. SUBJECT BUTTONS
      const renderSubjects = () => (
          <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Subject</p>
              <div className="flex flex-wrap gap-2">
                  {getSubjectsList(selClass, selStream).map(s => (
                      <button 
                          key={s.id} 
                          onClick={() => handleSubjectClick(s)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${selSubject?.id === s.id ? 'bg-green-600 text-white border-green-600 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-700 hover:bg-green-50'}`}
                      >
                          {selSubject?.id === s.id && <CheckCircle size={12} />}
                          {s.name}
                      </button>
                  ))}
              </div>
          </div>
      );

      return (
          <div className="mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-inner">
              {renderBoards()}
              {renderClasses()}
              {renderStreams()}
              {renderSubjects()}
              
              {isLoadingChapters && <div className="text-slate-500 text-sm font-bold py-4 animate-pulse text-center">Loading Chapters...</div>}
          </div>
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="pb-20 bg-slate-50 min-h-screen">
      
      {/* 1. DASHBOARD HOME */}
      {activeTab === 'DASHBOARD' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                      <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg"><Shield size={20} /></div>
                      <div>
                          <h2 className="font-black text-slate-800 text-lg leading-none">Admin Console</h2>
                          <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Control System</p>
                              
                              {/* ONLINE USERS */}
                              <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200" title="Active Users (5m)">
                                  <div className="relative">
                                      <Users size={10} className="text-slate-500" />
                                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white animate-pulse"></div>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-600">{onlineCount} Online</span>
                              </div>

                              {/* FIREBASE STATUS INDICATOR */}
                              {isFirebaseConnected ? (
                                  <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                      <Wifi size={10} /> Online
                                  </span>
                              ) : (
                                  <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                      <WifiOff size={10} /> Disconnected (Check Config)
                                  </span>
                              )}
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button 
                          onClick={() => {
                              if (confirm("⚠️ FORCE UPDATE ALL APPS?\n\nThis will trigger a reload on all student devices to apply latest changes immediately.")) {
                                  const ts = Date.now().toString();
                                  setLocalSettings({...localSettings, forceRefreshTimestamp: ts});
                                  // Auto-save to propagate
                                  if (onUpdateSettings) {
                                      const updated = {...localSettings, forceRefreshTimestamp: ts};
                                      onUpdateSettings(updated);
                                      if(isFirebaseConnected) saveSystemSettings(updated);
                                  }
                                  alert("✅ Update Command Sent!");
                              }
                          }}
                          className="bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow hover:bg-red-700 flex items-center gap-2 animate-pulse"
                      >
                          <RefreshCw size={16} /> Force Update
                      </button>
                      <button onClick={handleSaveSettings} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"><Save size={16} /> Save Settings</button>
                  </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(hasPermission('VIEW_USERS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Users} label="Users" onClick={() => setActiveTab('USERS')} color="blue" count={users.length} />}
                  {(hasPermission('MANAGE_SUB_ADMINS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={ShieldCheck} label="Sub-Admins" onClick={() => setActiveTab('SUB_ADMINS')} color="indigo" count={users.filter(u => u.role === 'SUB_ADMIN').length} />}
                  {(hasPermission('MANAGE_SUBS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={CreditCard} label="Subscriptions" onClick={() => setActiveTab('SUBSCRIPTION_MANAGER')} color="purple" />}
                  {(hasPermission('MANAGE_PLANS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Crown} label="Plans Manager" onClick={() => setActiveTab('SUBSCRIPTION_PLANS_EDITOR')} color="blue" />}
                  {(hasPermission('MANAGE_GIFT_CODES') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Gift} label="Gift Codes" onClick={() => setActiveTab('CODES')} color="pink" />}
                  {(hasPermission('MANAGE_SYLLABUS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Book} label="Subjects" onClick={() => setActiveTab('SUBJECTS_MGR')} color="emerald" />}
                  {(hasPermission('VIEW_DEMANDS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Megaphone} label="Demands" onClick={() => setActiveTab('DEMAND')} color="orange" count={demands.length} />}
                  {(hasPermission('APPROVE_LOGIN_REQS') || currentUser?.role === 'ADMIN') && <DashboardCard icon={Key} label="Login Reqs" onClick={() => setActiveTab('ACCESS')} color="purple" count={recoveryRequests.filter(r => r.status === 'PENDING').length} />}
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>
                  
                  {(hasPermission('MANAGE_CONTENT') || currentUser?.role === 'ADMIN') && (
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-2">
                      <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide">Select Board to Manage</h4>
                      <div className="grid grid-cols-2 gap-4">
                          {/* CBSE ZONE */}
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                              <p className="font-black text-blue-800 text-xs mb-2">CBSE CONTENT</p>
                              <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => { setSelBoard('CBSE'); setActiveTab('CONTENT_PDF'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-blue-600 flex flex-col items-center gap-1">
                                      <FileText size={16} /> PDF/AI Notes
                                  </button>
                                  <button onClick={() => { setSelBoard('CBSE'); setActiveTab('CONTENT_VIDEO'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-red-600 flex flex-col items-center gap-1">
                                      <Video size={16} /> Videos
                                  </button>
                                  <button onClick={() => { setSelBoard('CBSE'); setActiveTab('CONTENT_MCQ'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-purple-600 flex flex-col items-center gap-1">
                                      <CheckCircle size={16} /> MCQ
                                  </button>
                                  <button onClick={() => { setSelBoard('CBSE'); setActiveTab('BULK_UPLOAD'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-orange-600 flex flex-col items-center gap-1">
                                      <LayersIcon size={16} /> Bulk
                                  </button>
                              </div>
                          </div>

                          {/* BSEB ZONE */}
                          <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                              <p className="font-black text-orange-800 text-xs mb-2">BSEB CONTENT</p>
                              <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => { setSelBoard('BSEB'); setActiveTab('CONTENT_PDF'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-blue-600 flex flex-col items-center gap-1">
                                      <FileText size={16} /> PDF/AI Notes
                                  </button>
                                  <button onClick={() => { setSelBoard('BSEB'); setActiveTab('CONTENT_VIDEO'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-red-600 flex flex-col items-center gap-1">
                                      <Video size={16} /> Videos
                                  </button>
                                  <button onClick={() => { setSelBoard('BSEB'); setActiveTab('CONTENT_MCQ'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-purple-600 flex flex-col items-center gap-1">
                                      <CheckCircle size={16} /> MCQ
                                  </button>
                                  <button onClick={() => { setSelBoard('BSEB'); setActiveTab('BULK_UPLOAD'); }} className="p-2 bg-white rounded shadow-sm text-[10px] font-bold text-slate-600 hover:text-orange-600 flex flex-col items-center gap-1">
                                      <LayersIcon size={16} /> Bulk
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
                  )}

                  {currentUser?.role === 'ADMIN' && <DashboardCard icon={ListChecks} label="Chapters List" onClick={() => setActiveTab('SYLLABUS_MANAGER')} color="indigo" />}
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>

                  {(hasPermission('MANAGE_SETTINGS') || currentUser?.role === 'ADMIN') && (
                      <>
                          <DashboardCard icon={ShieldCheck} label="Watermark" onClick={() => setActiveTab('CONFIG_WATERMARK')} color="indigo" />
                          <DashboardCard icon={Monitor} label="General" onClick={() => setActiveTab('CONFIG_GENERAL')} color="blue" />
                          <DashboardCard icon={ShieldCheck} label="Security" onClick={() => setActiveTab('CONFIG_SECURITY')} color="red" />
                          <DashboardCard icon={Eye} label="Visibility" onClick={() => setActiveTab('CONFIG_VISIBILITY')} color="cyan" />
                          <DashboardCard icon={BrainCircuit} label="AI Studio" onClick={() => setActiveTab('AI_STUDIO')} color="violet" />
                          <DashboardCard icon={Sparkles} label="Ads Config" onClick={() => setActiveTab('CONFIG_ADS')} color="rose" />
                          <DashboardCard icon={Gamepad2} label="Game Config" onClick={() => setActiveTab('CONFIG_GAME')} color="orange" />
                          <DashboardCard icon={Banknote} label="Payment" onClick={() => setActiveTab('CONFIG_PAYMENT')} color="emerald" />
                          <DashboardCard icon={Globe} label="External Apps" onClick={() => setActiveTab('CONFIG_EXTERNAL_APPS')} color="indigo" />
                          <DashboardCard icon={Gift} label="Engagement Rewards" onClick={() => setActiveTab('CONFIG_REWARDS')} color="rose" />
                          <DashboardCard icon={ListChecks} label="Feature Config" onClick={() => setActiveTab('CONFIG_FEATURES')} color="blue" />
                          <DashboardCard icon={HelpCircle} label="Info Popups" onClick={() => setActiveTab('CONFIG_INFO')} color="orange" />
                          <DashboardCard icon={Sparkles} label="3 Tier Popup" onClick={() => setActiveTab('CONFIG_POPUP_THREE_TIER')} color="blue" className="ring-2 ring-blue-400 animate-pulse" />
                          <DashboardCard icon={Trophy} label="Challenge Config" onClick={() => setActiveTab('CONFIG_CHALLENGE')} color="red" />
                          <DashboardCard icon={Rocket} label="Challenge 2.0" onClick={() => setActiveTab('CHALLENGE_CREATOR_20')} color="violet" />
                          <DashboardCard icon={Video} label="Universal Playlist" onClick={() => setActiveTab('UNIVERSAL_PLAYLIST')} color="rose" />
                          <DashboardCard icon={ShoppingBag} label="💰 Pricing" onClick={() => setActiveTab('PRICING_MGMT')} color="yellow" />
                      </>
                  )}
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>

                  {currentUser?.role === 'ADMIN' && <DashboardCard icon={Cloud} label="Deploy App" onClick={() => setActiveTab('DEPLOY')} color="sky" />}
                  {currentUser?.role === 'ADMIN' && <DashboardCard icon={Database} label="Database" onClick={() => setActiveTab('DATABASE')} color="gray" />}
                  {currentUser?.role === 'ADMIN' && <DashboardCard icon={Trash2} label="Recycle Bin" onClick={() => setActiveTab('RECYCLE')} color="red" count={recycleBin.length} />}
                  <DashboardCard icon={LogOut} label="Exit" onClick={() => onNavigate('STUDENT_DASHBOARD')} color="slate" />
              </div>
          </div>
      )}


      {/* --- FEATURED CONTENT SHORTCUTS --- */}
      {activeTab === 'FEATURED_CONTENT' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Home Screen Shortcuts</h3>
              </div>
              
              <div className="mb-6">
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Section Title (Question)</label>
                  <input 
                      type="text" 
                      value={localSettings.featuredSectionTitle || ''} 
                      onChange={e => setLocalSettings({...localSettings, featuredSectionTitle: e.target.value})} 
                      placeholder="e.g., What do you want to learn today?" 
                      className="w-full p-3 border rounded-xl font-bold text-slate-800"
                  />
                  <div className="mt-2 text-right">
                      <button onClick={handleSaveSettings} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold">Update Title</button>
                  </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
                  <h4 className="font-bold text-blue-900 mb-4">Add New Shortcut (Max 4)</h4>
                  
                  {/* Selector Reuse */}
                  <SubjectSelector />

                  {selSubject && (
                      <div className="space-y-4">
                          <div className="bg-white p-3 rounded-xl border border-blue-200">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Select Chapter</p>
                              <select 
                                  onChange={e => {
                                      const ch = selChapters.find(c => c.id === e.target.value);
                                      if (ch) {
                                          // Add logic
                                          if ((localSettings.featuredItems?.length || 0) >= 4) {
                                              alert("Max 4 items allowed. Please delete one first.");
                                              return;
                                          }
                                          const type = prompt("Content Type? (MCQ / PDF / VIDEO)", "MCQ");
                                          if (!type) return;
                                          const cleanType = type.toUpperCase().trim();
                                          if (!['MCQ', 'PDF', 'VIDEO'].includes(cleanType)) {
                                              alert("Invalid Type. Use MCQ, PDF, or VIDEO");
                                              return;
                                          }

                                          const newItem = {
                                              id: `feat-${Date.now()}`,
                                              title: ch.title,
                                              subtitle: `${selClass} • ${selSubject.name}`,
                                              board: selBoard,
                                              classLevel: selClass,
                                              stream: selStream,
                                              subject: selSubject,
                                              chapter: ch,
                                              type: cleanType as any
                                          };

                                          const updated = [...(localSettings.featuredItems || []), newItem];
                                          setLocalSettings({...localSettings, featuredItems: updated});
                                          // Save immediately to preview
                                          localStorage.setItem('nst_system_settings', JSON.stringify({...localSettings, featuredItems: updated}));
                                      }
                                  }}
                                  className="w-full p-2 border rounded-lg"
                              >
                                  <option value="">-- Choose Chapter --</option>
                                  {selChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                              </select>
                          </div>
                      </div>
                  )}
              </div>

              <div className="space-y-3">
                  <h4 className="font-bold text-slate-800">Active Shortcuts</h4>
                  {(!localSettings.featuredItems || localSettings.featuredItems.length === 0) && <p className="text-slate-400 text-sm">No shortcuts added.</p>}
                  {localSettings.featuredItems?.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${item.type === 'MCQ' ? 'bg-purple-100 text-purple-600' : item.type === 'PDF' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                  {item.type}
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">{item.title}</p>
                                  <p className="text-xs text-slate-500">{item.subtitle} ({item.board})</p>
                              </div>
                          </div>
                          <button onClick={() => {
                              const updated = localSettings.featuredItems!.filter((_, i) => i !== idx);
                              setLocalSettings({...localSettings, featuredItems: updated});
                          }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                      </div>
                  ))}
              </div>
              
              <button onClick={handleSaveSettings} className="w-full mt-6 bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-green-700">Save Changes & Publish</button>
          </div>
      )}

      {/* 3-TIER POPUP CONFIG TAB */}
      {activeTab === 'CONFIG_POPUP_THREE_TIER' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right space-y-6">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">3 Tier Popup Config</h3>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div>
                      <h4 className="font-bold text-blue-900">Enable Popup</h4>
                      <p className="text-xs text-blue-700">Show Free vs Basic vs Ultra popup to users.</p>
                  </div>
                  <button 
                      onClick={() => setLocalSettings({
                          ...localSettings, 
                          threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: false, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false }), enabled: !localSettings.threeTierPopupConfig?.enabled }
                      })}
                      className={`w-14 h-8 rounded-full transition-colors relative ${localSettings.threeTierPopupConfig?.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${localSettings.threeTierPopupConfig?.enabled ? 'right-1' : 'left-1'}`} />
                  </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Popup Interval (Minutes)</label>
                      <input 
                          type="number" 
                          value={localSettings.threeTierPopupConfig?.intervalMinutes || 60} 
                          onChange={e => setLocalSettings({
                              ...localSettings, 
                              threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: true, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false, intervalMinutes: 60, showNearExpiryHours: 48 }), intervalMinutes: Number(e.target.value) }
                          })}
                          className="w-full p-3 border rounded-xl font-bold"
                          placeholder="60"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Expiry Warning (Hours)</label>
                      <input 
                          type="number" 
                          value={localSettings.threeTierPopupConfig?.showNearExpiryHours || 48} 
                          onChange={e => setLocalSettings({
                              ...localSettings, 
                              threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: true, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false, intervalMinutes: 60, showNearExpiryHours: 48 }), showNearExpiryHours: Number(e.target.value) }
                          })}
                          className="w-full p-3 border rounded-xl font-bold"
                          placeholder="48"
                      />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Auto Close (Seconds)</label>
                      <input 
                          type="number" 
                          value={localSettings.threeTierPopupConfig?.autoCloseSeconds || 15} 
                          onChange={e => setLocalSettings({
                              ...localSettings, 
                              threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: true, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false, intervalMinutes: 60, showNearExpiryHours: 48 }), autoCloseSeconds: Number(e.target.value) }
                          })}
                          className="w-full p-3 border rounded-xl font-bold"
                          placeholder="15"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Skip Delay (Seconds)</label>
                      <input 
                          type="number" 
                          value={localSettings.threeTierPopupConfig?.skipDelaySeconds || 5} 
                          onChange={e => setLocalSettings({
                              ...localSettings, 
                              threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: true, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false, intervalMinutes: 60, showNearExpiryHours: 48 }), skipDelaySeconds: Number(e.target.value) }
                          })}
                          className="w-full p-3 border rounded-xl font-bold"
                          placeholder="5"
                      />
                  </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div>
                      <h4 className="font-bold text-purple-900">Show to Premium Users?</h4>
                      <p className="text-xs text-purple-700">If enabled, even Ultra/Basic users will see this.</p>
                  </div>
                  <input 
                      type="checkbox" 
                      checked={localSettings.threeTierPopupConfig?.showToPremium || false} 
                      onChange={e => setLocalSettings({
                          ...localSettings,
                          threeTierPopupConfig: { ...(localSettings.threeTierPopupConfig || { enabled: true, autoCloseSeconds: 15, skipDelaySeconds: 5, showToPremium: false }), showToPremium: e.target.checked }
                      })}
                      className="w-6 h-6 accent-purple-600" 
                  />
              </div>

              <button onClick={handleSaveSettings} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                  <Save size={20} /> Save Configuration
              </button>
          </div>
      )}

      {activeTab === 'BULK_UPLOAD' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Daily Bulk Upload</h3>
              </div>
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-6 text-sm text-yellow-800">
                  <strong>Instructions:</strong> Paste your links here. If Firebase is configured, clicking Save will sync for ALL students instantly. No need to redeploy.
              </div>
              
              <SubjectSelector />

              {selSubject && selChapters.length > 0 && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg font-bold text-slate-600 text-xs uppercase">
                          <div className="w-8">#</div>
                          <div className="flex-1">Chapter</div>
                          <div className="w-1/3">Premium Link (Paid)</div>
                          <div className="w-16">Price</div>
                      </div>
                      
                      {selChapters.map((ch, idx) => {
                          const data = bulkData[ch.id] || { free: '', premium: '', price: 5 };
                          return (
                              <div key={ch.id} className="flex gap-2 items-center">
                                  <div className="w-8 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                  <div className="flex-1 text-sm font-bold text-slate-700 truncate">{ch.title}</div>
                                  <div className="w-1/3">
                                      <input 
                                          type="text" 
                                          placeholder="Paste Premium PDF Link..." 
                                          value={data.premium}
                                          onChange={e => setBulkData({...bulkData, [ch.id]: { ...data, premium: e.target.value }})}
                                          className="w-full p-2 border border-purple-200 bg-purple-50 rounded text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                                      />
                                  </div>
                                  <div className="w-16">
                                      <input 
                                          type="number" 
                                          value={data.price}
                                          onChange={e => setBulkData({...bulkData, [ch.id]: { ...data, price: Number(e.target.value) }})}
                                          className="w-full p-2 border border-slate-200 rounded text-xs text-center font-bold"
                                      />
                                  </div>
                              </div>
                          );
                      })}

                      <div className="pt-6 border-t mt-4">
                          <button onClick={saveBulkData} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                              <Save size={20} /> Save All & Sync
                          </button>
                      </div>
                  </div>
              )}
          </div>
      )}


      {/* 2. SYLLABUS MANAGER */}
      {activeTab === 'SYLLABUS_MANAGER' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-indigo-800">Syllabus Manager</h3>
              </div>
              <SubjectSelector />
              {selSubject && (
                  <div className="space-y-6">
                      {/* BULK UPLOAD SECTION */}
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in">
                          <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                               <LayersIcon size={18} /> Bulk Syllabus Upload
                          </h4>
                          <p className="text-xs text-indigo-700 mb-3 leading-relaxed">
                               Paste chapter list (one per line) to <strong className="bg-indigo-100 px-1 rounded">REPLACE</strong> the entire syllabus.
                               <br/>This updates PDF, Video, and MCQ sections automatically.
                          </p>
                          <textarea
                              value={syllabusImportText}
                              onChange={(e) => setSyllabusImportText(e.target.value)}
                              className="w-full h-32 p-3 text-sm border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 mb-3 shadow-inner"
                              placeholder={"Chapter 1: Real Numbers\nChapter 2: Polynomials\nChapter 3: Linear Equations..."}
                          />
                          <div className="flex gap-2">
                               <button 
                                   onClick={async () => {
                                        if (!syllabusImportText.trim()) { alert("Paste content first."); return; }
                                        const lines = syllabusImportText.split('\n').map(l => l.trim()).filter(l => l);
                                        const newChapters = lines.map((title, idx) => ({
                                            id: `ch-${Date.now()}-${idx}`,
                                            title: title,
                                            description: `Chapter ${idx + 1}`
                                        }));
                                        setSelChapters(newChapters);
                                        
                                        // Trigger Save
                                        if(confirm(`⚠️ Overwrite Syllabus with ${newChapters.length} chapters?\n\nThis will update the syllabus for ALL students immediately.`)) {
                                            const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
                                            const baseKey = `${selBoard}-${selClass}${streamKey}-${selSubject.name}`;
                                            
                                            // Save to Cloud
                                            if(isFirebaseConnected) {
                                                await saveCustomSyllabus(`${baseKey}-English`, newChapters);
                                                await saveCustomSyllabus(`${baseKey}-Hindi`, newChapters);
                                            }
                                            
                                            // Save Local
                                            localStorage.setItem(`nst_custom_chapters_${baseKey}-English`, JSON.stringify(newChapters));
                                            localStorage.setItem(`nst_custom_chapters_${baseKey}-Hindi`, JSON.stringify(newChapters));
                                            
                                            alert("✅ Syllabus Overwritten & Saved to Cloud!");
                                            setSyllabusImportText('');
                                        }
                                   }} 
                                   className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700 flex items-center gap-2 transition-transform active:scale-95"
                               >
                                   <Save size={16} /> Replace & Save Syllabus
                               </button>
                               
                               <button 
                                   onClick={async () => {
                                       if(confirm("Reset to Default Static/AI Syllabus? This cannot be undone.")) {
                                            const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
                                            const baseKey = `${selBoard}-${selClass}${streamKey}-${selSubject.name}`;
                                            
                                            if(isFirebaseConnected) {
                                                await deleteCustomSyllabus(`${baseKey}-English`);
                                                await deleteCustomSyllabus(`${baseKey}-Hindi`);
                                            }
                                            localStorage.removeItem(`nst_custom_chapters_${baseKey}-English`);
                                            localStorage.removeItem(`nst_custom_chapters_${baseKey}-Hindi`);
                                            
                                            const fresh = await fetchChapters(selBoard, selClass, selStream, selSubject, 'English');
                                            setSelChapters(fresh);
                                            alert("✅ Reset Complete!");
                                       }
                                   }}
                                   className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-50 flex items-center gap-2"
                               >
                                   <RotateCcw size={16} /> Reset to Default
                               </button>
                          </div>
                      </div>

                      <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                          <h4 className="font-bold text-indigo-900">Manual Edit: {selSubject.name}</h4>
                          <div className="flex gap-2">
                              <button onClick={() => setSelChapters([...selChapters, { id: `manual-${Date.now()}`, title: 'New Chapter' }])} className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs">+ Add Chapter</button>
                              <button onClick={saveSyllabusList} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow">Save List</button>
                          </div>
                      </div>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                          {selChapters.map((ch, idx) => (
                              <div key={ch.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                                  <input 
                                      type="text" 
                                      value={ch.title} 
                                      onChange={(e) => { const up = [...selChapters]; up[idx].title = e.target.value; setSelChapters(up); }}
                                      className="flex-1 p-2 border border-slate-200 rounded text-sm font-medium focus:border-indigo-500 outline-none"
                                  />
                                  
                                  {/* MANAGE CONTENT BUTTON (New Feature) */}
                                  <button 
                                      onClick={() => {
                                          loadChapterContent(ch.id);
                                          setActiveTab('CONTENT_PDF'); // Switch to editor view directly
                                      }}
                                      className="px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-200 whitespace-nowrap"
                                      title="Edit PDF, Video, MCQ for this Chapter"
                                  >
                                      Edit Content
                                  </button>

                                  {/* LOCK TOGGLE */}
                                  <button 
                                      onClick={() => {
                                          const up = [...selChapters];
                                          // Toggle 'isLocked' property
                                          // @ts-ignore
                                          up[idx].isLocked = !up[idx].isLocked;
                                          setSelChapters(up);
                                      }}
                                      className={`p-2 rounded-lg transition-colors ${
                                          // @ts-ignore
                                          ch.isLocked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                      }`}
                                      title={
                                          // @ts-ignore
                                          ch.isLocked ? "Unlock Chapter" : "Lock Chapter"
                                      }
                                  >
                                      {/* @ts-ignore */}
                                      {ch.isLocked ? <Lock size={16} /> : <Eye size={16} />}
                                  </button>

                                  <button onClick={() => deleteChapter(idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* 3. CONTENT MANAGERS (PDF, VIDEO, MCQ, TEST, IMAGE) */}
      {['CONTENT_PDF', 'CONTENT_VIDEO', 'CONTENT_MCQ', 'CONTENT_TEST', 'CONTENT_HTML'].includes(activeTab) && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">
                      {activeTab === 'CONTENT_PDF' ? 'PDF Study Material' : activeTab === 'CONTENT_VIDEO' ? 'Video Lectures' : activeTab === 'CONTENT_MCQ' ? 'Practice MCQs' : activeTab === 'CONTENT_HTML' ? 'Interactive HTML Modules' : 'Weekly Tests - Multi-Subject'}
                  </h3>
              </div>
              
              {/* EDITOR TAB NAVIGATION */}
              {activeTab !== 'CONTENT_TEST' && (
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                      {[
                          {id: 'CONTENT_PDF', label: 'PDF / Notes', icon: FileText},
                          {id: 'CONTENT_VIDEO', label: 'Videos', icon: Video},
                          {id: 'CONTENT_MCQ', label: 'MCQs', icon: CheckCircle},
                          {id: 'CONTENT_HTML', label: 'HTML', icon: Globe},
                      ].map(tab => (
                          <button 
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id as any)}
                              className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs whitespace-nowrap transition-all ${
                                  activeTab === tab.id 
                                  ? 'bg-slate-800 text-white shadow-lg scale-105' 
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                              <tab.icon size={16} /> {tab.label}
                          </button>
                      ))}
                  </div>
              )}

              {activeTab !== 'CONTENT_TEST' && <SubjectSelector />}
              
              {/* WEEKLY TEST CREATION UI */}
              {activeTab === 'CONTENT_TEST' && (
                  <div className="space-y-6 bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-200">
                      {/* Test Metadata */}
                      <div className="space-y-3">
                          <input type="text" placeholder="Test Name" value={testName} onChange={e => setTestName(e.target.value)} className="w-full p-3 border border-orange-200 rounded-xl font-bold text-lg" />
                          <textarea placeholder="Test Description" value={testDesc} onChange={e => setTestDesc(e.target.value)} className="w-full p-3 border border-orange-200 rounded-xl h-20" />
                          <div className="grid grid-cols-3 gap-3">
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Class</label>
                                  <select value={testClassLevel} onChange={e => setTestClassLevel(e.target.value as ClassLevel)} className="w-full p-2 border border-orange-200 rounded-lg font-bold">
                                      {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Duration (mins)</label>
                                  <input type="number" value={testDuration} onChange={e => setTestDuration(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg font-bold" min="30" max="300" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Pass Score %</label>
                                  <input type="number" value={testPassScore} onChange={e => setTestPassScore(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg font-bold" min="0" max="100" />
                              </div>
                          </div>
                      </div>

                      {/* Subject & Chapter Selection (Enhanced) */}
                      <div className="border-t border-orange-200 pt-4">
                          <p className="font-bold text-orange-700 mb-3">📚 Select Content (Multi-Subject)</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                              {getSubjectsList(testClassLevel, null).map(s => {
                                  const isSel = testSelectedSubjects.includes(s.id);
                                  return (
                                      <div key={s.id} className={`p-2 rounded-lg border flex flex-col ${isSel ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200'}`}>
                                          <button onClick={() => setTestSelectedSubjects(isSel ? testSelectedSubjects.filter(x => x !== s.id) : [...testSelectedSubjects, s.id])} className="flex items-center gap-2 font-bold text-xs text-slate-800 w-full mb-1">
                                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-slate-300'}`}>
                                                  {isSel && <CheckCircle size={10} />}
                                              </div>
                                              {s.name}
                                          </button>
                                          
                                          {/* Load Chapters Button */}
                                          {isSel && (
                                              <button 
                                                  onClick={async () => {
                                                      const ch = await fetchChapters(localSettings.allowedBoards?.[0] || 'CBSE', testClassLevel, 'Science', s, 'English');
                                                      // This is a simplified way to just "show" chapters for selection. 
                                                      // In a real app, we'd store these chapters in a map keyed by subjectId.
                                                      // For this prototype, we'll prompt the user or use a simple modal (simulated).
                                                      const selectedChs = window.prompt(`Enter Chapter IDs for ${s.name} (comma separated) or leave blank for ALL:\n\nAvailable:\n${ch.map((c,i) => `${i+1}. ${c.title}`).join('\n')}`);
                                                      if (selectedChs) {
                                                          const indexes = selectedChs.split(',').map(x => parseInt(x.trim()) - 1);
                                                          const ids = indexes.map(i => ch[i]?.id).filter(Boolean);
                                                          setTestSelectedChapters(prev => [...prev, ...ids]);
                                                          alert(`Added ${ids.length} chapters from ${s.name}`);
                                                      }
                                                  }}
                                                  className="text-[9px] text-blue-600 underline text-left pl-6"
                                              >
                                                  Select Specific Chapters
                                              </button>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                          {testSelectedChapters.length > 0 && <p className="text-xs text-green-600 font-bold mb-2">✅ {testSelectedChapters.length} specific chapters selected across subjects.</p>}
                      </div>

                      {/* Questions Section */}
                      <div className="border-t border-orange-200 pt-4">
                          {/* GOOGLE SHEETS IMPORT FOR WEEKLY TEST */}
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200 shadow-sm mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-orange-100 p-2 rounded text-orange-700">
                                      <Database size={18} />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">Bulk Import Questions (Google Sheets)</h4>
                                      <p className="text-[10px] text-slate-500">Copy cells from Excel/Sheets and paste below</p>
                                  </div>
                              </div>

                              <div className="bg-white/50 p-2 rounded-lg text-[10px] text-slate-600 mb-2 border border-orange-100 font-mono">
                                  <strong>Supported Formats:</strong><br/>
                                  1. Copy from Excel (7 Columns): Q | Opt A | Opt B | Opt C | Opt D | Ans(1-4) | Exp<br/>
                                  2. Vertical List: Q \n 4 Options \n Answer \n Explanation (Multi-line). <br/>
                                  *Note: For multi-line explanation, ensure next Question starts with "1.", "2." etc.
                              </div>

                              <textarea 
                                  value={importText} 
                                  onChange={e => setImportText(e.target.value)}
                                  placeholder={`Example:
What is 2+2?    3       4       5       6       2       The answer is 4
Capital of India?       Mumbai  Delhi   Kolkata Chennai 2       Delhi is the capital`}
                                  className="w-full h-24 p-2 border border-orange-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none mb-2"
                              />
                              
                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => setImportText('')} 
                                      className="flex-1 bg-white border border-orange-200 text-slate-600 py-2 rounded-lg font-bold text-xs hover:bg-orange-50"
                                  >
                                      Clear
                                  </button>
                                  <button 
                                      onClick={() => handleGoogleSheetImport(true)} 
                                      className="flex-[2] bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow"
                                  >
                                      <Upload size={14} /> Import to Test
                                  </button>
                              </div>
                          </div>

                          <div className="flex justify-between items-center mb-3">
                              <p className="font-bold text-orange-700">📝 Questions ({editingTestMcqs.length})</p>
                              <button onClick={() => addMcq(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">+ Add Question</button>
                          </div>
                          <div className="space-y-3 max-h-[40vh] overflow-y-auto bg-white p-3 rounded-lg border border-orange-200">
                              {editingTestMcqs.map((q, idx) => (
                                  <div key={idx} className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="font-bold text-orange-700">Q{idx+1}</span>
                                          <button onClick={() => removeMcq(true, idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                                      </div>
                                      <p className="text-sm font-medium text-slate-700 truncate">{q.question}</p>
                                      <p className="text-xs text-slate-500 mt-1">A) {q.options[q.correctAnswer]}</p>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Save Button */}
                      <button onClick={handleSaveWeeklyTest} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 rounded-xl shadow-lg hover:shadow-xl text-lg">
                          ✅ Create Weekly Test ({editingTestMcqs.length} Questions)
                      </button>

                      {/* Existing Tests */}
                      {localSettings.weeklyTests && localSettings.weeklyTests.length > 0 && (
                          <div className="border-t border-orange-200 pt-4">
                              <p className="font-bold text-orange-700 mb-3">✅ Active Tests</p>
                              <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                                  {localSettings.weeklyTests.map(t => (
                                      <div key={t.id} className="bg-white p-3 rounded-lg border border-green-200 flex justify-between items-center">
                                          <div>
                                              <p className="font-bold text-slate-800">{t.name}</p>
                                              <p className="text-xs text-slate-500">Class {t.classLevel} • {t.totalQuestions} Qs • {t.durationMinutes}min</p>
                                          </div>
                                          <button onClick={() => {const updated = localSettings.weeklyTests!.filter(x => x.id !== t.id); setLocalSettings({...localSettings, weeklyTests: updated});}} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* LIST VIEW (for PDF/VIDEO/MCQ/IMAGE) */}
              {selSubject && !editingChapterId && activeTab !== 'CONTENT_TEST' && (
                  <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
                      {selChapters.map((ch) => (
                          <div key={ch.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-700 text-sm">{ch.title}</span>
                              <button onClick={() => loadChapterContent(ch.id)} className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-200">
                                      Manage All Content
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              {/* EDITOR VIEW (for PDF/VIDEO/MCQ) */}
              {editingChapterId && activeTab !== 'CONTENT_TEST' && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in slide-in-from-right">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
                          <div>
                              <h4 className="font-black text-slate-800 text-lg">{selChapters.find(c => c.id === editingChapterId)?.title}</h4>
                              <p className="text-xs text-slate-500">Editing Content</p>
                          </div>
                          <button onClick={() => setEditingChapterId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Close Editor</button>
                      </div>
                      
                      {isContentLoading ? (
                          <div className="flex items-center justify-center h-40">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                          </div>
                      ) : (
                      <>
                          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                             {/* TAB SWITCHER WITHIN EDITOR */}
                             {['CONTENT_PDF', 'CONTENT_VIDEO', 'CONTENT_MCQ', 'CONTENT_HTML'].map(tab => (
                                 <button
                                     key={tab}
                                     onClick={() => setActiveTab(tab as any)}
                                     className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                                 >
                                     {tab === 'CONTENT_PDF' ? 'PDF' : tab === 'CONTENT_VIDEO' ? 'Videos' : tab === 'CONTENT_MCQ' ? 'MCQ' : 'HTML Modules'}
                                 </button>
                             ))}
                          </div>

                          {/* SYLLABUS MODE TOGGLE - GLOBAL FOR CONTENT EDITOR */}
                          <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
                                <button 
                                    onClick={() => handleModeSwitch('SCHOOL')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${syllabusMode === 'SCHOOL' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    School Mode
                                </button>
                                <button 
                                    onClick={() => handleModeSwitch('COMPETITION')}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${syllabusMode === 'COMPETITION' ? 'bg-white text-purple-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Competition Mode
                                </button>
                          </div>

                          {/* AI Loading Image - Per Chapter */}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 mb-6">
                              <h4 className="font-bold text-blue-900 mb-2 text-sm flex items-center gap-2">
                                  <BrainCircuit size={16} /> Chapter Loading Screen (AI Interstitial)
                              </h4>
                              <input 
                                  type="text" 
                                  value={editConfig.chapterAiImage || ''} 
                                  onChange={e => setEditConfig({...editConfig, chapterAiImage: e.target.value})} 
                                  className="w-full p-2 border rounded-lg text-sm mb-1"
                                  placeholder="https://image-link-for-this-chapter.jpg" 
                              />
                              <p className="text-[10px] text-blue-600">
                                  This image will be shown for 10s (Free) / 3s (Premium) before opening content. 
                                  Overrides Global AI Image.
                              </p>
                          </div>

                      {/* PDF & AI NOTES EDITOR */}
                      {activeTab === 'CONTENT_PDF' && (
                          <div className="space-y-6">
                              {/* FREE PDF SECTION (DYNAMIC) */}
                              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                  <label className="block text-xs font-black text-green-800 uppercase mb-1 flex items-center gap-2">
                                      <FileText size={14} /> Free PDF Link ({syllabusMode})
                                  </label>
                                  <div className="flex items-center bg-white border border-green-200 rounded-xl overflow-hidden mb-2">
                                      <div className="bg-green-50 p-3"><Link size={16} className="text-green-600" /></div>
                                      <input 
                                          type="text" 
                                          value={editConfig[getModeField('pdfLink') as keyof ContentConfig] || ''} 
                                          onChange={e => setEditConfig({...editConfig, [getModeField('pdfLink')]: e.target.value})} 
                                          className="flex-1 p-3 outline-none text-sm" 
                                          placeholder={`https://drive.google.com/... (${syllabusMode} Only)`} 
                                      />
                                  </div>
                                  <p className="text-[10px] text-green-600">Supports Google Drive Links (Embeds automatically)</p>
                              </div>

                              {/* PREMIUM PDF SECTION */}
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Premium PDF Link</label>
                                  <div className="flex items-center bg-white border rounded-xl overflow-hidden">
                                      <div className="bg-slate-100 p-3"><Link size={16} className="text-purple-400" /></div>
                                      <input type="text" value={editConfig.premiumLink || ''} onChange={e => setEditConfig({...editConfig, premiumLink: e.target.value})} className="flex-1 p-3 outline-none text-sm" placeholder="https://..." />
                                  </div>
                              </div>

                              {/* PREMIUM NOTES COLLECTION (20 SLOTS) */}
                              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
                                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                                      <LayersIcon size={18} /> Premium Notes Collection (Max 20)
                                  </h4>
                                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                      {Array.from({length: 20}).map((_, i) => {
                                          const slots = premiumNoteSlots || [];
                                          const slot = slots[i] || { id: `pnote-${i}`, title: `Note ${i+1}`, url: '', color: 'blue', access: 'BASIC' };
                                          
                                          const updateSlot = (field: keyof PremiumNoteSlot, val: any) => {
                                              const newSlots = [...slots];
                                              // Ensure slots exist up to i
                                              for(let k=0; k<=i; k++) {
                                                  if(!newSlots[k]) newSlots[k] = { id: `pnote-${k}`, title: `Note ${k+1}`, url: '', color: 'blue', access: 'BASIC' };
                                              }
                                              // @ts-ignore
                                              newSlots[i] = { ...newSlots[i], [field]: val };
                                              setPremiumNoteSlots(newSlots);
                                          };

                                          return (
                                              <div key={i} className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm flex flex-col gap-2">
                                                  <div className="flex gap-2 items-center">
                                                      <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                                                      <input 
                                                          type="text" 
                                                          value={slot.title} 
                                                          onChange={e => updateSlot('title', e.target.value)}
                                                          placeholder="Title"
                                                          className="flex-1 p-2 border rounded text-xs font-bold"
                                                      />
                                                      <select 
                                                          value={slot.color} 
                                                          onChange={e => updateSlot('color', e.target.value)}
                                                          className="p-2 border rounded text-xs"
                                                      >
                                                          <option value="blue">Blue</option>
                                                          <option value="red">Red</option>
                                                          <option value="green">Green</option>
                                                          <option value="yellow">Yellow</option>
                                                          <option value="purple">Purple</option>
                                                          <option value="orange">Orange</option>
                                                          <option value="teal">Teal</option>
                                                          <option value="slate">Slate</option>
                                                      </select>
                                                      <select 
                                                          value={slot.access} 
                                                          onChange={e => updateSlot('access', e.target.value)}
                                                          className="p-2 border rounded text-xs font-bold bg-slate-50"
                                                      >
                                                          <option value="BASIC">Basic</option>
                                                          <option value="ULTRA">Ultra</option>
                                                      </select>
                                                  </div>
                                                  <input 
                                                      type="text" 
                                                      value={slot.url} 
                                                      onChange={e => updateSlot('url', e.target.value)}
                                                      placeholder="PDF URL (Drive Link)..."
                                                      className="w-full p-2 border rounded text-xs font-mono text-blue-600 bg-slate-50"
                                                  />
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                               {/* WATERMARK DESIGNER */}
                               <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-white space-y-6">
                                  <div className="flex items-center gap-2 mb-2">
                                      <PenTool className="text-purple-400" size={20} />
                                      <h4 className="font-bold text-lg">Watermark Designer</h4>
                                  </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* CONTROLS */}
                                      <div className="space-y-4">
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Text</label>
                                              <input 
                                                  type="text" 
                                                  value={editConfig.watermarkConfig?.text || editConfig.watermarkText || ''} 
                                                  onChange={e => {
                                                      const newText = e.target.value;
                                                      // Sync legacy field for compatibility
                                                      const newConfig = { 
                                                          ...(editConfig.watermarkConfig || { opacity: 0.3, color: '#000000', backgroundColor: 'transparent', fontSize: 20, isRepeating: true, positionX: 50, positionY: 50, rotation: -45 }), 
                                                          text: newText 
                                                      };
                                                      setEditConfig({...editConfig, watermarkText: newText, watermarkConfig: newConfig});
                                                  }}
                                                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white font-mono"
                                                  placeholder="Watermark Text" 
                                              />
                                          </div>

                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => setEditConfig({
                                                      ...editConfig, 
                                                      watermarkConfig: { ...editConfig.watermarkConfig!, isRepeating: true }
                                                  })}
                                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${editConfig.watermarkConfig?.isRepeating !== false ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                              >
                                                  🔁 Repeat (All Over)
                                              </button>
                                              <button 
                                                  onClick={() => setEditConfig({
                                                      ...editConfig, 
                                                      watermarkConfig: { ...editConfig.watermarkConfig!, isRepeating: false, opacity: 1, backgroundColor: '#000000', color: '#ffffff', rotation: 0 }
                                                  })}
                                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${editConfig.watermarkConfig?.isRepeating === false ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                              >
                                                  🎯 Fixed (Redact)
                                              </button>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Opacity ({((editConfig.watermarkConfig?.opacity || 0.3)*100).toFixed(0)}%)</label>
                                                  <input 
                                                      type="range" min="0" max="1" step="0.1" 
                                                      value={editConfig.watermarkConfig?.opacity ?? 0.3} 
                                                      onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, opacity: parseFloat(e.target.value)}})}
                                                      className="w-full accent-purple-500"
                                                  />
                                              </div>
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Size ({editConfig.watermarkConfig?.fontSize ?? 20}px)</label>
                                                  <input 
                                                      type="range" min="10" max="100" step="2" 
                                                      value={editConfig.watermarkConfig?.fontSize ?? 20} 
                                                      onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, fontSize: parseInt(e.target.value)}})}
                                                      className="w-full accent-purple-500"
                                                  />
                                              </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Text Color</label>
                                                  <input type="color" value={editConfig.watermarkConfig?.color || '#000000'} onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, color: e.target.value}})} className="w-full h-8 rounded bg-transparent border border-slate-600" />
                                              </div>
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Background</label>
                                                  <div className="flex gap-2">
                                                       <input type="color" value={editConfig.watermarkConfig?.backgroundColor === 'transparent' ? '#000000' : editConfig.watermarkConfig?.backgroundColor} onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, backgroundColor: e.target.value}})} className="w-8 h-8 rounded bg-transparent border border-slate-600" />
                                                       <button onClick={() => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, backgroundColor: 'transparent'}})} className="text-[10px] bg-slate-700 px-2 rounded text-slate-300">None</button>
                                                  </div>
                                              </div>
                                          </div>

                                          {/* POSITIONING CONTROLS (Only for Fixed) */}
                                          {editConfig.watermarkConfig?.isRepeating === false && (
                                              <div className="bg-slate-900 p-3 rounded-lg border border-slate-600">
                                                  <p className="text-[10px] font-bold text-purple-400 uppercase mb-2">Positioning (Use Sliders)</p>
                                                  <div className="space-y-2">
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-xs text-slate-400 w-4">X</span>
                                                          <input 
                                                              type="range" min="0" max="100" 
                                                              value={editConfig.watermarkConfig?.positionX ?? 50} 
                                                              onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, positionX: parseInt(e.target.value)}})}
                                                              className="flex-1 accent-blue-500"
                                                          />
                                                          <span className="text-xs text-slate-400 w-8">{editConfig.watermarkConfig?.positionX}%</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-xs text-slate-400 w-4">Y</span>
                                                          <input 
                                                              type="range" min="0" max="100" 
                                                              value={editConfig.watermarkConfig?.positionY ?? 50} 
                                                              onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, positionY: parseInt(e.target.value)}})}
                                                              className="flex-1 accent-blue-500"
                                                          />
                                                          <span className="text-xs text-slate-400 w-8">{editConfig.watermarkConfig?.positionY}%</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          )}
                                      </div>

                                      {/* LIVE PREVIEW BOX */}
                                      <div className="flex flex-col gap-2">
                                          <div className="flex justify-between items-center">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Preview PDF (Upload Local File)</label>
                                              <input 
                                                  type="file" 
                                                  accept="application/pdf"
                                                  onChange={(e) => {
                                                      if(e.target.files && e.target.files[0]) {
                                                          setPreviewPdfFile(e.target.files[0]);
                                                      }
                                                  }}
                                                  className="text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                              />
                                          </div>

                                          <div className="relative bg-slate-900 border-2 border-slate-600 rounded-xl overflow-hidden min-h-[400px] flex items-center justify-center">
                                              {previewPdfFile ? (
                                                  <Document
                                                      file={previewPdfFile}
                                                      onLoadSuccess={onDocumentLoadSuccess}
                                                      className="relative shadow-2xl" 
                                                  >
                                                      <Page 
                                                          pageNumber={1} 
                                                          width={300} 
                                                          renderTextLayer={false}
                                                          renderAnnotationLayer={false}
                                                      />
                                                      
                                                      {/* WATERMARK OVERLAY - ABSOLUTE TO PAGE */}
                                                      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                                                          {editConfig.watermarkConfig?.isRepeating !== false ? (
                                                              /* REPEATING PREVIEW */
                                                              <div className="w-full h-full flex flex-col items-center justify-center gap-12 opacity-100">
                                                                  {Array.from({length: 6}).map((_, i) => (
                                                                      <div key={i} style={{ transform: `rotate(${editConfig.watermarkConfig?.rotation ?? -45}deg)` }}>
                                                                          <span style={{
                                                                              color: editConfig.watermarkConfig?.color || '#000000',
                                                                              backgroundColor: editConfig.watermarkConfig?.backgroundColor || 'transparent',
                                                                              opacity: editConfig.watermarkConfig?.opacity ?? 0.3,
                                                                              fontSize: `${(editConfig.watermarkConfig?.fontSize ?? 20) / 2}px`, 
                                                                              padding: '4px 12px',
                                                                              fontWeight: '900',
                                                                              textTransform: 'uppercase'
                                                                          }}>
                                                                              {editConfig.watermarkConfig?.text || 'WATERMARK'}
                                                                          </span>
                                                                      </div>
                                                                  ))}
                                                              </div>
                                                          ) : (
                                                              /* FIXED POSITION PREVIEW */
                                                              <div 
                                                                  className="absolute px-4 py-2 font-black uppercase tracking-widest shadow-xl whitespace-nowrap"
                                                                  style={{
                                                                      left: `${editConfig.watermarkConfig?.positionX ?? 50}%`,
                                                                      top: `${editConfig.watermarkConfig?.positionY ?? 50}%`,
                                                                      transform: 'translate(-50%, -50%)',
                                                                      color: editConfig.watermarkConfig?.color || '#ffffff',
                                                                      backgroundColor: editConfig.watermarkConfig?.backgroundColor || '#000000',
                                                                      opacity: editConfig.watermarkConfig?.opacity ?? 1,
                                                                      fontSize: `${(editConfig.watermarkConfig?.fontSize ?? 20) / 1.5}px`
                                                                  }}
                                                              >
                                                                  {editConfig.watermarkConfig?.text || 'REDACTED'}
                                                              </div>
                                                          )}
                                                      </div>
                                                  </Document>
                                              ) : (
                                                  <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
                                                      <FileText size={64} className="text-slate-500" />
                                                      <span className="absolute mt-20 text-slate-500 font-bold">UPLOAD PDF TO PREVIEW</span>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                               </div>

                              <button onClick={saveChapterContent} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow hover:bg-blue-700">Save PDF Links & Watermark</button>
                          </div>
                      )}

                      {/* VIDEO EDITOR (Dynamic List up to 100) */}
                      {activeTab === 'CONTENT_VIDEO' && (
                          <div className="space-y-6 bg-gradient-to-br from-rose-50 to-pink-50 p-6 rounded-xl border border-rose-200">
                              <div className="flex items-center gap-2 mb-3">
                                  <Video size={20} className="text-rose-600" />
                                  <h4 className="font-bold text-rose-900">Video Playlist Manager (Max 100)</h4>
                              </div>
                              
                              <p className="text-xs text-rose-700 mb-4 bg-white p-2 rounded border border-rose-100">
                                  Enter YouTube or Google Drive links. Set Price to 0 for Free videos.
                              </p>

                              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                  {videoPlaylist.map((vid, i) => {
                                      // Ensure valid object structure with optional price defaulting
                                      // const existing = videoPlaylist[i];
                                      // const vid = existing && typeof existing === 'object' ? existing : {title: '', url: '', price: 5};
                                      
                                      return (
                                          <div key={i} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-rose-100 shadow-sm">
                                              <div className="flex gap-2 items-center">
                                                  <span className="w-8 text-center text-xs font-bold text-rose-500 bg-rose-50 rounded py-2">{i + 1}</span>
                                                  
                                                  <input 
                                                      type="text" 
                                                      value={vid.title || ''} 
                                                      onChange={(e) => {
                                                          const updated = [...videoPlaylist];
                                                          updated[i] = {...updated[i], title: e.target.value};
                                                          setVideoPlaylist(updated);
                                                      }}
                                                      placeholder={`Title (e.g. Lecture ${i + 1})`}
                                                      className="flex-1 p-2 border border-slate-200 rounded text-xs font-bold text-slate-700" 
                                                  />
                                                  
                                                  {/* ACCESS CONTROL */}
                                                  <select
                                                      value={vid.access || 'ULTRA'}
                                                      onChange={(e) => {
                                                          const updated = [...videoPlaylist];
                                                          updated[i] = {...updated[i], access: e.target.value as any};
                                                          setVideoPlaylist(updated);
                                                      }}
                                                      className={`p-2 rounded text-xs font-bold border ${
                                                          vid.access === 'FREE' ? 'bg-green-50 text-green-700 border-green-200' :
                                                          vid.access === 'BASIC' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                          'bg-purple-50 text-purple-700 border-purple-200'
                                                      }`}
                                                  >
                                                      <option value="FREE">FREE</option>
                                                      <option value="BASIC">BASIC</option>
                                                      <option value="ULTRA">ULTRA</option>
                                                  </select>

                                                  <div className="w-16">
                                                      <input 
                                                          type="number" 
                                                          value={vid.price !== undefined ? vid.price : 5} 
                                                          onChange={(e) => {
                                                              const updated = [...videoPlaylist];
                                                              updated[i] = {...updated[i], price: Number(e.target.value)};
                                                              setVideoPlaylist(updated);
                                                          }}
                                                          className="w-full p-2 border border-slate-200 rounded text-xs text-center font-bold" 
                                                          placeholder="Price"
                                                      />
                                                  </div>

                                                  <button 
                                                      onClick={() => {
                                                          const updated = videoPlaylist.filter((_, idx) => idx !== i);
                                                          setVideoPlaylist(updated);
                                                      }}
                                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                      title="Remove Video"
                                                  >
                                                      <Trash2 size={16} />
                                                  </button>
                                              </div>

                                              <input 
                                                  type="text" 
                                                  value={vid.url || ''} 
                                                  onChange={(e) => {
                                                      const updated = [...videoPlaylist];
                                                      updated[i] = {...updated[i], url: e.target.value};
                                                      setVideoPlaylist(updated);
                                                  }}
                                                  placeholder="https://youtu.be/..."
                                                  className="w-full p-2 border border-slate-200 rounded text-xs font-mono text-blue-600 bg-slate-50" 
                                              />
                                          </div>
                                      );
                                  })}
                              </div>

                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => {
                                          if (videoPlaylist.length >= 100) {
                                              alert("Max 100 videos limit reached!");
                                              return;
                                          }
                                          setVideoPlaylist([...videoPlaylist, {title: '', url: '', price: 5, access: 'ULTRA'}]);
                                      }}
                                      className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition dashed"
                                  >
                                      + Add Video
                                  </button>
                                  <button onClick={saveChapterContent} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl shadow hover:bg-rose-700 transition">
                                      💾 Save Videos
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* HTML MODULES EDITOR */}
                      {activeTab === 'CONTENT_HTML' && (
                          <div className="space-y-6 bg-gradient-to-br from-indigo-50 to-cyan-50 p-6 rounded-xl border border-indigo-200">
                              <div className="flex items-center gap-2 mb-3">
                                  <Globe size={20} className="text-indigo-600" />
                                  <h4 className="font-bold text-indigo-900">Interactive HTML Modules (10 Slots)</h4>
                              </div>
                              <p className="text-xs text-indigo-700 mb-4 bg-white p-2 rounded border border-indigo-100">
                                  Enter Google Drive Link for HTML file. Must be shared publicly.
                              </p>

                              <div className="space-y-3">
                                  {Array.from({length: 10}).map((_, i) => {
                                      const modules = editConfig.htmlModules || [];
                                      const mod = modules[i] || { id: `html-${i}`, title: '', url: '', price: 5, access: 'BASIC' };
                                      
                                      const updateModule = (field: string, val: any) => {
                                          const newModules = [...modules];
                                          while(newModules.length <= i) {
                                              newModules.push({ id: `html-${newModules.length}`, title: '', url: '', price: 5, access: 'BASIC' });
                                          }
                                          newModules[i] = { ...newModules[i], [field]: val };
                                          setEditConfig({ ...editConfig, htmlModules: newModules });
                                      };

                                      return (
                                          <div key={i} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-indigo-100">
                                              <div className="flex gap-2 items-center">
                                                  <span className="w-8 text-center text-xs font-bold text-indigo-500 bg-indigo-50 rounded py-2">{i + 1}</span>
                                                  <input 
                                                      type="text" 
                                                      value={mod.title} 
                                                      onChange={e => updateModule('title', e.target.value)}
                                                      placeholder={`Module Title (e.g. Lab ${i+1})`}
                                                      className="flex-1 p-2 border border-slate-200 rounded text-xs font-bold"
                                                  />
                                                  <select 
                                                      value={mod.access} 
                                                      onChange={e => updateModule('access', e.target.value)}
                                                      className="w-24 p-2 border border-slate-200 rounded text-xs bg-slate-50"
                                                  >
                                                      <option value="FREE">Free</option>
                                                      <option value="BASIC">Basic</option>
                                                      <option value="ULTRA">Ultra</option>
                                                  </select>
                                                  <div className="w-16">
                                                      <input 
                                                          type="number" 
                                                          value={mod.price} 
                                                          onChange={e => updateModule('price', Number(e.target.value))}
                                                          className="w-full p-2 border border-slate-200 rounded text-xs text-center font-bold"
                                                          placeholder="Price"
                                                      />
                                                  </div>
                                              </div>
                                              <input 
                                                  type="text" 
                                                  value={mod.url} 
                                                  onChange={e => updateModule('url', e.target.value)}
                                                  placeholder="Google Drive Link (e.g. https://drive.google.com/file/...)"
                                                  className="w-full p-2 border border-slate-200 rounded text-xs font-mono text-blue-600"
                                              />
                                          </div>
                                      );
                                  })}
                              </div>
                              <button onClick={saveChapterContent} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow hover:bg-indigo-700 transition">💾 Save HTML Modules</button>
                          </div>
                      )}


                      {/* MCQ / TEST EDITOR */}
                      {(activeTab === 'CONTENT_MCQ' || activeTab === 'CONTENT_TEST') && (
                          <div className="space-y-4">
                              {/* GOOGLE SHEETS IMPORT */}
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                      <div className="bg-green-100 p-2 rounded text-green-700">
                                          <Database size={18} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800 text-sm">Bulk Import from Google Sheets</h4>
                                          <p className="text-[10px] text-slate-500">Copy cells from Excel/Sheets and paste below</p>
                                      </div>
                                  </div>

                                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-600 mb-2 border border-slate-200 font-mono">
                                      <strong>Supported Formats:</strong><br/>
                                      1. Copy from Excel (7 Columns): Q | Opt A | Opt B | Opt C | Opt D | Ans(1-4) | Exp<br/>
                                      2. Vertical List: Q \n 4 Options \n Answer \n Explanation (Multi-line). <br/>
                                      *Note: For multi-line explanation, ensure next Question starts with "1.", "2." etc.
                                  </div>

                                  <textarea 
                                      value={importText} 
                                      onChange={e => setImportText(e.target.value)}
                                      placeholder={`Example:
What is 2+2?    3       4       5       6       2       The answer is 4
Capital of India?       Mumbai  Delhi   Kolkata Chennai 2       Delhi is the capital`}
                                      className="w-full h-24 p-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 outline-none mb-2"
                                  />
                                  
                                  <div className="flex gap-2">
                                      <button 
                                          onClick={() => setImportText('')} 
                                          className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold text-xs hover:bg-slate-200"
                                      >
                                          Clear
                                      </button>
                                      <button 
                                          onClick={() => handleGoogleSheetImport(activeTab === 'CONTENT_TEST')} 
                                          className="flex-[2] bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow"
                                      >
                                          <Upload size={14} /> Import & Add
                                      </button>
                                  </div>
                              </div>


                              <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-slate-700">Total Questions: {(activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs).length}</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => deleteAllMcqs(activeTab === 'CONTENT_TEST')} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Delete All</button>
                                      <button onClick={() => addMcq(activeTab === 'CONTENT_TEST')} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">+ Add Question</button>
                                  <button 
                                      onClick={() => {
                                          const list = activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs;
                                          if (list.length === 0) { alert("No questions to copy!"); return; }
                                          
                                          // Format: Question \t OptA \t OptB \t OptC \t OptD \t AnswerIndex(1-4) \t Explanation
                                          const text = list.map(q => {
                                              return `${q.question}\t${q.options[0]}\t${q.options[1]}\t${q.options[2]}\t${q.options[3]}\t${q.correctAnswer + 1}\t${q.explanation || ''}`;
                                          }).join('\n');
                                          
                                          navigator.clipboard.writeText(text);
                                          alert(`✅ Copied ${list.length} questions to clipboard!\n\nPaste directly into Google Sheets or Excel.`);
                                      }}
                                      className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1"
                                  >
                                      <Copy size={14} /> Copy for Sheets
                                  </button>
                                  <button onClick={() => addMcq(activeTab === 'CONTENT_TEST')} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">+ Add Question</button>
                                      <button onClick={saveChapterContent} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-blue-700">Save All</button>
                                  </div>
                              </div>
                              
                              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-10">
                                  {(activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs).map((q, idx) => (
                                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                          <button onClick={() => removeMcq(activeTab === 'CONTENT_TEST', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                          <div className="flex gap-2 mb-2">
                                              <span className="bg-slate-100 text-slate-500 font-bold w-6 h-6 flex items-center justify-center rounded text-xs mt-1">{idx + 1}</span>
                                              <textarea 
                                                  value={q.question} 
                                                  onChange={e => updateMcq(activeTab === 'CONTENT_TEST', idx, 'question', e.target.value)} 
                                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                                                  rows={2} 
                                                  placeholder="Type question here..." 
                                              />
                                          </div>
                                          <div className="grid grid-cols-2 gap-3 ml-8">
                                              {q.options.map((opt, oIdx) => (
                                                  <div key={oIdx} className="flex items-center gap-2">
                                                      <input 
                                                          type="radio" 
                                                          name={`q-${activeTab}-${idx}`} 
                                                          checked={q.correctAnswer === oIdx} 
                                                          onChange={() => updateMcq(activeTab === 'CONTENT_TEST', idx, 'correctAnswer', oIdx)}
                                                          className="accent-green-600"
                                                      />
                                                      <input 
                                                          type="text" 
                                                          value={opt} 
                                                          onChange={e => updateMcqOption(activeTab === 'CONTENT_TEST', idx, oIdx, e.target.value)}
                                                          className={`w-full p-1.5 border rounded text-xs ${q.correctAnswer === oIdx ? 'border-green-300 bg-green-50 text-green-800 font-bold' : 'border-slate-200'}`}
                                                          placeholder={`Option ${String.fromCharCode(65+oIdx)}`}
                                                      />
                                                  </div>
                                              ))}
                                          </div>
                                          <div className="ml-8 mt-2">
                                              <input 
                                                  type="text" 
                                                  value={q.explanation} 
                                                  onChange={e => updateMcq(activeTab === 'CONTENT_TEST', idx, 'explanation', e.target.value)}
                                                  className="w-full p-2 border border-dashed border-slate-300 rounded text-xs text-slate-600 bg-slate-50"
                                                  placeholder="Explanation (Optional)"
                                              />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      </>
                      )}
                  </div>
              )}
          </div>
      )}

      {/* 4. SETTINGS TABS */}
      {activeTab.startsWith('CONFIG_') && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Settings: {activeTab.replace('CONFIG_', '')}</h3>
              </div>
              <div className="max-w-2xl space-y-6">
                  {/* GENERAL */}
                  {activeTab === 'CONFIG_GENERAL' && (
                      <>
                          {/* LOGO UPLOAD */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                              <label className="text-xs font-bold uppercase text-slate-500 block mb-2">App Logo</label>
                              <div className="flex items-center gap-4">
                                  <div className="w-20 h-20 bg-white rounded-full border border-slate-300 flex items-center justify-center overflow-hidden">
                                      {localSettings.appLogo ? (
                                          <img src={localSettings.appLogo} alt="Logo" className="w-full h-full object-contain" />
                                      ) : (
                                          <span className="text-xs text-slate-400 font-bold">{localSettings.appShortName || 'IIC'}</span>
                                      )}
                                  </div>
                                  <div className="flex-1">
                                      <input 
                                          type="file" 
                                          accept="image/*"
                                          onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  // Check size (e.g., max 2MB before crop)
                                                  if (file.size > 2 * 1024 * 1024) {
                                                      alert("Image too large! Please select an image under 2MB.");
                                                      return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                      setCropImageSrc(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                              }
                                          }}
                                          className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                      />
                                      <p className="text-[10px] text-slate-400 mt-1">Recommended: Square PNG/JPG</p>
                                  </div>
                                  {localSettings.appLogo && (
                                      <button 
                                          onClick={() => setLocalSettings({...localSettings, appLogo: undefined})}
                                          className="text-red-500 hover:text-red-700 p-2"
                                          title="Remove Logo"
                                      >
                                          <Trash2 size={20} />
                                      </button>
                                  )}
                              </div>
                          </div>

                          <div><label className="text-xs font-bold uppercase text-slate-500">App Name (Long)</label><input type="text" value={localSettings.appName} onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IDEAL INSPIRATION CLASSES" /></div>
                          <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-xs font-bold uppercase text-slate-500">App Short Name</label><input type="text" value={localSettings.appShortName || 'IIC'} onChange={e => setLocalSettings({...localSettings, appShortName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IIC" /></div>
                              <div><label className="text-xs font-bold uppercase text-slate-500">AI Assistant Name</label><input type="text" value={localSettings.aiName || 'IIC AI'} onChange={e => setLocalSettings({...localSettings, aiName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IIC AI" /></div>
                          </div>
                          
                          {/* CHAT MODE SELECTOR */}
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                              <label className="text-xs font-bold uppercase text-indigo-800 mb-2 block">Chat System Mode</label>
                              <div className="grid grid-cols-3 gap-2">
                                  {['PRIVATE_ONLY', 'UNIVERSAL_ONLY', 'BOTH'].map(mode => (
                                      <button 
                                          key={mode} 
                                          onClick={() => setLocalSettings({...localSettings, chatMode: mode as any})}
                                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${localSettings.chatMode === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-indigo-100 hover:bg-indigo-50'}`}
                                      >
                                          {mode.replace('_', ' ')}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* FOOTER CUSTOMIZATION */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                              <label className="text-xs font-bold uppercase text-slate-800 mb-3 block underline decoration-blue-500 decoration-2 underline-offset-4">Footer Customization</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                      <div className="flex flex-col">
                                          <span className="text-sm font-bold text-slate-700">Display Footer</span>
                                          <span className="text-[10px] text-slate-400">Show/Hide the "Developed by" line</span>
                                      </div>
                                      <button 
                                          onClick={() => setLocalSettings({...localSettings, showFooter: localSettings.showFooter === false ? true : false})}
                                          className={`w-12 h-6 rounded-full transition-colors relative ${localSettings.showFooter !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
                                      >
                                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.showFooter !== false ? 'left-7' : 'left-1'}`} />
                                      </button>
                                  </div>
                                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Custom Name / Text</label>
                                      <input 
                                          type="text" 
                                          value={localSettings.footerText || ''} 
                                          onChange={e => setLocalSettings({...localSettings, footerText: e.target.value})}
                                          className="w-full p-2 border rounded-lg text-sm font-bold"
                                          placeholder="Developed by Nadim Anwar"
                                      />
                                  </div>
                                  <div className="md:col-span-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Text Color</label>
                                      <div className="flex gap-3">
                                          <input 
                                              type="color" 
                                              value={localSettings.footerColor || '#94a3b8'} 
                                              onChange={e => setLocalSettings({...localSettings, footerColor: e.target.value})}
                                              className="h-10 w-14 rounded-lg border-2 border-slate-100 p-1 cursor-pointer"
                                          />
                                          <input 
                                              type="text" 
                                              value={localSettings.footerColor || ''} 
                                              onChange={e => setLocalSettings({...localSettings, footerColor: e.target.value})}
                                              className="flex-1 p-2 border rounded-lg text-sm font-mono bg-slate-50"
                                              placeholder="#94a3b8"
                                          />
                                          <button 
                                              onClick={() => setLocalSettings({...localSettings, footerColor: '#94a3b8'})}
                                              className="px-3 py-2 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200"
                                          >
                                              Reset
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* SPECIAL DISCOUNT EVENT MANAGER */}
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mt-4">
                              <div className="flex items-center justify-between mb-4">
                                  <label className="text-xs font-bold uppercase text-amber-800 block">Special Discount Event</label>
                                  <button 
                                      onClick={() => setLocalSettings({...localSettings, specialDiscountEvent: { ...(localSettings.specialDiscountEvent || { eventName: '', discountPercent: 0, showToFreeUsers: true, showToPremiumUsers: true }), enabled: !localSettings.specialDiscountEvent?.enabled }})}
                                      className={`w-12 h-6 rounded-full transition-colors relative ${localSettings.specialDiscountEvent?.enabled ? 'bg-amber-600' : 'bg-slate-300'}`}
                                  >
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.specialDiscountEvent?.enabled ? 'left-7' : 'left-1'}`} />
                                  </button>
                              </div>

                              {localSettings.specialDiscountEvent?.enabled && (
                                  <div className="space-y-4">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Event Name (e.g. Diwali Offer)</label>
                                          <input 
                                              type="text" 
                                              value={localSettings.specialDiscountEvent.eventName} 
                                              onChange={e => setLocalSettings({...localSettings, specialDiscountEvent: { ...localSettings.specialDiscountEvent!, eventName: e.target.value }})}
                                              className="w-full p-2 border rounded-lg text-sm font-bold"
                                              placeholder="Diwali Offer"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Standard Discount %</label>
                                              <input 
                                                  type="number" 
                                                  value={localSettings.specialDiscountEvent.discountPercent} 
                                                  onChange={e => setLocalSettings({...localSettings, specialDiscountEvent: { ...localSettings.specialDiscountEvent!, discountPercent: Number(e.target.value) }})}
                                                  className="w-full p-2 border rounded-lg text-sm font-bold"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Renewal Extra % (Existing Users)</label>
                                              <input 
                                                  type="number" 
                                                  value={localSettings.specialDiscountEvent.renewalDiscountPercent || 0} 
                                                  onChange={e => setLocalSettings({...localSettings, specialDiscountEvent: { ...localSettings.specialDiscountEvent!, renewalDiscountPercent: Number(e.target.value) }})}
                                                  className="w-full p-2 border rounded-lg text-sm font-bold"
                                              />
                                          </div>
                                      </div>
                                      <div className="flex gap-4">
                                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                              <input 
                                                  type="checkbox" 
                                                  checked={localSettings.specialDiscountEvent.showToFreeUsers} 
                                                  onChange={e => setLocalSettings({...localSettings, specialDiscountEvent: { ...localSettings.specialDiscountEvent!, showToFreeUsers: e.target.checked }})}
                                              /> Show to Free Users
                                          </label>
                                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                              <input 
                                                  type="checkbox" 
                                                  checked={localSettings.specialDiscountEvent.showToPremiumUsers} 
                                                  onChange={e => setLocalSettings({...localSettings, specialDiscountEvent: { ...localSettings.specialDiscountEvent!, showToPremiumUsers: e.target.checked }})}
                                              /> Show to Premium Users
                                          </label>
                                      </div>
                                  </div>
                              )}
                          </div>

                          <div><label className="text-xs font-bold uppercase text-slate-500">Login Screen Message</label><input type="text" value={localSettings.loginMessage} onChange={e => setLocalSettings({...localSettings, loginMessage: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          
                          <div>
                              <label className="text-xs font-bold uppercase text-slate-500">Home Screen Notice</label>
                              <textarea 
                                  value={localSettings.noticeText || ''} 
                                  onChange={e => setLocalSettings({...localSettings, noticeText: e.target.value})} 
                                  className="w-full p-3 border rounded-xl h-24"
                                  placeholder="Write a notice for students..." 
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Support Chat Cost</label>
                                  <input type="number" value={localSettings.chatCost} onChange={e => setLocalSettings({...localSettings, chatCost: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Cooldown (Hours)</label>
                                  <input type="number" value={localSettings.chatCooldownHours || 0} onChange={e => setLocalSettings({...localSettings, chatCooldownHours: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                          </div>
                          
                          {/* NEW: Extra Settings */}
                          {/* FOOTER CUSTOMIZATION */}
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mt-4">
                              <label className="text-xs font-bold uppercase text-indigo-800 mb-3 block">Footer Customization</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-100">
                                      <span className="text-sm font-medium">Show Footer</span>
                                      <button 
                                          onClick={() => setLocalSettings({...localSettings, showFooter: localSettings.showFooter === false ? true : false})}
                                          className={`w-12 h-6 rounded-full transition-colors relative ${localSettings.showFooter !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                      >
                                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.showFooter !== false ? 'left-7' : 'left-1'}`} />
                                      </button>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Footer Text</label>
                                      <input 
                                          type="text" 
                                          value={localSettings.footerText || ''} 
                                          onChange={e => setLocalSettings({...localSettings, footerText: e.target.value})}
                                          className="w-full p-2 border rounded-lg text-sm"
                                          placeholder="Developed by Nadim Anwar"
                                      />
                                  </div>
                                  <div className="md:col-span-2">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase">Footer Color (Hex)</label>
                                      <div className="flex gap-2">
                                          <input 
                                              type="color" 
                                              value={localSettings.footerColor || '#94a3b8'} 
                                              onChange={e => setLocalSettings({...localSettings, footerColor: e.target.value})}
                                              className="h-9 w-12 rounded border p-1"
                                          />
                                          <input 
                                              type="text" 
                                              value={localSettings.footerColor || ''} 
                                              onChange={e => setLocalSettings({...localSettings, footerColor: e.target.value})}
                                              className="flex-1 p-2 border rounded-lg text-sm font-mono"
                                              placeholder="#94a3b8"
                                          />
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Name Change Cost</label>
                                  <input type="number" value={localSettings.nameChangeCost ?? 10} onChange={e => setLocalSettings({...localSettings, nameChangeCost: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Chat Edit Time (Mins)</label>
                                  <input type="number" value={localSettings.chatEditTimeLimit ?? 15} onChange={e => setLocalSettings({...localSettings, chatEditTimeLimit: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                          
                          {/* SYLLABUS TYPE SELECTOR */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4">
                              <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Syllabus Mode</label>
                              <div className="flex gap-4">
                                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                      <input 
                                          type="radio" 
                                          name="syllabusType" 
                                          checked={localSettings.syllabusType === 'SCHOOL'} 
                                          onChange={() => setLocalSettings({...localSettings, syllabusType: 'SCHOOL'})}
                                      /> School
                                  </label>
                                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                      <input 
                                          type="radio" 
                                          name="syllabusType" 
                                          checked={localSettings.syllabusType === 'COMPETITIVE'} 
                                          onChange={() => setLocalSettings({...localSettings, syllabusType: 'COMPETITIVE'})}
                                      /> Competition
                                  </label>
                                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                      <input 
                                          type="radio" 
                                          name="syllabusType" 
                                          checked={localSettings.syllabusType === 'DUAL'} 
                                          onChange={() => setLocalSettings({...localSettings, syllabusType: 'DUAL'})}
                                      /> Dual Mode (Both)
                                  </label>
                              </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200 mt-4 relative h-16">
                              <button 
                                  onMouseDown={handleMouseDown}
                                  onClick={() => {
                                      if (isDragging) return;
                                      if (confirm("Force Refresh ALL Students?\nThis will reload their app to apply latest updates.")) {
                                          setLocalSettings({...localSettings, forceRefreshTimestamp: Date.now().toString()});
                                      }
                                  }}
                                  style={{
                                    transform: `translate(${buttonPos.x}px, ${buttonPos.y}px)`,
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    zIndex: 50,
                                    position: buttonPos.x !== 0 || buttonPos.y !== 0 ? 'fixed' : 'relative',
                                    left: buttonPos.x !== 0 || buttonPos.y !== 0 ? 'auto' : '0',
                                    top: buttonPos.x !== 0 || buttonPos.y !== 0 ? 'auto' : '0',
                                  }}
                                  className={`w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg touch-none select-none ${isDragging ? 'opacity-80' : ''}`}
                              >
                                  ⚠️ Force Update All Apps
                              </button>
                          </div>
                          </div>

                          {/* NEW: POPUP CONTROLS */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                  <div><p className="font-bold text-slate-700 text-sm">Welcome Popup</p><p className="text-[10px] text-slate-400">Show on startup</p></div>
                                  <input type="checkbox" checked={localSettings.showWelcomePopup !== false} onChange={() => toggleSetting('showWelcomePopup')} className="w-5 h-5 accent-blue-600" />
                              </div>
                              <div className="bg-white p-3 rounded-xl border border-slate-200">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target Audience</label>
                                  <select 
                                      value={localSettings.welcomePopupTarget || 'ALL'} 
                                      onChange={e => setLocalSettings({...localSettings, welcomePopupTarget: e.target.value as any})}
                                      className="w-full p-2 border rounded-lg text-sm font-bold bg-slate-50"
                                  >
                                      <option value="ALL">Everyone (Free + Ultra)</option>
                                      <option value="FREE_ONLY">Free Users Only</option>
                                      <option value="ULTRA_ONLY">Ultra Users Only</option>
                                  </select>
                              </div>
                              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                  <div><p className="font-bold text-slate-700 text-sm">Terms Popup</p><p className="text-[10px] text-slate-400">Show terms agreement</p></div>
                                  <input type="checkbox" checked={localSettings.showTermsPopup !== false} onChange={() => toggleSetting('showTermsPopup')} className="w-5 h-5 accent-blue-600" />
                              </div>
                          </div>

                          <div className="flex items-center justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                              <div><p className="font-bold text-red-800">Maintenance Mode</p><p className="text-xs text-red-600">Lock app for users</p></div>
                              <input type="checkbox" checked={localSettings.maintenanceMode} onChange={() => toggleSetting('maintenanceMode')} className="w-6 h-6 accent-red-600" />
                          </div>
                      </>
                  )}
                  {/* SECURITY */}
                  {activeTab === 'CONFIG_SECURITY' && (
                      <>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Admin Email</label><input type="text" value={localSettings.adminEmail || ''} onChange={e => setLocalSettings({...localSettings, adminEmail: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Admin Login Code</label><input type="text" value={localSettings.adminCode || ''} onChange={e => setLocalSettings({...localSettings, adminCode: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">API Keys (Comma Separated)</label><textarea value={localSettings.apiKeys.join(',')} onChange={e => setLocalSettings({...localSettings, apiKeys: e.target.value.split(',')})} className="w-full p-3 border rounded-xl h-32" /></div>
                      </>
                  )}
                  {/* VISIBILITY */}
                  {activeTab === 'CONFIG_VISIBILITY' && (
                      <div className="space-y-4">
                          <div>
                              <p className="font-bold text-slate-700 mb-2">Allowed Classes</p>
                              <div className="flex flex-wrap gap-2">
                                  {['6','7','8','9','10','11','12'].map(c => (
                                      <button key={c} onClick={() => setLocalSettings({...localSettings, allowedClasses: toggleItemInList(localSettings.allowedClasses, c as any)})} className={`px-4 py-2 rounded-lg border font-bold ${localSettings.allowedClasses?.includes(c as any) ? 'bg-blue-600 text-white' : 'bg-white'}`}>{c}</button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
                  {/* AI & ADS & PAYMENT */}
                  {activeTab === 'CONFIG_AI' && (
                       <>
                          <div><label className="text-xs font-bold uppercase text-slate-500">AI Model</label><select value={localSettings.aiModel} onChange={e => setLocalSettings({...localSettings, aiModel: e.target.value})} className="w-full p-3 border rounded-xl"><option value="gemini-2.5-flash">Gemini Flash</option><option value="gemini-pro">Gemini Pro</option></select></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Custom System Instruction</label><textarea value={localSettings.aiInstruction || ''} onChange={e => setLocalSettings({...localSettings, aiInstruction: e.target.value})} className="w-full p-3 border rounded-xl h-32" placeholder="You are a helpful teacher..." /></div>
                          
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-4">
                               <h4 className="font-bold text-blue-900 mb-2">Global AI Loading Screen</h4>
                               <p className="text-xs text-blue-700 mb-2">Set a default image to show while AI is loading/processing (10s delay). Can be overridden per chapter.</p>
                               <input 
                                  type="text" 
                                  value={localSettings.aiLoadingImage || ''} 
                                  onChange={e => setLocalSettings({...localSettings, aiLoadingImage: e.target.value})} 
                                  className="w-full p-3 border rounded-xl" 
                                  placeholder="https://example.com/ai-loading.jpg" 
                               />
                               {localSettings.aiLoadingImage && (
                                   <div className="mt-2 h-32 w-full rounded-xl overflow-hidden bg-slate-200">
                                       <img src={localSettings.aiLoadingImage} alt="Preview" className="w-full h-full object-cover" />
                                   </div>
                               )}
                          </div>
                       </>
                  )}
                  {activeTab === 'CONFIG_PAYMENT' && (
                       <>
                          <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                              <div><p className="font-bold text-emerald-800">Enable Payments</p><p className="text-xs text-emerald-600">Show buy options to students</p></div>
                              <input type="checkbox" checked={localSettings.isPaymentEnabled} onChange={() => toggleSetting('isPaymentEnabled')} className="w-6 h-6 accent-emerald-600" />
                          </div>

                          {/* DISCOUNT EVENT MANAGER */}
                          <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-xl border border-pink-200 mb-6">
                              <h4 className="font-bold text-pink-900 mb-4 flex items-center gap-2"><Ticket size={18} /> Discount Event Manager</h4>

                              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-pink-100 mb-4">
                                  <div>
                                      <p className="font-bold text-slate-800">Event Status</p>
                                      <p className="text-xs text-slate-500">{localSettings.specialDiscountEvent?.enabled ? `Active until ${new Date(localSettings.specialDiscountEvent.endsAt || '').toLocaleString()}` : 'Inactive'}</p>
                                  </div>
                                  <button
                                      onClick={() => setLocalSettings({
                                          ...localSettings,
                                          specialDiscountEvent: {
                                              ...(localSettings.specialDiscountEvent || { eventName: 'Flash Sale', discountPercent: 20, showToFreeUsers: true, showToPremiumUsers: false }),
                                              enabled: !localSettings.specialDiscountEvent?.enabled,
                                              endsAt: !localSettings.specialDiscountEvent?.enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined // Default 24h
                                          }
                                      })}
                                      className={`px-4 py-2 rounded-lg font-bold text-xs ${localSettings.specialDiscountEvent?.enabled ? 'bg-pink-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                                  >
                                      {localSettings.specialDiscountEvent?.enabled ? 'Stop Event' : 'Start Event'}
                                  </button>
                              </div>

                              {localSettings.specialDiscountEvent?.enabled && (
                                  <div className="space-y-4 animate-in fade-in">
                                      <div>
                                          <label className="text-xs font-bold text-pink-700 uppercase">Event Name</label>
                                          <input
                                              type="text"
                                              value={localSettings.specialDiscountEvent.eventName}
                                              onChange={(e) => setLocalSettings({
                                                  ...localSettings,
                                                  specialDiscountEvent: { ...localSettings.specialDiscountEvent!, eventName: e.target.value }
                                              })}
                                              className="w-full p-2 border border-pink-200 rounded-lg text-sm font-bold"
                                              placeholder="e.g. Diwali Dhamaka"
                                          />
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <label className="text-xs font-bold text-pink-700 uppercase">Discount %</label>
                                              <input
                                                  type="number"
                                                  value={localSettings.specialDiscountEvent.discountPercent}
                                                  onChange={(e) => setLocalSettings({
                                                      ...localSettings,
                                                      specialDiscountEvent: { ...localSettings.specialDiscountEvent!, discountPercent: Number(e.target.value) }
                                                  })}
                                                  className="w-full p-2 border border-pink-200 rounded-lg text-sm font-bold"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-xs font-bold text-pink-700 uppercase">Extend Duration</label>
                                              <div className="flex gap-2">
                                                   <button
                                                      onClick={() => setLocalSettings({
                                                          ...localSettings,
                                                          specialDiscountEvent: { 
                                                              ...localSettings.specialDiscountEvent!, 
                                                              endsAt: new Date(new Date(localSettings.specialDiscountEvent!.endsAt || Date.now()).getTime() + 1 * 60 * 60 * 1000).toISOString() 
                                                          }
                                                      })}
                                                      className="flex-1 bg-white border border-pink-200 text-pink-700 font-bold rounded-lg text-xs hover:bg-pink-100"
                                                   >
                                                      +1 Hr
                                                   </button>
                                                   <button
                                                      onClick={() => setLocalSettings({
                                                          ...localSettings,
                                                          specialDiscountEvent: { 
                                                              ...localSettings.specialDiscountEvent!, 
                                                              endsAt: new Date(new Date(localSettings.specialDiscountEvent!.endsAt || Date.now()).getTime() + 24 * 60 * 60 * 1000).toISOString() 
                                                          }
                                                      })}
                                                      className="flex-1 bg-white border border-pink-200 text-pink-700 font-bold rounded-lg text-xs hover:bg-pink-100"
                                                   >
                                                      +24 Hrs
                                                   </button>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="flex gap-4">
                                           <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                               <input 
                                                  type="checkbox" 
                                                  checked={localSettings.specialDiscountEvent.showToFreeUsers}
                                                  onChange={(e) => setLocalSettings({
                                                      ...localSettings,
                                                      specialDiscountEvent: { ...localSettings.specialDiscountEvent!, showToFreeUsers: e.target.checked }
                                                  })}
                                                  className="accent-pink-600"
                                               /> Show to Free Users
                                           </label>
                                           <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                               <input 
                                                  type="checkbox" 
                                                  checked={localSettings.specialDiscountEvent.showToPremiumUsers}
                                                  onChange={(e) => setLocalSettings({
                                                      ...localSettings,
                                                      specialDiscountEvent: { ...localSettings.specialDiscountEvent!, showToPremiumUsers: e.target.checked }
                                                  })}
                                                  className="accent-pink-600"
                                               /> Show to Premium Users
                                           </label>
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* PAYMENT NUMBERS MANAGER */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                              <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><MessageSquare size={18} className="text-green-600" /> WhatsApp Support Numbers</h4>
                              <p className="text-xs text-slate-500 mb-4">Add multiple numbers to distribute student traffic. Maximum 1000 users per day per number is recommended.</p>
                              
                              <div className="space-y-3 mb-4">
                                  {localSettings.paymentNumbers?.map((num, idx) => (
                                      <div key={num.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">{num.name}</p>
                                              <p className="text-xs text-slate-500 font-mono">{num.number}</p>
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <div className="text-right">
                                                  <p className="text-xs font-bold text-slate-400 uppercase">Traffic</p>
                                                  <div className="flex items-center gap-1">
                                                       <p className="font-black text-green-600">{num.dailyClicks || 0}</p>
                                                       <button 
                                                           onClick={() => {
                                                               const updated = [...(localSettings.paymentNumbers || [])];
                                                               updated[idx].dailyClicks = 0;
                                                               setLocalSettings({...localSettings, paymentNumbers: updated});
                                                           }}
                                                           className="text-[9px] text-slate-400 underline hover:text-slate-600 ml-1"
                                                       >
                                                           Reset
                                                       </button>
                                                  </div>
                                              </div>
                                              <button 
                                                  onClick={() => {
                                                      const updated = localSettings.paymentNumbers!.filter((_, i) => i !== idx);
                                                      setLocalSettings({...localSettings, paymentNumbers: updated});
                                                  }}
                                                  className="text-red-400 hover:text-red-600 p-2"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex gap-2">
                                  <input type="text" id="newPayName" placeholder="Name (e.g. Sales 1)" className="flex-1 p-2 border rounded-lg text-sm" />
                                  <input type="text" id="newPayNum" placeholder="Number (9199...)" className="flex-1 p-2 border rounded-lg text-sm" />
                                  <button 
                                      onClick={() => {
                                          const name = (document.getElementById('newPayName') as HTMLInputElement).value;
                                          const num = (document.getElementById('newPayNum') as HTMLInputElement).value;
                                          if(name && num) {
                                              const newEntry = {
                                                  id: `pay-${Date.now()}`,
                                                  name,
                                                  number: num,
                                                  dailyClicks: 0,
                                                  lastResetDate: new Date().toDateString()
                                              };
                                              setLocalSettings({...localSettings, paymentNumbers: [...(localSettings.paymentNumbers || []), newEntry]});
                                              (document.getElementById('newPayName') as HTMLInputElement).value = '';
                                              (document.getElementById('newPayNum') as HTMLInputElement).value = '';
                                          }
                                      }}
                                      className="bg-green-600 text-white px-4 rounded-lg font-bold text-xs"
                                  >
                                      Add Number
                                  </button>
                              </div>
                          </div>
                          
                          {/* PACKAGE MANAGER */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShoppingBag size={18} /> Store Packages Manager</h4>
                              
                              <div className="grid gap-3 mb-6">
                                  {(!localSettings.packages || localSettings.packages.length === 0) && <p className="text-xs text-slate-400">No packages defined. Default list will be shown to users.</p>}
                                  {localSettings.packages?.map(pkg => (
                                      <div key={pkg.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">{pkg.name}</p>
                                              <p className="text-xs text-slate-500">₹{pkg.price} = {pkg.credits} Credits</p>
                                          </div>
                                          <button onClick={() => removePackage(pkg.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex gap-2 items-end">
                                  <div className="flex-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Name</label>
                                      <input type="text" placeholder="Pro Pack" value={newPkgName} onChange={e => setNewPkgName(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Price (₹)</label>
                                      <input type="number" placeholder="99" value={newPkgPrice} onChange={e => setNewPkgPrice(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Credits</label>
                                      <input type="number" placeholder="50" value={newPkgCredits} onChange={e => setNewPkgCredits(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <button onClick={addPackage} className="bg-emerald-600 text-white p-2 rounded-lg h-[38px] w-[38px] flex items-center justify-center hover:bg-emerald-700 shadow"><Plus size={20} /></button>
                              </div>
                          </div>
                       </>
                  )}

                  {activeTab === 'CONFIG_WATERMARK' && renderWatermarkConfig()}
                  {activeTab === 'CONFIG_ADS' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="flex items-center justify-between mb-4">
                               <span className="font-bold">Startup Popup Ad</span>
                               <input type="checkbox" checked={localSettings.startupAd?.enabled} onChange={() => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, enabled: !localSettings.startupAd?.enabled}})} className="w-5 h-5 accent-blue-600" />
                           </div>
                           <input type="text" value={localSettings.startupAd?.title} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, title: e.target.value}})} className="w-full p-2 border rounded mb-2" placeholder="Ad Title" />
                           <div className="grid grid-cols-2 gap-2">
                               <input type="color" value={localSettings.startupAd?.bgColor} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, bgColor: e.target.value}})} className="w-full h-10 p-1 border rounded" />
                               <input type="color" value={localSettings.startupAd?.textColor} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, textColor: e.target.value}})} className="w-full h-10 p-1 border rounded" />
                           </div>
                       </div>
                  )}
                  {activeTab === 'CONFIG_GAME' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2"><Gamepad2 size={18} /> Spin Wheel Configuration</h4>
                           
                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Game Cost (Credits)</label>
                               <input type="number" value={localSettings.gameCost} onChange={e => setLocalSettings({...localSettings, gameCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                               <p className="text-[10px] text-slate-400">Set 0 for free entry within daily limits.</p>
                           </div>

                           <div className="grid grid-cols-3 gap-4 pt-2 border-b border-slate-200 pb-4">
                               <div>
                                   <label className="text-xs font-bold text-purple-600 uppercase block mb-1">Ultra Limit</label>
                                   <input type="number" value={localSettings.spinLimitUltra} onChange={e => setLocalSettings({...localSettings, spinLimitUltra: Number(e.target.value)})} className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Real Users</p>
                               </div>
                               <div>
                                   <label className="text-xs font-bold text-blue-600 uppercase block mb-1">Basic Limit</label>
                                   <input type="number" value={localSettings.spinLimitBasic} onChange={e => setLocalSettings({...localSettings, spinLimitBasic: Number(e.target.value)})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Real Users</p>
                               </div>
                               <div>
                                   <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Normal/Free</label>
                                   <input type="number" value={localSettings.spinLimitFree} onChange={e => setLocalSettings({...localSettings, spinLimitFree: Number(e.target.value)})} className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Others</p>
                               </div>
                           </div>

                           {/* PRIZE CONFIGURATION */}
                           <div>
                               <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                   <Gift size={16} /> Prize Wheel Items
                               </h5>
                               
                               {/* List of current prizes */}
                               <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                   {(localSettings.wheelRewards || []).map((reward: any, idx: number) => {
                                       // Normalize for display
                                       const r = typeof reward === 'number' ? { id: idx, type: 'COINS', value: reward, label: `${reward} CR` } : reward;
                                       return (
                                           <div key={r.id || idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                               <div className="flex items-center gap-2">
                                                   <div className="w-4 h-4 rounded-full" style={{backgroundColor: r.color || '#ccc'}}></div>
                                                   <span className="text-xs font-bold text-slate-700">{r.label}</span>
                                                   <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-mono">{r.type}</span>
                                               </div>
                                               <button onClick={() => {
                                                   const updated = [...(localSettings.wheelRewards || [])];
                                                   updated.splice(idx, 1);
                                                   setLocalSettings({...localSettings, wheelRewards: updated});
                                               }} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                                           </div>
                                       );
                                   })}
                               </div>

                               {/* Add New Prize Form */}
                               <div className="bg-white p-3 rounded-lg border border-slate-200">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Add New Prize</p>
                                   <div className="grid grid-cols-2 gap-2 mb-2">
                                       <select 
                                           value={newReward.type} 
                                           onChange={e => setNewReward({...newReward, type: e.target.value as any})}
                                           className="p-2 border rounded text-xs bg-slate-50"
                                       >
                                           <option value="COINS">Coins</option>
                                           <option value="SUBSCRIPTION">Subscription</option>
                                       </select>
                                       
                                       {newReward.type === 'COINS' ? (
                                           <input type="number" placeholder="Amount" value={newReward.value} onChange={e => setNewReward({...newReward, value: Number(e.target.value), label: `${e.target.value} Coins`})} className="p-2 border rounded text-xs" />
                                       ) : (
                                           <select 
                                               value={String(newReward.value)} 
                                               onChange={e => setNewReward({...newReward, value: e.target.value, label: e.target.value.toString().replace('_', ' ')})}
                                               className="p-2 border rounded text-xs"
                                           >
                                               <option value="WEEKLY_BASIC">Weekly Basic</option>
                                               <option value="MONTHLY_ULTRA">Monthly Ultra</option>
                                               <option value="YEARLY_ULTRA">Yearly Ultra</option>
                                           </select>
                                       )}
                                   </div>
                                   <div className="grid grid-cols-2 gap-2 mb-2">
                                       <input type="text" placeholder="Label (Display Name)" value={newReward.label} onChange={e => setNewReward({...newReward, label: e.target.value})} className="p-2 border rounded text-xs" />
                                       <div className="flex items-center gap-2 border rounded p-1">
                                            <input type="color" value={newReward.color} onChange={e => setNewReward({...newReward, color: e.target.value})} className="w-8 h-6 p-0 border-0 rounded" />
                                            <span className="text-[10px] text-slate-400">{newReward.color}</span>
                                       </div>
                                   </div>
                                   <button 
                                       onClick={() => {
                                           const item = { ...newReward, id: `rew-${Date.now()}` };
                                           // Cast to any to avoid type conflict with number[] legacy
                                           setLocalSettings({ ...localSettings, wheelRewards: [...(localSettings.wheelRewards || []), item] });
                                       }}
                                       className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700"
                                   >
                                       + Add Prize
                                   </button>
                               </div>
                           </div>
                       </div>
                  )}
                  {activeTab === 'CONFIG_EXTERNAL_APPS' && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe size={18} /> Manage External Apps</h4>
                          <p className="text-xs text-slate-500 mb-4">Add up to 4 apps/websites. These will appear in the Student Dashboard.</p>
                          
                          <div className="space-y-3 mb-6">
                              {(localSettings.externalApps || []).map((app, idx) => (
                                  <div key={app.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                      <div className="flex justify-between items-start">
                                          <span className="font-bold text-sm text-slate-800">{app.name}</span>
                                          <button onClick={() => {
                                              const updated = localSettings.externalApps!.filter((_, i) => i !== idx);
                                              setLocalSettings({...localSettings, externalApps: updated});
                                          }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                      </div>
                                      <p className="text-[10px] text-blue-600 truncate">{app.url}</p>
                                      
                                      <div className="flex gap-2 text-xs items-center">
                                          <label className="flex items-center gap-1 font-bold text-slate-600">
                                              <input 
                                                  type="checkbox" 
                                                  checked={app.isLocked} 
                                                  onChange={e => {
                                                      const updated = [...localSettings.externalApps!];
                                                      updated[idx].isLocked = e.target.checked;
                                                      setLocalSettings({...localSettings, externalApps: updated});
                                                  }} 
                                              /> Lock
                                          </label>
                                          <div className="flex items-center gap-1 ml-auto">
                                              <span className="font-bold text-slate-500">Price:</span>
                                              <input 
                                                  type="number" 
                                                  value={app.creditCost} 
                                                  onChange={e => {
                                                      const updated = [...localSettings.externalApps!];
                                                      updated[idx].creditCost = Number(e.target.value);
                                                      setLocalSettings({...localSettings, externalApps: updated});
                                                  }} 
                                                  className="w-16 p-1 border rounded text-center font-bold"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {(localSettings.externalApps?.length || 0) < 20 && (
                              <button 
                                  onClick={() => {
                                      const newApp = {
                                          id: `app-${Date.now()}`,
                                          name: 'New App',
                                          url: 'https://google.com',
                                          isLocked: false,
                                          creditCost: 0
                                      };
                                      setLocalSettings({...localSettings, externalApps: [...(localSettings.externalApps || []), newApp]});
                                  }}
                                  className="w-full py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-200 dashed"
                              >
                                  + Add App Slot
                              </button>
                          )}
                          
                          {(localSettings.externalApps || []).length > 0 && (
                              <div className="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                                  <strong>Edit Names/URLs:</strong> Edit the display names and destination links for your external app slots.
                              </div>
                          )}
                          
                          {(localSettings.externalApps || []).map((app, idx) => (
                              <div key={`edit-${app.id}`} className="mt-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">App Display Name</label>
                                          <input 
                                              type="text" 
                                              value={app.name} 
                                              onChange={e => {
                                                   const updated = [...localSettings.externalApps!];
                                                   updated[idx].name = e.target.value;
                                                   setLocalSettings({...localSettings, externalApps: updated});
                                              }} 
                                              className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" 
                                              placeholder="e.g. Google Drive"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">App URL (HTTPS)</label>
                                          <input 
                                              type="text" 
                                              value={app.url} 
                                              onChange={e => {
                                                   const updated = [...localSettings.externalApps!];
                                                   updated[idx].url = e.target.value;
                                                   setLocalSettings({...localSettings, externalApps: updated});
                                              }} 
                                              className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" 
                                              placeholder="https://..."
                                          />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  {activeTab === 'CONFIG_REWARDS' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2"><Gift size={18} /> Engagement Rewards (Padhai karo aur rewards jito)</h4>
                           <p className="text-xs text-slate-500">
                               Configure rewards for students based on their daily study time.
                               <br/>Time is tracked when student is online and active.
                           </p>
                           
                           <div className="space-y-4">
                               {localSettings.engagementRewards?.map((reward, idx) => (
                                   <div key={reward.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                       <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                                    {(reward.seconds / 60).toFixed(0)} Mins
                                                </span>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${reward.type === 'COINS' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {reward.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={reward.enabled} 
                                                        onChange={e => {
                                                            const updated = [...(localSettings.engagementRewards || [])];
                                                            updated[idx].enabled = e.target.checked;
                                                            setLocalSettings({...localSettings, engagementRewards: updated});
                                                        }}
                                                    /> Active
                                                </label>
                                                <button onClick={() => {
                                                    const updated = localSettings.engagementRewards!.filter((_, i) => i !== idx);
                                                    setLocalSettings({...localSettings, engagementRewards: updated});
                                                }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                            </div>
                                       </div>
                                       
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                           <div>
                                               <label className="text-[10px] font-bold text-slate-400 uppercase">Time (Seconds)</label>
                                               <input 
                                                   type="number" 
                                                   value={reward.seconds} 
                                                   onChange={e => {
                                                       const updated = [...(localSettings.engagementRewards || [])];
                                                       updated[idx].seconds = Number(e.target.value);
                                                       setLocalSettings({...localSettings, engagementRewards: updated});
                                                   }} 
                                                   className="w-full p-2 border rounded-lg text-sm"
                                               />
                                               <p className="text-[9px] text-slate-400 text-right">={(reward.seconds / 60).toFixed(1)} mins</p>
                                           </div>
                                           <div>
                                               <label className="text-[10px] font-bold text-slate-400 uppercase">Display Label</label>
                                               <input 
                                                   type="text" 
                                                   value={reward.label} 
                                                   onChange={e => {
                                                       const updated = [...(localSettings.engagementRewards || [])];
                                                       updated[idx].label = e.target.value;
                                                       setLocalSettings({...localSettings, engagementRewards: updated});
                                                   }} 
                                                   className="w-full p-2 border rounded-lg text-sm"
                                               />
                                           </div>
                                       </div>

                                       <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                           <div className="flex gap-4 mb-2">
                                               <label className="flex items-center gap-1 text-xs">
                                                   <input 
                                                       type="radio" 
                                                       checked={reward.type === 'COINS'} 
                                                       onChange={() => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].type = 'COINS';
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }}
                                                   /> Coins
                                               </label>
                                               <label className="flex items-center gap-1 text-xs">
                                                   <input 
                                                       type="radio" 
                                                       checked={reward.type === 'SUBSCRIPTION'} 
                                                       onChange={() => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].type = 'SUBSCRIPTION';
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }}
                                                   /> Subscription
                                               </label>
                                           </div>

                                           {reward.type === 'COINS' ? (
                                               <div>
                                                   <label className="text-[10px] font-bold text-slate-400 uppercase">Coin Amount</label>
                                                   <input 
                                                       type="number" 
                                                       value={reward.amount || 0} 
                                                       onChange={e => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].amount = Number(e.target.value);
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }} 
                                                       className="w-full p-2 border rounded-lg text-sm"
                                                   />
                                               </div>
                                           ) : (
                                               <div className="grid grid-cols-3 gap-2">
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Tier</label>
                                                       <select 
                                                           value={reward.subTier} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               // @ts-ignore
                                                               updated[idx].subTier = e.target.value;
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-xs"
                                                       >
                                                           <option value="WEEKLY">Weekly</option>
                                                           <option value="MONTHLY">Monthly</option>
                                                           <option value="LIFETIME">Lifetime</option>
                                                       </select>
                                                   </div>
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Level</label>
                                                       <select 
                                                           value={reward.subLevel} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               // @ts-ignore
                                                               updated[idx].subLevel = e.target.value;
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-xs"
                                                       >
                                                           <option value="BASIC">Basic</option>
                                                           <option value="ULTRA">Ultra</option>
                                                       </select>
                                                   </div>
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Duration (Hrs)</label>
                                                       <input 
                                                           type="number" 
                                                           value={reward.durationHours || 4} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               updated[idx].durationHours = Number(e.target.value);
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-sm"
                                                       />
                                                   </div>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               ))}
                               
                               <button 
                                   onClick={() => {
                                       const newReward = {
                                           id: `rew-def-${Date.now()}`,
                                           seconds: 60,
                                           type: 'COINS',
                                           amount: 1,
                                           label: '1 Min Reward',
                                           enabled: true
                                       };
                                       setLocalSettings({
                                           ...localSettings, 
                                           // @ts-ignore
                                           engagementRewards: [...(localSettings.engagementRewards || []), newReward]
                                       });
                                   }}
                                   className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:text-slate-600 transition"
                               >
                                   + Add New Reward Milestone
                               </button>
                           </div>
                       </div>
                  )}
                  {activeTab === 'CONFIG_CHAT' && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><MessageSquare size={18} /> Chat Room Manager</h4>
                           <p className="text-xs text-slate-500 mb-4">Create up to 10 chat rooms for students. Toggle visibility.</p>
                           
                           <div className="space-y-3 mb-6">
                               {(!localSettings.chatRooms || localSettings.chatRooms.length === 0) && (
                                   <p className="text-sm text-slate-400 text-center py-4">No rooms created.</p>
                               )}
                               
                               {localSettings.chatRooms?.map((room, idx) => (
                                   <div key={room.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                       <div>
                                           <p className="font-bold text-slate-800 text-sm">{room.name}</p>
                                           <p className="text-xs text-slate-500">{room.description}</p>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                                               <input 
                                                  type="checkbox" 
                                                  checked={room.enabled} 
                                                  onChange={(e) => {
                                                      const updated = [...(localSettings.chatRooms || [])];
                                                      updated[idx].enabled = e.target.checked;
                                                      setLocalSettings({...localSettings, chatRooms: updated});
                                                  }}
                                                  className="w-4 h-4 accent-blue-600"
                                               /> {room.enabled ? 'ACTIVE' : 'OFF'}
                                           </label>
                                           <button onClick={() => {
                                               const updated = localSettings.chatRooms!.filter((_, i) => i !== idx);
                                               setLocalSettings({...localSettings, chatRooms: updated});
                                           }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                       </div>
                                   </div>
                               ))}
                           </div>

                           {(!localSettings.chatRooms || localSettings.chatRooms.length < 10) && (
                               <div className="bg-white p-3 rounded-xl border border-slate-200">
                                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Add New Room</p>
                                   <div className="flex gap-2 mb-2">
                                       <input 
                                           type="text" 
                                           placeholder="Room Name (e.g. Doubts)" 
                                           value={newRoomName} 
                                           onChange={e => setNewRoomName(e.target.value)} 
                                           className="flex-1 p-2 border rounded-lg text-sm"
                                       />
                                       <select className="p-2 border rounded-lg text-xs bg-slate-50">
                                           <option value="PUBLIC">Public</option>
                                       </select>
                                   </div>
                                   <input 
                                       type="text" 
                                       placeholder="Description (Optional)" 
                                       value={newRoomDesc} 
                                       onChange={e => setNewRoomDesc(e.target.value)} 
                                       className="w-full p-2 border rounded-lg text-sm mb-2"
                                   />
                                   <button 
                                       onClick={() => {
                                           if(!newRoomName) return;
                                           const newRoom = {
                                               id: `room-${Date.now()}`,
                                               name: newRoomName,
                                               description: newRoomDesc,
                                               type: 'PUBLIC',
                                               enabled: true
                                           };
                                           setLocalSettings({...localSettings, chatRooms: [...(localSettings.chatRooms || []), newRoom]});
                                           setNewRoomName(''); setNewRoomDesc('');
                                       }}
                                       className="w-full py-2 bg-teal-600 text-white font-bold rounded-lg text-xs hover:bg-teal-700"
                                   >
                                       + Create Room
                                   </button>
                               </div>
                           )}
                      </div>
                  )}
                  {activeTab === 'CONFIG_FEATURES' && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><ListChecks size={18} /> Configure App Features</h4>
                           <p className="text-xs text-slate-500 mb-4">Toggle features ON/OFF to control what students see in the Marquee Slider.</p>
                           
                           <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                               {(localSettings.appFeatures || DEFAULT_APP_FEATURES).map((feat, idx) => (
                                   <div key={feat.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                                       <div className="flex items-center gap-3">
                                           <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</span>
                                           {/* Allow editing title too? Maybe later. For now just toggle. */}
                                           <input 
                                              type="text" 
                                              value={feat.title} 
                                              onChange={(e) => {
                                                  const updated = [...(localSettings.appFeatures || DEFAULT_APP_FEATURES)];
                                                  updated[idx].title = e.target.value;
                                                  setLocalSettings({...localSettings, appFeatures: updated});
                                              }}
                                              className="font-medium text-sm text-slate-800 border-none bg-transparent focus:bg-slate-50 focus:outline-none p-1 rounded"
                                           />
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <label className="text-[10px] font-bold uppercase text-slate-400">{feat.enabled ? 'ON' : 'OFF'}</label>
                                           <input 
                                              type="checkbox" 
                                              checked={feat.enabled} 
                                              onChange={(e) => {
                                                  const updated = [...(localSettings.appFeatures || DEFAULT_APP_FEATURES)];
                                                  updated[idx].enabled = e.target.checked;
                                                  setLocalSettings({...localSettings, appFeatures: updated});
                                              }}
                                              className="w-5 h-5 accent-blue-600"
                                           />
                                       </div>
                                   </div>
                               ))}
                           </div>
                           
                           <button 
                              onClick={() => {
                                  // Reset to Default
                                  if(confirm("Reset all feature names and visibility to default?")) {
                                      setLocalSettings({...localSettings, appFeatures: DEFAULT_APP_FEATURES});
                                  }
                              }}
                              className="mt-4 text-xs font-bold text-red-500 hover:text-red-700 underline"
                           >
                              Reset to Defaults
                           </button>
                      </div>
                  )}

                  {/* INFO POPUPS CONFIG */}
                  {activeTab === 'CONFIG_INFO' && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><HelpCircle size={18} /> Content Info Popups</h4>
                          <p className="text-xs text-slate-500 mb-4">Edit the details shown when students click the (?) icon next to Notes/Videos.</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                              {[
                                  { key: 'freeNotes', label: 'Free Notes Info', color: 'green' },
                                  { key: 'premiumNotes', label: 'Premium Notes Info', color: 'amber' },
                                  { key: 'freeVideo', label: 'Video Lecture Info', color: 'blue' },
                                  { key: 'premiumVideo', label: 'Premium Video Info', color: 'purple' },
                              ].map((item) => {
                                  const config = localSettings.contentInfo?.[item.key as keyof ContentInfoConfig] || DEFAULT_CONTENT_INFO_CONFIG[item.key as keyof ContentInfoConfig];
                                  
                                  const updateInfo = (field: keyof ContentInfoItem, val: any) => {
                                      const newConfig = { ...config, [field]: val };
                                      setLocalSettings({
                                          ...localSettings,
                                          contentInfo: {
                                              ...(localSettings.contentInfo || DEFAULT_CONTENT_INFO_CONFIG),
                                              [item.key]: newConfig
                                          }
                                      });
                                  };

                                  return (
                                      <div key={item.key} className={`bg-white p-4 rounded-xl border-l-4 shadow-sm space-y-3 border-${item.color}-500`}>
                                          <div className="flex justify-between items-center border-b pb-2">
                                              <span className={`font-bold text-${item.color}-700`}>{item.label}</span>
                                              <label className="flex items-center gap-2 text-xs font-bold">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={config.enabled} 
                                                      onChange={e => updateInfo('enabled', e.target.checked)}
                                                      className={`accent-${item.color}-600`}
                                                  /> Enable
                                              </label>
                                          </div>
                                          
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Title</label>
                                              <input 
                                                  type="text" 
                                                  value={config.title} 
                                                  onChange={e => updateInfo('title', e.target.value)} 
                                                  className="w-full p-2 border rounded-lg text-sm font-bold"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Details (Multi-line)</label>
                                              <textarea 
                                                  value={config.details} 
                                                  onChange={e => updateInfo('details', e.target.value)} 
                                                  className="w-full p-2 border rounded-lg text-sm h-20"
                                              />
                                          </div>
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Best For (Multi-line)</label>
                                              <textarea 
                                                  value={config.bestFor} 
                                                  onChange={e => updateInfo('bestFor', e.target.value)} 
                                                  className="w-full p-2 border rounded-lg text-sm h-20 bg-slate-50"
                                              />
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}


        {activeTab === 'CONFIG_POPUP' && (
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles size={18} /> Feature Popup Config</h4>
                            <button
                              onClick={() => {
                                const defaultPopup = {
                                  enabled: true,
                                  intervalMinutes: 60,
                                  freeFeatures: [
                                    "📝 Basic Subject Notes",
                                    "❓ Chapter-wise Practice MCQs",
                                    "📈 Daily Study Streak Tracker",
                                    "🎮 2 Daily Spin Wheel Games",
                                    "📱 Mobile Access Anywhere",
                                    "🏆 Global Leaderboard View",
                                    "📅 Academic Calendar Support",
                                    "💬 Public Chatroom Access",
                                    "🔔 Basic Class Notifications",
                                    "🎁 Daily 3-Coin Login Bonus"
                                  ],
                                  premiumFeatures: [
                                    "💎 Deep Concept Long Videos",
                                    "🎞️ Animated Educational Content",
                                    "📚 Detailed Multi-Part Notes",
                                    "🖼️ Diagrams & Visual Figures",
                                    "🎰 Unlimited Spin (100+ daily)",
                                    "❓ Full Chapter MCQs Access",
                                    "🏆 Weekly Pro Mock Tests & Prizes",
                                    "🏅 VIP Badge & Custom Profile",
                                    "🎁 500+ Monthly Bonus Credits",
                                    "📞 Direct Teacher Support Access",
                                    "🔄 Offline Video Downloads"
                                  ],
                                  showToPremiumUsers: true,
                                  showNearExpiryHours: 24
                                };
                                setLocalSettings({ ...localSettings, featurePopup: defaultPopup });
                                alert("Default 20 features loaded! Click 'Save Popup Configuration' to apply.");
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-100"
                            >
                              <Sparkles size={16} />
                              Auto-Fill 20 Features
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Free Tier Audit */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                              <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Star size={18} /> Free Features Status
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>📝 Basic Notes</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>❓ Practice MCQs</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>🎮 Spin Wheel</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>🏆 Leaderboard</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>💬 Public Chat</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-amber-50 text-amber-700 rounded-lg"><span>📈 Streak Tracker</span> <span className="font-bold">⏳ Partial</span></div>
                                <div className="flex justify-between p-2 bg-amber-50 text-amber-700 rounded-lg"><span>🎁 Daily Bonus</span> <span className="font-bold">⏳ Partial</span></div>
                              </div>
                            </div>

                            {/* Premium Tier Audit */}
                            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                              <h5 className="font-bold text-blue-700 mb-3 flex items-center gap-2">
                                <Crown size={18} /> Ultra Features Status
                              </h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>💎 Deep Concept Videos</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>🎞️ Animated Content</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>📚 Detailed Notes</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>🖼️ Diagrams/Figures</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>🎰 Unlimited Spin</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>❓ Full MCQs</span> <span className="font-bold">✅ Ready</span></div>
                                <div className="flex justify-between p-2 bg-green-50 text-green-700 rounded-lg"><span>💎 Exclusive Notes</span> <span className="font-bold">✅ Ready</span></div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                              <div>
                                  <h4 className="font-bold text-blue-900">Enable Popup</h4>
                                  <p className="text-xs text-blue-700">Show feature comparison to free and near-expiry users.</p>
                              </div>
                              <button 
                                  onClick={() => setLocalSettings({
                                      ...localSettings, 
                                      featurePopup: { ...(localSettings.featurePopup || { enabled: false, intervalMinutes: 60, freeFeatures: [], premiumFeatures: [], showToPremiumUsers: false, showNearExpiryHours: 24 }), enabled: !localSettings.featurePopup?.enabled }
                                  })}
                                  className={`w-14 h-8 rounded-full transition-colors relative ${localSettings.featurePopup?.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                              >
                                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${localSettings.featurePopup?.enabled ? 'right-1' : 'left-1'}`} />
                              </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Interval (Minutes)</label>
                                  <input 
                                      type="number" 
                                      value={localSettings.featurePopup?.intervalMinutes || 60} 
                                      onChange={e => setLocalSettings({
                                          ...localSettings, 
                                          featurePopup: { ...(localSettings.featurePopup || { enabled: true, intervalMinutes: 60, freeFeatures: [], premiumFeatures: [], showToPremiumUsers: false, showNearExpiryHours: 24 }), intervalMinutes: Number(e.target.value) }
                                      })}
                                      className="w-full p-3 border rounded-xl font-bold"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Expiry Warning (Hours)</label>
                                  <input 
                                      type="number" 
                                      value={localSettings.featurePopup?.showNearExpiryHours || 24} 
                                      onChange={e => setLocalSettings({
                                          ...localSettings, 
                                          featurePopup: { ...(localSettings.featurePopup || { enabled: true, intervalMinutes: 60, freeFeatures: [], premiumFeatures: [], showToPremiumUsers: false, showNearExpiryHours: 24 }), showNearExpiryHours: Number(e.target.value) }
                                      })}
                                      className="w-full p-3 border rounded-xl font-bold"
                                  />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-3">
                                  <h4 className="font-bold text-slate-700 flex items-center gap-2"><Star size={16} /> Free Features</h4>
                                  <textarea 
                                      className="w-full h-32 p-3 border rounded-xl text-sm"
                                      placeholder="One feature per line..."
                                      value={localSettings.featurePopup?.freeFeatures?.join('\n') || ''}
                                      onChange={e => setLocalSettings({
                                          ...localSettings, 
                                          featurePopup: { ...(localSettings.featurePopup || { enabled: true, intervalMinutes: 60, freeFeatures: [], premiumFeatures: [], showToPremiumUsers: false, showNearExpiryHours: 24 }), freeFeatures: e.target.value.split('\n').filter(x => x.trim()) }
                                      })}
                                  />
                              </div>
                              <div className="space-y-3">
                                  <h4 className="font-bold text-blue-700 flex items-center gap-2"><Crown size={16} /> Premium Features</h4>
                                  <textarea 
                                      className="w-full h-32 p-3 border rounded-xl text-sm border-blue-200 bg-blue-50/30"
                                      placeholder="One feature per line..."
                                      value={localSettings.featurePopup?.premiumFeatures?.join('\n') || ''}
                                      onChange={e => setLocalSettings({
                                          ...localSettings, 
                                          featurePopup: { ...(localSettings.featurePopup || { enabled: true, intervalMinutes: 60, freeFeatures: [], premiumFeatures: [], showToPremiumUsers: false, showNearExpiryHours: 24 }), premiumFeatures: e.target.value.split('\n').filter(x => x.trim()) }
                                      })}
                                  />
                              </div>
                          </div>
                      </div>
                  )}
              </div>
              <div className="mt-8 flex gap-2 border-t pt-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200">← Back to Dashboard</button>
                  <button onClick={handleSaveSettings} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"><Save size={16} /> Save Settings</button>
              </div>
          </div>
      )}

      {activeTab === 'CHALLENGE_CREATOR_20' && (
          <ChallengeCreator20 onBack={() => setActiveTab('DASHBOARD')} language={localSettings.aiModel?.includes('Hindi') ? 'Hindi' : 'English'} />
      )}

      {activeTab === 'CONFIG_CHALLENGE' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right space-y-6">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Challenge Config (Legacy 1.0) & Theme</h3>
              </div>

              {/* CHALLENGE CONFIG */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-3xl border border-red-100 space-y-4">
                  <h4 className="font-bold text-red-900 flex items-center gap-2 text-lg"><Trophy size={20} /> Daily MCQ Challenge</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Reward Condition</label>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number" 
                                  value={localSettings.dailyChallengeConfig?.rewardPercentage || 90} 
                                  onChange={e => setLocalSettings({
                                      ...localSettings,
                                      dailyChallengeConfig: { ...(localSettings.dailyChallengeConfig || { mode: 'AUTO', rewardPercentage: 90, selectedChapterIds: [] }), rewardPercentage: Number(e.target.value) }
                                  })}
                                  className="w-20 p-2 border rounded-lg font-black text-xl text-center"
                              />
                              <span className="font-bold text-slate-600">% Score required</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Students scoring above this get 1 Month Free Subscription.</p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Question Source Mode</label>
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => setLocalSettings({
                                      ...localSettings,
                                      dailyChallengeConfig: { ...(localSettings.dailyChallengeConfig || { mode: 'AUTO', rewardPercentage: 90, selectedChapterIds: [] }), mode: 'AUTO' }
                                  })}
                                  className={`flex-1 py-2 rounded-lg font-bold text-xs ${localSettings.dailyChallengeConfig?.mode === 'AUTO' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
                              >
                                  🤖 Auto Mix (All)
                              </button>
                              <button 
                                  onClick={() => setLocalSettings({
                                      ...localSettings,
                                      dailyChallengeConfig: { ...(localSettings.dailyChallengeConfig || { mode: 'AUTO', rewardPercentage: 90, selectedChapterIds: [] }), mode: 'MANUAL' }
                                  })}
                                  className={`flex-1 py-2 rounded-lg font-bold text-xs ${localSettings.dailyChallengeConfig?.mode === 'MANUAL' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
                              >
                                  ✍️ Manual Select
                              </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">
                              {localSettings.dailyChallengeConfig?.mode === 'AUTO' 
                                  ? "Questions will be randomly mixed from ALL available chapters for the student's class."
                                  : "Only questions from specific chapters selected below will be used."}
                          </p>
                      </div>
                  </div>

                  {localSettings.dailyChallengeConfig?.mode === 'MANUAL' && (
                      <div className="bg-white p-4 rounded-xl border border-red-100">
                          <h5 className="font-bold text-slate-700 text-sm mb-3">Select Source Chapters (Manual Mode)</h5>
                          <SubjectSelector />
                          
                          {selSubject && selChapters.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                  {selChapters.map(ch => {
                                      const isSelected = (localSettings.dailyChallengeConfig?.selectedChapterIds || []).includes(ch.id);
                                      return (
                                          <button 
                                              key={ch.id}
                                              onClick={() => {
                                                  const current = localSettings.dailyChallengeConfig?.selectedChapterIds || [];
                                                  const updated = isSelected 
                                                      ? current.filter(id => id !== ch.id)
                                                      : [...current, ch.id];
                                                  
                                                  setLocalSettings({
                                                      ...localSettings,
                                                      dailyChallengeConfig: { ...(localSettings.dailyChallengeConfig || { mode: 'MANUAL', rewardPercentage: 90 }), selectedChapterIds: updated }
                                                  });
                                              }}
                                              className={`text-left p-2 rounded-lg text-xs font-bold border ${isSelected ? 'bg-red-50 border-red-300 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                          >
                                              {isSelected ? '✅' : '⬜'} {ch.title}
                                          </button>
                                      );
                                  })}
                              </div>
                          ) : (
                              <p className="text-xs text-slate-400">Select Board, Class & Subject to view chapters.</p>
                          )}
                          
                          <div className="mt-2 pt-2 border-t text-xs text-slate-500 font-medium">
                              Selected: {localSettings.dailyChallengeConfig?.selectedChapterIds?.length || 0} chapters
                          </div>
                      </div>
                  )}
              </div>

              {/* THEME CONFIG */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-2 text-lg"><Palette size={20} /> App Theme Settings</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Default Theme (Free Users)</label>
                          <div className="grid grid-cols-2 gap-2">
                              {['BASIC', 'ULTRA', 'DARK', 'LIGHT'].map(theme => (
                                  <button 
                                      key={theme}
                                      onClick={() => setLocalSettings({
                                          ...localSettings,
                                          themeConfig: { ...(localSettings.themeConfig || { freeTheme: 'BASIC', enableTop3Gold: true }), freeTheme: theme as any }
                                      })}
                                      className={`py-2 rounded-lg font-bold text-xs ${localSettings.themeConfig?.freeTheme === theme ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600'}`}
                                  >
                                      {theme}
                                  </button>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Set the default look for non-premium students.</p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between">
                          <div>
                              <p className="font-bold text-slate-800 text-sm">Top 3 Gold Theme</p>
                              <p className="text-[10px] text-slate-500">Auto-upgrade leaderboard toppers to Gold Theme.</p>
                          </div>
                          <input 
                              type="checkbox" 
                              checked={localSettings.themeConfig?.enableTop3Gold !== false} 
                              onChange={e => setLocalSettings({
                                  ...localSettings,
                                  themeConfig: { ...(localSettings.themeConfig || { freeTheme: 'BASIC', enableTop3Gold: true }), enableTop3Gold: e.target.checked }
                              })}
                              className="w-6 h-6 accent-indigo-600" 
                          />
                      </div>
                  </div>
              </div>

              <button onClick={handleSaveSettings} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                  <Save size={20} /> Save Configuration
              </button>
          </div>
      )}

      {/* --- AI STUDIO TAB --- */}
      {activeTab === 'AI_STUDIO' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-violet-800">AI Studio</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* LEFT: SETTINGS */}
                  <div className="space-y-6">
                      <div className="bg-violet-50 p-6 rounded-2xl border border-violet-100">
                          <h4 className="font-bold text-violet-900 mb-4 flex items-center gap-2"><Key size={20} /> API Configuration</h4>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-violet-700 uppercase mb-1 block">API Keys (Multiple Boxes)</label>
                                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-white border border-violet-200 rounded-xl">
                                      {(localSettings.apiKeys || []).map((key, i) => (
                                          <div key={i} className="flex gap-2">
                                              <input 
                                                  type="text" 
                                                  value={key}
                                                  onChange={(e) => {
                                                      const newKeys = [...(localSettings.apiKeys || [])];
                                                      newKeys[i] = e.target.value;
                                                      setLocalSettings({...localSettings, apiKeys: newKeys});
                                                  }}
                                                  className="flex-1 p-2 border border-violet-100 rounded-lg text-xs font-mono"
                                                  placeholder={`API Key ${i+1}`}
                                              />
                                              <button 
                                                  onClick={() => {
                                                      const newKeys = (localSettings.apiKeys || []).filter((_, idx) => idx !== i);
                                                      setLocalSettings({...localSettings, apiKeys: newKeys});
                                                  }}
                                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                          </div>
                                      ))}
                                      <button 
                                          onClick={() => setLocalSettings({...localSettings, apiKeys: [...(localSettings.apiKeys || []), '']})}
                                          className="w-full py-2 border-2 border-dashed border-violet-200 rounded-lg text-violet-400 text-xs font-bold hover:border-violet-300 hover:text-violet-500 flex items-center justify-center gap-2"
                                      >
                                          <Plus size={14} /> Add Another API Key
                                      </button>
                                  </div>
                                  <p className="text-[10px] text-violet-600 mt-1">System will rotate keys automatically if one quota is exhausted.</p>
                              </div>

                              <div>
                                  <label className="text-xs font-bold text-violet-700 uppercase mb-1 block">AI Model</label>
                                  <select 
                                      value={localSettings.aiModel || 'gemini-2.5-flash'} 
                                      onChange={e => setLocalSettings({...localSettings, aiModel: e.target.value})} 
                                      className="w-full p-3 border border-violet-200 rounded-xl bg-white"
                                  >
                                      <option value="gemini-2.5-flash">Gemini 1.5 Flash (Fast & Cheap)</option>
                                      <option value="gemini-pro">Gemini Pro (Better Quality)</option>
                                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Best Context)</option>
                                  </select>
                              </div>
                          </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PenTool size={20} /> Prompt Engineering</h4>
                          <p className="text-xs text-slate-500 mb-4">Use placeholders: <code>{`{board}, {class}, {subject}, {chapter}, {language}`}</code></p>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Normal Notes Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptNotes || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptNotes: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs"
                                      placeholder="Default: Write detailed study notes for {board} Class {class}..."
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Premium Notes Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptNotesPremium || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptNotesPremium: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs bg-amber-50 border-amber-200"
                                      placeholder="Default: Write Premium notes with deep insights for..."
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">MCQ Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptMCQ || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptMCQ: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs bg-blue-50 border-blue-200"
                                      placeholder="Default: Create {count} MCQs for {subject}..."
                                  />
                              </div>

                              <div className="h-px bg-slate-200 my-4"></div>
                              <h5 className="font-bold text-slate-800 mb-2">Competition Mode Prompts</h5>

                              <div>
                                  <label className="text-xs font-bold text-purple-600 uppercase mb-1 block">Comp. Notes Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptNotesCompetition || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptNotesCompetition: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs border-purple-200 bg-purple-50"
                                      placeholder="Prompt for Competition Mode Notes..."
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-purple-600 uppercase mb-1 block">Comp. Premium Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptNotesPremiumCompetition || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptNotesPremiumCompetition: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs border-purple-200 bg-purple-50"
                                      placeholder="Prompt for Competition Mode Premium Notes..."
                                  />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-purple-600 uppercase mb-1 block">Comp. MCQ Prompt</label>
                                  <textarea 
                                      value={localSettings.aiPromptMCQCompetition || ''} 
                                      onChange={e => setLocalSettings({...localSettings, aiPromptMCQCompetition: e.target.value})} 
                                      className="w-full p-3 border rounded-xl h-24 text-xs border-purple-200 bg-purple-50"
                                      placeholder="Prompt for Competition Mode MCQs..."
                                  />
                              </div>
                          </div>
                          
                          <button onClick={handleSaveSettings} className="mt-4 w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900">Save Prompts</button>
                      </div>
                  </div>

                  {/* RIGHT: GENERATOR */}
                  <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 h-full">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Sparkles size={20} /> Content Generator</h4>
                          
                          {/* 1. Context Selectors */}
                          <SubjectSelector />

                          {/* 2. Chapter & Type */}
                          {selSubject && (
                              <div className="space-y-4 animate-in fade-in">
                                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Target Chapter</p>
                                      <select 
                                          value={editingChapterId || ''} 
                                          onChange={e => {
                                              setEditingChapterId(e.target.value);
                                              // Clear preview on chapter change
                                              setAiPreview(null); 
                                          }} 
                                          className="w-full p-2 border rounded-lg text-sm font-bold text-slate-800"
                                      >
                                          <option value="">-- Select Chapter --</option>
                                          {selChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                      </select>
                                  </div>

                                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Generation Type</p>
                                      <div className="grid grid-cols-3 gap-2">
                                          {[
                                              {id: 'NOTES_SIMPLE', label: 'Notes'}, 
                                              {id: 'NOTES_PREMIUM', label: 'Premium'}, 
                                              {id: 'MCQ_SIMPLE', label: 'MCQs'}
                                          ].map(t => (
                                              <button 
                                                  key={t.id}
                                                  onClick={() => setAiGenType(t.id as ContentType)}
                                                  className={`py-2 rounded-lg text-xs font-bold transition-all ${aiGenType === t.id ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                              >
                                                  {t.label}
                                              </button>
                                          ))}
                                      </div>
                                  </div>

                                  {/* 3. Syllabus Mode (Conditional) */}
                                  {['6','7','8','9','10','11','12'].includes(selClass) && (
                                      <div className="bg-white p-4 rounded-xl border border-slate-200">
                                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Syllabus Mode</p>
                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => setSyllabusMode('SCHOOL')}
                                                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${syllabusMode === 'SCHOOL' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
                                              >
                                                  🏫 School
                                              </button>
                                              <button 
                                                  onClick={() => setSyllabusMode('COMPETITION')}
                                                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${syllabusMode === 'COMPETITION' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}
                                              >
                                                  🏆 Competition
                                              </button>
                                          </div>
                                      </div>
                                  )}

                                  {/* 4. Action */}
                                  <button 
                                      onClick={async () => {
                                          if(!editingChapterId) { alert("Select a chapter!"); return; }
                                          const ch = selChapters.find(c => c.id === editingChapterId);
                                          if(!ch) return;

                                          setIsAiGenerating(true);
                                          try {
                                              // Determine Language based on Board
                                              const genLanguage = selBoard === 'BSEB' ? 'Hindi' : 'English';
                                              
                                              const content = await fetchLessonContent(
                                                  selBoard, selClass, selStream, selSubject, ch, genLanguage, aiGenType, 0, true, 15, "", true, syllabusMode
                                              );
                                              setAiPreview(content);
                                          } catch(e) {
                                              alert("Generation Failed: " + e);
                                          } finally {
                                              setIsAiGenerating(false);
                                          }
                                      }}
                                      disabled={isAiGenerating}
                                      className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                      {isAiGenerating ? <RefreshCw className="animate-spin" /> : <Sparkles />} 
                                      {isAiGenerating ? "Generating..." : "Generate Content"}
                                  </button>

                                  {/* 4. Preview & Save */}
                                  {aiPreview && (
                                      <div className="bg-white p-4 rounded-xl border border-slate-200 animate-in slide-in-from-bottom-4">
                                          <div className="flex justify-between items-center mb-2">
                                              <h5 className="font-bold text-slate-700 text-xs uppercase">Preview</h5>
                                              <div className="flex gap-2">
                                                  <button 
                                                      onClick={() => {
                                                          const textToCopy = aiGenType.includes('MCQ') 
                                                              ? JSON.stringify(aiPreview.mcqData, null, 2) 
                                                              : aiPreview.content;
                                                          navigator.clipboard.writeText(textToCopy);
                                                          alert("Content Copied to Clipboard!");
                                                      }}
                                                      className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
                                                  >
                                                      <Copy size={12} /> Copy
                                                  </button>
                                                  <button 
                                                      onClick={() => {
                                                          if(!aiPreview || !editingChapterId) return;
                                                          // Save Logic similar to handleSaveChapter
                                                          // We need to merge with existing data
                                                          const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
                                                          const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject.name}_${editingChapterId}`;
                                                          const existing = localStorage.getItem(key);
                                                          const existingData = existing ? JSON.parse(existing) : {};
                                                          
                                                          let newData = { ...existingData };
                                                          
                                                          if (aiGenType === 'NOTES_SIMPLE') {
                                                              newData.freeNotesHtml = aiPreview.content; // Saving MD/Text as HTML for now (Client renders MD)
                                                          } else if (aiGenType === 'NOTES_PREMIUM') {
                                                              newData.premiumNotesHtml = aiPreview.content;
                                                          } else if (aiGenType === 'MCQ_SIMPLE') {
                                                              newData.manualMcqData = aiPreview.mcqData;
                                                          }

                                                          localStorage.setItem(key, JSON.stringify(newData));
                                                          if (isFirebaseConnected) saveChapterData(key, newData);
                                                          
                                                          alert("✅ Content Published Successfully! Students can now view it.");
                                                          setAiPreview(null);
                                                      }}
                                                      className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow hover:bg-green-700 flex items-center gap-1"
                                                  >
                                                      <Upload size={12} /> Publish Content
                                                  </button>
                                              </div>
                                          </div>
                                          <div className="max-h-60 overflow-y-auto p-2 bg-slate-50 rounded border border-slate-100 text-xs font-mono whitespace-pre-wrap select-text">
                                              {aiGenType.includes('MCQ') 
                                                  ? JSON.stringify(aiPreview.mcqData, null, 2) 
                                                  : aiPreview.content}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          )}
                          
                          {!selSubject && (
                              <div className="text-center py-10 text-slate-400 text-sm">
                                  Select a subject to begin.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- DEPLOYMENT TAB (New) --- */}
      {activeTab === 'DEPLOY' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Deployment & Blueprint</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* APP BLUEPRINT */}
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col justify-between">
                      <div>
                          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                              <Code2 size={24} />
                          </div>
                          <h4 className="text-xl font-black text-blue-900 mb-2">Download Live Update</h4>
                          <p className="text-sm text-blue-700 leading-relaxed mb-6">
                              This will generate a <strong>New ZIP</strong> containing your latest Admin Changes.
                              <br/><br/>
                              Upload this to Vercel, and students will receive the update automatically next time they open the app.
                          </p>
                      </div>
                  </div>

                  {/* DEPLOYMENT GUIDE */}
                  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 text-white flex flex-col justify-between">
                      <div>
                          <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center mb-4 border border-slate-700">
                              <Rocket size={24} />
                          </div>
                          <h4 className="text-xl font-black text-white mb-2">How to Update?</h4>
                          <ul className="text-sm text-slate-400 space-y-3 mb-6 list-decimal pl-4">
                              <li>Make changes in Admin Panel (Add Chapters/Notices).</li>
                              <li>Click <strong>Download Source</strong> on left.</li>
                              <li>Upload the new ZIP to GitHub/Vercel.</li>
                              <li>Done! All students get updated data instantly.</li>
                          </ul>
                      </div>
                      <div className="text-[10px] bg-slate-800 p-3 rounded-xl border border-slate-700 text-slate-400 text-center">
                          <span className="font-bold text-green-400">SYNC ACTIVE:</span> V3.1 Auto-Sync Enabled.
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 5. UTILITY TABS */}
      {activeTab === 'DEMAND' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">User Demands</h3></div>
              <div className="space-y-3">
                  {demands.length === 0 && <p className="text-slate-400">No demands yet.</p>}
                  {demands.map((d, i) => (
                      <div key={i} className="p-4 border rounded-xl bg-slate-50 flex justify-between items-start">
                          <div>
                              <p className="font-bold text-slate-800">{d.details}</p>
                              <p className="text-xs text-slate-400 mt-1">{new Date(d.timestamp).toLocaleString()}</p>
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">{d.id}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {activeTab === 'ACCESS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Login Requests</h3></div>
              <div className="space-y-3">
                  {recoveryRequests.filter(r => r.status === 'PENDING').length === 0 && <p className="text-slate-400">No pending requests.</p>}
                  {recoveryRequests.filter(r => r.status === 'PENDING').map((req) => (
                      <div key={req.id} className="p-4 border rounded-xl bg-slate-50 flex justify-between items-center">
                          <div><p className="font-bold text-slate-800">{req.name}</p><p className="text-xs text-slate-500 font-mono">{req.mobile} • {req.id}</p></div>
                          <button onClick={() => handleApproveRequest(req)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-green-700">Approve Access</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- SUB-ADMINS TAB --- */}
      {activeTab === 'SUB_ADMINS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Manage Sub-Admins</h3>
              </div>

              <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                  <h4 className="font-bold text-indigo-900 mb-2">Promote User to Sub-Admin</h4>
                  <div className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder="Enter User ID or Email" 
                          value={newSubAdminId} 
                          onChange={e => setNewSubAdminId(e.target.value)} 
                          className="flex-1 p-3 rounded-xl border border-indigo-200"
                      />
                      <button onClick={() => promoteToSubAdmin(newSubAdminId)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow hover:bg-indigo-700">
                          Promote
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                  <h4 className="font-bold text-slate-800">Active Sub-Admins</h4>
                  {users.filter(u => u.role === 'SUB_ADMIN').map(admin => (
                      <div key={admin.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                      {admin.name.charAt(0)}
                                  </div>
                                  <div>
                                      <p className="font-bold text-slate-800">{admin.name}</p>
                                      <p className="text-xs text-slate-500">{admin.email || admin.id}</p>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                  <button onClick={() => setViewingSubAdminReport(admin.id)} className="text-indigo-600 text-xs font-bold hover:underline mb-1">
                                      📊 View Sales Report
                                  </button>
                                  <button onClick={() => demoteSubAdmin(admin.id)} className="text-red-500 text-xs font-bold hover:underline">
                                      Remove Admin Rights
                                  </button>
                              </div>
                          </div>
                          
                          <div className="bg-slate-50 p-3 rounded-lg">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Permissions</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                  {ADMIN_PERMISSIONS.map(perm => {
                                      const hasPerm = (admin.permissions || []).includes(perm);
                                      return (
                                          <button 
                                              key={perm}
                                              onClick={() => toggleSubAdminPermission(admin.id, perm)}
                                              className={`px-2 py-1 rounded text-[10px] font-bold border text-left truncate transition-all ${
                                                  hasPerm 
                                                  ? 'bg-green-100 text-green-700 border-green-200' 
                                                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                              }`}
                                              title={perm}
                                          >
                                              {hasPerm ? '☑️' : '⬜'} {perm.replace(/_/g, ' ')}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      </div>
                  ))}
                  {users.filter(u => u.role === 'SUB_ADMIN').length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-8">No Sub-Admins assigned.</p>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'DATABASE' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Database Viewer</h3></div>
              <div className="bg-slate-900 rounded-xl p-4">
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                      {['nst_users', 'nst_system_settings', 'nst_activity_log', 'nst_iic_posts', 'nst_leaderboard'].map(k => (
                          <button key={k} onClick={() => setDbKey(k)} className={`px-3 py-1 rounded text-xs font-mono whitespace-nowrap ${dbKey === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{k}</button>
                      ))}
                  </div>
                  <textarea value={dbContent} onChange={e => setDbContent(e.target.value)} className="w-full h-96 bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-lg focus:outline-none border border-slate-800 resize-none" spellCheck={false} />
                  <button onClick={() => { localStorage.setItem(dbKey, dbContent); alert("Database Updated Forcefully!"); }} className="mt-4 bg-red-600 text-white px-6 py-3 rounded-lg font-bold w-full hover:bg-red-700">⚠️ SAVE CHANGES (DANGEROUS)</button>
              </div>
          </div>
      )}

      {/* --- GIFT CODES TAB --- */}
      {activeTab === 'CODES' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Gift Code Generator</h3>
              </div>
              
              <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 mb-8">
                  <div className="flex flex-wrap gap-4 items-end">
                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Code Type</label>
                          <select 
                              value={newCodeType} 
                              onChange={e => setNewCodeType(e.target.value as any)}
                              className="p-3 rounded-xl border border-pink-200 font-bold bg-white"
                          >
                              <option value="CREDITS">Credits (Coins)</option>
                              <option value="SUBSCRIPTION">Subscription</option>
                          </select>
                      </div>

                      {newCodeType === 'CREDITS' ? (
                          <div>
                              <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Amount</label>
                              <input type="number" value={newCodeAmount} onChange={e => setNewCodeAmount(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-32 font-bold" />
                          </div>
                      ) : (
                          <>
                              <div>
                                  <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Plan Duration</label>
                                  <select value={newCodeSubTier} onChange={e => setNewCodeSubTier(e.target.value)} className="p-3 rounded-xl border border-pink-200 bg-white font-bold">
                                      <option value="WEEKLY">Weekly (7 Days)</option>
                                      <option value="MONTHLY">Monthly (30 Days)</option>
                                      <option value="3_MONTHLY">Quarterly (3 Months)</option>
                                      <option value="YEARLY">Yearly (1 Year)</option>
                                      <option value="LIFETIME">Lifetime</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Level</label>
                                  <select value={newCodeSubLevel} onChange={e => setNewCodeSubLevel(e.target.value)} className="p-3 rounded-xl border border-pink-200 bg-white font-bold">
                                      <option value="BASIC">Basic</option>
                                      <option value="ULTRA">Ultra</option>
                                  </select>
                              </div>
                          </>
                      )}

                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Quantity</label>
                          <input type="number" value={newCodeCount} onChange={e => setNewCodeCount(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-24 font-bold" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Max Uses</label>
                          <input type="number" value={newCodeMaxUses} onChange={e => setNewCodeMaxUses(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-24 font-bold" min="1" />
                      </div>
                      <button onClick={generateCodes} className="bg-pink-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-pink-700 flex items-center gap-2">
                          <Gift size={20} /> Generate
                      </button>
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr className="border-b"><th className="p-3">Code</th><th className="p-3">Reward</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
                      <tbody>
                          {giftCodes.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No codes generated yet.</td></tr>}
                          {giftCodes.map(code => (
                              <tr key={code.id} className="border-b last:border-0 hover:bg-slate-50">
                                  <td className="p-3 font-mono font-bold text-slate-700 flex items-center gap-2">
                                      {code.code}
                                      <button onClick={() => { navigator.clipboard.writeText(code.code); alert("Code Copied!"); }} className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600 transition-colors" title="Copy Code">
                                          <Copy size={14} />
                                      </button>
                                  </td>
                                  <td className="p-3 font-bold text-pink-600">
                                      {code.type === 'SUBSCRIPTION' 
                                          ? `${code.subTier} ${code.subLevel}` 
                                          : `${code.amount} CR`}
                                  </td>
                                  <td className="p-3">
                                      {code.isRedeemed ? (
                                          <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">Fully Redeemed</span>
                                      ) : (
                                          <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold">
                                              Active ({code.usedCount || 0}/{code.maxUses || 1})
                                          </span>
                                      )}
                                  </td>
                                  <td className="p-3 text-right"><button onClick={() => deleteCode(code.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ... (Rest of AdminDashboard remains unchanged) ... */}
      
      {/* ... (Previous code continues for SUBJECTS_MGR, USERS, RECYCLE etc...) */}
      {activeTab === 'SUBJECTS_MGR' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Custom Subject Manager</h3>
              </div>

              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-8">
                  <div className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-emerald-700 uppercase block mb-1">Subject Name</label>
                          <input type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="e.g. Physical Education" className="p-3 rounded-xl border border-emerald-200 w-full" />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-emerald-700 uppercase block mb-1">Icon Style</label>
                          <select value={newSubIcon} onChange={e => setNewSubIcon(e.target.value)} className="p-3 rounded-xl border border-emerald-200 w-full bg-white">
                              <option value="book">Book</option>
                              <option value="science">Flask</option>
                              <option value="math">Calculator</option>
                              <option value="globe">Globe</option>
                              <option value="computer">Computer</option>
                              <option value="active">Activity</option>
                          </select>
                      </div>
                      <button onClick={addSubject} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700">
                          Add Subject
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.values({...DEFAULT_SUBJECTS, ...customSubjects}).map((sub: any) => (
                      <div key={sub.id} className="p-4 border rounded-xl flex items-center gap-3 bg-white">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sub.color}`}>
                              <Book size={20} />
                          </div>
                          <div>
                              <p className="font-bold text-sm">{sub.name}</p>
                              <p className="text-[10px] text-slate-400 uppercase">{sub.id}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- SUBSCRIPTION PLANS EDITOR --- */}
      {activeTab === 'SUBSCRIPTION_PLANS_EDITOR' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Edit Subscription Plans</h3>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {localSettings.subscriptionPlans?.map((plan, idx) => (
                      <div key={plan.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="flex justify-between mb-2">
                              <h4 className="font-bold text-slate-800">{plan.name} Plan</h4>
                              <button onClick={() => {
                                  const updated = localSettings.subscriptionPlans!.filter((_, i) => i !== idx);
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Duration</label>
                                  <input type="text" value={plan.duration} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].duration = e.target.value;
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm bg-white" placeholder="e.g. 7 Days" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Popular Tag</label>
                                  <select value={plan.popular ? 'yes' : 'no'} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].popular = e.target.value === 'yes';
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm bg-white">
                                      <option value="no">No</option>
                                      <option value="yes">Yes</option>
                                  </select>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-xl border border-slate-100 mb-3">
                              <div>
                                  <p className="text-[10px] font-bold text-blue-600 mb-1 uppercase">Basic (MCQ+Notes)</p>
                                  <label className="text-[9px] text-slate-400 block">Sale Price</label>
                                  <input type="number" value={plan.basicPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].basicPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded mb-1 text-sm font-bold" />
                                  
                                  <label className="text-[9px] text-slate-400 block">Real Price</label>
                                  <input type="number" value={plan.basicOriginalPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].basicOriginalPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded text-xs text-slate-500" />
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-purple-600 mb-1 uppercase">Ultra (PDF+Video)</p>
                                  <label className="text-[9px] text-slate-400 block">Sale Price</label>
                                  <input type="number" value={plan.ultraPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].ultraPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded mb-1 text-sm font-bold" />
                                  
                                  <label className="text-[9px] text-slate-400 block">Real Price</label>
                                  <input type="number" value={plan.ultraOriginalPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].ultraOriginalPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded text-xs text-slate-500" />
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500">Features (comma separated)</label>
                              <input type="text" value={plan.features?.join(', ')} onChange={e => {
                                  const updated = [...localSettings.subscriptionPlans!];
                                  updated[idx].features = e.target.value.split(',').map(f => f.trim());
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="w-full p-2 border rounded-lg text-sm" />
                          </div>
                          <div className="flex gap-2 mt-3">
                              <label className="flex items-center gap-2"><input type="checkbox" checked={plan.popular} onChange={e => {
                                  const updated = [...localSettings.subscriptionPlans!];
                                  updated[idx].popular = e.target.checked;
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} /> <span className="text-xs font-bold">Mark as Popular</span></label>
                              <button onClick={() => {
                                  const updated = localSettings.subscriptionPlans!.filter((_, i) => i !== idx);
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="ml-auto text-red-500 hover:text-red-700 font-bold"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
              </div>
              
                  <div className="mt-6 pt-4 border-t space-y-2">
                      <button 
                          onClick={() => {
                              const newPlan: SubscriptionPlan = {
                                  id: `plan-${Date.now()}`,
                                  name: 'New Plan',
                                  duration: '30 days',
                                  basicPrice: 99,
                                  basicOriginalPrice: 199,
                                  ultraPrice: 199,
                                  ultraOriginalPrice: 399,
                                  features: ['New Feature'],
                                  popular: false
                              };
                              const updated = [...(localSettings.subscriptionPlans || []), newPlan];
                              setLocalSettings({...localSettings, subscriptionPlans: updated});
                          }}
                          className="w-full py-3 bg-blue-50 text-blue-600 border border-blue-200 border-dashed rounded-lg font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2"
                      >
                          <Plus size={16} /> Add New Plan
                      </button>
                      <div className="flex gap-2">
                          <button onClick={() => setActiveTab('DASHBOARD')} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg">← Back</button>
                          <button onClick={handleSaveSettings} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">💾 Save Plans</button>
                      </div>
              </div>
          </div>
      )}

      {/* --- SUBSCRIPTION MANAGER TAB (NEW) --- */}
      {activeTab === 'SUBSCRIPTION_MANAGER' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Subscription Manager</h3>
                  <div className="ml-auto flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          👑 {users.filter(u => u.subscriptionTier && u.subscriptionTier !== 'FREE').length} Premium Users
                      </span>
                  </div>
              </div>

              <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="Search by Name, Email or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div className="grid gap-4">
                  {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                      <div key={u.id} className={`p-4 rounded-xl border-2 ${u.subscriptionTier === 'LIFETIME' ? 'border-yellow-300 bg-yellow-50' : u.subscriptionTier === 'YEARLY' ? 'border-purple-300 bg-purple-50' : u.subscriptionTier === 'MONTHLY' ? 'border-blue-300 bg-blue-50' : u.subscriptionTier === 'WEEKLY' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-start justify-between mb-3">
                              <div>
                                  <p className="font-bold text-slate-800">{u.name}</p>
                                  <p className="text-xs text-slate-500">{u.email} • ID: {u.id}</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  u.subscriptionTier === 'LIFETIME' ? 'bg-yellow-200 text-yellow-800' :
                                  u.subscriptionTier === 'YEARLY' ? 'bg-purple-200 text-purple-800' :
                                  u.subscriptionTier === 'MONTHLY' ? 'bg-blue-200 text-blue-800' :
                                  u.subscriptionTier === 'WEEKLY' ? 'bg-green-200 text-green-800' :
                                  'bg-slate-200 text-slate-700'
                              }`}>
                                  {u.subscriptionTier === 'LIFETIME' ? '🌟 LIFETIME' : u.subscriptionTier === 'YEARLY' ? '📅 YEARLY' : u.subscriptionTier === 'MONTHLY' ? '📆 MONTHLY' : u.subscriptionTier === 'WEEKLY' ? '⏰ WEEKLY' : 'FREE'}
                              </span>
                          </div>

                          <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Credits</p>
                                  <p className="font-black text-blue-600">{u.credits || 0}</p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Price (₹)</p>
                                  <p className="font-black text-slate-800">₹{u.subscriptionPrice || 0}</p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Expires</p>
                                  <p className="font-black text-slate-800">
                                      {u.subscriptionTier === 'LIFETIME' ? 'Never' : u.subscriptionEndDate ? new Date(u.subscriptionEndDate).toLocaleDateString() : '—'}
                                  </p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Admin Grant</p>
                                  <p className="font-black text-slate-800">{u.grantedByAdmin ? '✅' : '—'}</p>
                              </div>
                          </div>

                          <button 
                              onClick={() => openEditUser(u)}
                              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg font-bold text-xs hover:shadow-lg transition"
                          >
                              ⚙️ Manage Subscription
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- USERS TAB (Enhanced) --- */}
      {activeTab === 'USERS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">User Management</h3></div>
              <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="Search by Name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500"><tr className="uppercase text-xs"><th className="p-4">User</th><th className="p-4">Credits</th><th className="p-4">Role</th><th className="p-4 text-right">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)).map(u => (
                              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4"><p className="font-bold text-slate-800">{u.name}</p><p className="text-xs text-slate-400 font-mono">{u.id}</p></td>
                                  <td className="p-4 font-bold text-blue-600">{u.credits}</td>
                                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      {u.role !== 'ADMIN' && (
                                          <>
                                              <button onClick={() => setDmUser(u)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg" title="Message"><MessageSquare size={16} /></button>
                                              <button onClick={() => openEditUser(u)} className="p-2 text-slate-400 hover:text-orange-600 bg-slate-50 rounded-lg" title="Edit"><Edit3 size={16} /></button>
                                              <button onClick={() => {
                                                  if(confirm(`Login as ${u.name}? You will be switched to their dashboard.`)) {
                                                      onImpersonate && onImpersonate(u);
                                                  }
                                              }} className="p-2 text-slate-400 hover:text-green-600 bg-slate-50 rounded-lg" title="Impersonate (Login as User)"><Eye size={16} /></button>
                                              <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                                          </>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}


      {/* --- EDIT USER MODAL --- */}
      {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">Edit User: {editingUser.name}</h3>
                  <div className="space-y-4">
                      {/* CREDITS */}
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">💎 Credits</label>
                          <input type="number" value={editUserCredits} onChange={e => setEditUserCredits(Number(e.target.value))} className="w-full p-2 border rounded-lg" />
                      </div>
                      
                      {/* PASSWORD */}
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">🔐 Password</label>
                          <input type="text" value={editUserPass} onChange={e => setEditUserPass(e.target.value)} className="w-full p-2 border rounded-lg" />
                      </div>

                      {/* SUBSCRIPTION TIER */}
                      <div className="border-t pt-3">
                          <label className="text-xs font-bold text-slate-500 uppercase">👑 Grant Subscription</label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              <button onClick={() => { setEditSubscriptionTier('FREE'); setEditSubscriptionPrice(0); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'FREE' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'}`}>FREE</button>
                              <button onClick={() => { setEditSubscriptionTier('WEEKLY'); updatePriceForSelection('WEEKLY', editSubscriptionLevel); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'WEEKLY' ? 'bg-green-200 text-green-800' : 'bg-green-50 text-green-600'}`}>⏰ WEEKLY</button>
                              <button onClick={() => { setEditSubscriptionTier('MONTHLY'); updatePriceForSelection('MONTHLY', editSubscriptionLevel); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'MONTHLY' ? 'bg-blue-200 text-blue-800' : 'bg-blue-50 text-blue-600'}`}>📆 MONTHLY</button>
                              <button onClick={() => { setEditSubscriptionTier('3_MONTHLY'); updatePriceForSelection('3_MONTHLY', editSubscriptionLevel); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === '3_MONTHLY' ? 'bg-indigo-200 text-indigo-800' : 'bg-indigo-50 text-indigo-600'}`}>📅 3 MONTHLY</button>
                              <button onClick={() => { setEditSubscriptionTier('YEARLY'); updatePriceForSelection('YEARLY', editSubscriptionLevel); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'YEARLY' ? 'bg-purple-200 text-purple-800' : 'bg-purple-50 text-purple-600'}`}>📅 YEARLY</button>
                              <button onClick={() => { setEditSubscriptionTier('LIFETIME'); updatePriceForSelection('LIFETIME', editSubscriptionLevel); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'LIFETIME' ? 'bg-yellow-200 text-yellow-800' : 'bg-yellow-50 text-yellow-600'}`}>🌟 LIFETIME</button>
                              <button onClick={() => { setEditSubscriptionTier('CUSTOM'); setEditSubscriptionPrice(0); }} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'CUSTOM' ? 'bg-pink-200 text-pink-800' : 'bg-pink-50 text-pink-600'}`}>⚙️ CUSTOMIZED</button>
                          </div>
                      </div>

                      {/* SUBSCRIPTION LEVEL */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div className="mt-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Level (For Real Users)</label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                  <button onClick={() => { setEditSubscriptionLevel('BASIC'); updatePriceForSelection(editSubscriptionTier, 'BASIC'); }} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'BASIC' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-200'}`}>BASIC</button>
                                  <button onClick={() => { setEditSubscriptionLevel('ULTRA'); updatePriceForSelection(editSubscriptionTier, 'ULTRA'); }} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'ULTRA' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-slate-200'}`}>ULTRA</button>
                              </div>
                          </div>
                      )}

                      {editSubscriptionTier === 'CUSTOM' && (
                          <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Custom Name (Hidden)</label>
                                  <input 
                                      type="text" 
                                      placeholder="Basic Ultra" 
                                      value={editCustomSubName} 
                                      onChange={e => setEditCustomSubName(e.target.value)}
                                      className="w-full p-2 border rounded-lg text-sm"
                                  />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">Y</label>
                                      <input type="number" value={editSubscriptionYears} onChange={e => setEditSubscriptionYears(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">M</label>
                                      <input type="number" value={editSubscriptionMonths} onChange={e => setEditSubscriptionMonths(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">D</label>
                                      <input type="number" value={editSubscriptionDays} onChange={e => setEditSubscriptionDays(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">H</label>
                                      <input type="number" value={editSubscriptionHours} onChange={e => setEditSubscriptionHours(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">Min</label>
                                      <input type="number" value={editSubscriptionMinutes} onChange={e => setEditSubscriptionMinutes(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sec</label>
                                      <input type="number" value={editSubscriptionSeconds} onChange={e => setEditSubscriptionSeconds(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* SUBSCRIPTION LEVEL */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div className="mt-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Level (For Real Users)</label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                  <button onClick={() => { setEditSubscriptionLevel('BASIC'); updatePriceForSelection(editSubscriptionTier, 'BASIC'); }} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'BASIC' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-200'}`}>BASIC</button>
                                  <button onClick={() => { setEditSubscriptionLevel('ULTRA'); updatePriceForSelection(editSubscriptionTier, 'ULTRA'); }} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'ULTRA' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-slate-200'}`}>ULTRA</button>
                              </div>
                          </div>
                      )}

                      {/* STANDARD DURATION INFO (NON-EDITABLE) */}
                      {editSubscriptionTier !== 'FREE' && editSubscriptionTier !== 'CUSTOM' && (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">📅 Duration (Fixed)</label>
                              <p className="font-black text-slate-800">
                                  {editSubscriptionTier === 'WEEKLY' ? '7 Days' :
                                   editSubscriptionTier === 'MONTHLY' ? '30 Days' :
                                   editSubscriptionTier === '3_MONTHLY' ? '90 Days (3 Months)' :
                                   editSubscriptionTier === 'YEARLY' ? '365 Days (1 Year)' :
                                   editSubscriptionTier === 'LIFETIME' ? 'Lifetime (Forever)' : 'Custom'}
                              </p>
                          </div>
                      )}

                      {/* SUBSCRIPTION PRICE */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">💰 Subscription Price (₹)</label>
                              <input 
                                  type="number" 
                                  value={editSubscriptionPrice} 
                                  onChange={e => setEditSubscriptionPrice(Number(e.target.value))} 
                                  className={`w-full p-2 border rounded-lg ${editSubscriptionTier !== 'CUSTOM' ? 'bg-slate-100 text-slate-500' : 'bg-white font-bold'}`} 
                                  disabled={editSubscriptionTier !== 'CUSTOM'}
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                  {editSubscriptionTier === 'CUSTOM' 
                                      ? "Set custom price manually." 
                                      : "Price automatically set based on Store Plans."}
                              </p>
                          </div>
                      )}

                      {/* BUTTONS (SPLIT FOR FREE VS PAID) */}
                      <div className="flex gap-2 pt-4 border-t">
                          <button onClick={() => setEditingUser(null)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded font-bold text-xs">Cancel</button>
                          
                          {/* ONLY MAIN ADMIN CAN GRANT FREE SUB */}
                          {currentUser?.role === 'ADMIN' && (
                              <button onClick={() => handleGrantSubscription('FREE')} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 shadow">
                                  🎁 Grant Free
                              </button>
                          )}
                          
                          <button onClick={() => handleGrantSubscription('PAID')} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 shadow">
                              💳 Record Paid
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- DM USER MODAL WITH GIFT --- */}
      {dmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Gift className="text-pink-500" /> Gift & Message
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">To: <span className="font-bold text-slate-800">{dmUser.name}</span></p>
                  
                  <textarea 
                      value={dmText} 
                      onChange={e => setDmText(e.target.value)} 
                      className="w-full h-24 p-3 border rounded-xl mb-4 text-sm" 
                      placeholder="Write a message..." 
                  />

                  <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 mb-4">
                      <label className="text-xs font-bold text-pink-700 uppercase block mb-2">Attach Gift</label>
                      <select 
                          value={giftType} 
                          onChange={e => setGiftType(e.target.value as any)} 
                          className="w-full p-2 border rounded-lg text-sm mb-2"
                      >
                          <option value="NONE">None</option>
                          <option value="CREDITS">Credits (Coins)</option>
                          <option value="SUBSCRIPTION">Subscription</option>
                          {/* <option value="ANIMATION">Unlock Animation</option> */}
                      </select>

                      {giftType === 'CREDITS' && (
                          <input 
                              type="number" 
                              placeholder="Amount (e.g. 100)" 
                              value={giftValue} 
                              onChange={e => setGiftValue(Number(e.target.value))} 
                              className="w-full p-2 border rounded-lg text-sm"
                          />
                      )}

                      {giftType === 'SUBSCRIPTION' && (
                          <div className="space-y-2">
                              <select 
                                  value={giftValue} 
                                  onChange={e => setGiftValue(e.target.value)} 
                                  className="w-full p-2 border rounded-lg text-sm"
                              >
                                  <option value="">Select Plan</option>
                                  <option value="WEEKLY_BASIC">Weekly Basic</option>
                                  <option value="WEEKLY_ULTRA">Weekly Ultra</option>
                                  <option value="MONTHLY_BASIC">Monthly Basic</option>
                                  <option value="MONTHLY_ULTRA">Monthly Ultra</option>
                                  <option value="YEARLY_BASIC">Yearly Basic</option>
                                  <option value="YEARLY_ULTRA">Yearly Ultra</option>
                              </select>
                              <div className="flex gap-2 items-center">
                                  <label className="text-xs text-slate-500">Duration (Hrs):</label>
                                  <input 
                                      type="number" 
                                      value={giftDuration} 
                                      onChange={e => setGiftDuration(Number(e.target.value))} 
                                      className="w-20 p-2 border rounded-lg text-sm"
                                  />
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="flex gap-2">
                      <button onClick={() => {setDmUser(null); setGiftType('NONE');}} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Cancel</button>
                      <button onClick={sendDirectMessage} className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700">
                          <Gift size={18} /> Send Gift
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'UNIVERSAL_PLAYLIST' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-rose-800">Universal Video Playlist</h3>
              </div>
              
              <div className="bg-rose-50 p-6 rounded-xl border border-rose-200">
                  <div className="flex items-center gap-2 mb-4">
                      <Youtube size={24} className="text-rose-600" />
                      <h4 className="font-bold text-rose-900">Manage Universal Videos</h4>
                  </div>
                  <p className="text-xs text-rose-700 mb-6 bg-white p-3 rounded-lg border border-rose-100">
                      These videos will be visible to ALL students on their dashboard. Use this for announcements, special lectures, or featured content.
                  </p>

                  <div className="space-y-4 mb-6">
                      {universalVideos.map((vid, i) => (
                          <div key={i} className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
                              <div className="flex gap-2 items-center">
                                  <span className="w-8 text-center text-xs font-bold text-rose-500 bg-rose-50 rounded py-2">{i + 1}</span>
                                  <input 
                                      type="text" 
                                      value={vid.title} 
                                      onChange={(e) => {
                                          const updated = [...universalVideos];
                                          updated[i] = {...updated[i], title: e.target.value};
                                          setUniversalVideos(updated);
                                      }}
                                      placeholder="Video Title"
                                      className="flex-1 p-2 border border-slate-200 rounded text-xs font-bold"
                                  />
                                  <select 
                                      value={vid.access || 'FREE'} 
                                      onChange={(e) => {
                                          const updated = [...universalVideos];
                                          updated[i] = {...updated[i], access: e.target.value};
                                          setUniversalVideos(updated);
                                      }}
                                      className="w-24 p-2 border border-slate-200 rounded text-xs bg-slate-50"
                                  >
                                      <option value="FREE">Free</option>
                                      <option value="BASIC">Basic</option>
                                      <option value="ULTRA">Ultra</option>
                                  </select>
                                  <button 
                                      onClick={() => {
                                          const updated = universalVideos.filter((_, idx) => idx !== i);
                                          setUniversalVideos(updated);
                                      }}
                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                              <input 
                                  type="text" 
                                  value={vid.url || ''} 
                                  onChange={(e) => {
                                      const updated = [...universalVideos];
                                      updated[i] = {...updated[i], url: e.target.value};
                                      setUniversalVideos(updated);
                                  }}
                                  placeholder="YouTube URL (e.g. https://youtu.be/...)"
                                  className="w-full p-2 border border-slate-200 rounded text-xs font-mono text-blue-600 bg-slate-50" 
                              />
                          </div>
                      ))}
                  </div>

                  <div className="flex gap-2">
                      <button 
                          onClick={() => setUniversalVideos([...universalVideos, {title: '', url: '', price: 0, access: 'FREE'}])}
                          className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition dashed"
                      >
                          + Add Universal Video
                      </button>
                      <button onClick={saveUniversalPlaylist} className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl shadow hover:bg-rose-700 transition">
                          💾 Save Playlist
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'PRICING_MGMT' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">💰 Pricing Management</h3></div>
              
              {/* SUBSCRIPTION PLANS */}
              <div className="mb-8">
                  <h4 className="font-bold text-lg mb-4 text-slate-800">Subscription Plans</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(localSettings.subscriptionPlans || []).map((plan, idx) => (
                          <div key={plan.id} className="border rounded-xl p-4 hover:shadow-md transition-all">
                              <h5 className="font-bold text-slate-800">{plan.name}</h5>
                              <p className="text-xs text-slate-500 mb-2">{plan.duration}</p>
                              <div className="flex flex-col gap-1 mb-3">
                                  <div className="flex gap-2 items-center">
                                      <span className="text-xs font-bold text-slate-400 w-12">BASIC:</span>
                                      <span className="text-xl font-black text-blue-600">₹{plan.basicPrice}</span>
                                      {plan.basicOriginalPrice && <span className="text-xs line-through text-slate-400">₹{plan.basicOriginalPrice}</span>}
                                  </div>
                                  <div className="flex gap-2 items-center">
                                      <span className="text-xs font-bold text-slate-400 w-12">ULTRA:</span>
                                      <span className="text-xl font-black text-purple-600">₹{plan.ultraPrice}</span>
                                      {plan.ultraOriginalPrice && <span className="text-xs line-through text-slate-400">₹{plan.ultraOriginalPrice}</span>}
                                  </div>
                              </div>
                              <button onClick={() => setEditingPlanIdx(idx)} className="w-full py-2 bg-blue-100 text-blue-700 rounded font-bold text-sm hover:bg-blue-200">
                                  Edit
                              </button>
                          </div>
                      ))}
                  </div>
              </div>

                  {/* GLOBAL DEFAULT PRICING */}
              <div className="mb-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">Global Default Pricing <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full uppercase">Fallback</span></h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Default Video Cost (Credits)</label>
                          <input type="number" value={localSettings.defaultVideoCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, defaultVideoCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Used if individual video price is not set.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Default PDF Cost (Credits)</label>
                          <input type="number" value={localSettings.defaultPdfCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, defaultPdfCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Used if individual PDF price is not set.</p>
                      </div>
                  </div>
              </div>

              {/* MCQ PRICING CONFIG */}
              <div className="mb-8 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">MCQ Settings <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full uppercase">Restrictions & Costs</span></h4>
                  <div className="bg-white p-3 rounded-lg border border-purple-100 mb-4 flex items-center justify-between">
                      <div>
                          <p className="font-bold text-slate-700 text-sm">MCQ Chapter Lock (100 Qs)</p>
                          <p className="text-[10px] text-slate-500">Require 100 solved MCQs to unlock next chapter.</p>
                      </div>
                      <input 
                          type="checkbox" 
                          checked={localSettings.enableMcqUnlockRestriction !== false} 
                          onChange={() => toggleSetting('enableMcqUnlockRestriction')} 
                          className="w-5 h-5 accent-purple-600" 
                      />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Test Entry Cost</label>
                          <input type="number" value={localSettings.mcqTestCost ?? 2} onChange={(e) => setLocalSettings({...localSettings, mcqTestCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to start a Premium Test.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Analysis Cost</label>
                          <input type="number" value={localSettings.mcqAnalysisCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, mcqAnalysisCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to unlock answers.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">History View Cost</label>
                          <input type="number" value={localSettings.mcqHistoryCost ?? 1} onChange={(e) => setLocalSettings({...localSettings, mcqHistoryCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to view past results.</p>
                      </div>
                  </div>
              </div>

                  {/* LESSON UNLOCKING POLICY */}
                  <div className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <h4 className="font-bold text-lg mb-4 text-orange-900 flex items-center gap-2">
                          <Lock size={20} /> Lesson Unlocking Rules
                      </h4>
                      <div className="bg-white p-3 rounded-lg border border-orange-100 flex items-center justify-between">
                          <div>
                              <p className="font-bold text-slate-800 text-sm">Sequential Unlocking (100 MCQs)</p>
                              <p className="text-[10px] text-slate-500">
                                  If ON: Students must solve 100 MCQs in Chapter 1 to unlock Chapter 2.<br/>
                                  If OFF: All chapters are open by default (Admin Override).
                              </p>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-orange-600 uppercase">
                                  {localSettings.lessonUnlockPolicy === 'SEQUENTIAL_100_MCQ' ? 'ACTIVE' : 'DISABLED'}
                              </span>
                              <button 
                                  onClick={() => setLocalSettings({
                                      ...localSettings, 
                                      lessonUnlockPolicy: localSettings.lessonUnlockPolicy === 'SEQUENTIAL_100_MCQ' ? 'ALL_OPEN' : 'SEQUENTIAL_100_MCQ'
                                  })}
                                  className={`w-12 h-6 rounded-full p-1 transition-colors ${localSettings.lessonUnlockPolicy === 'SEQUENTIAL_100_MCQ' ? 'bg-orange-600' : 'bg-slate-300'}`}
                              >
                                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${localSettings.lessonUnlockPolicy === 'SEQUENTIAL_100_MCQ' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </button>
                          </div>
                      </div>
                  </div>

              {/* FULL FEATURE PRICING MASTER LIST */}
              <div className="mb-8 p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                      <Banknote size={20} /> Master Pricing Control
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Helper to render price input */}
                      {[
                          { key: 'mcqTestCost', label: 'MCQ Test Entry', default: 2 },
                          { key: 'mcqAnalysisCost', label: 'MCQ Analysis Unlock', default: 5 },
                          { key: 'mcqHistoryCost', label: 'MCQ History View', default: 1 },
                          { key: 'defaultPdfCost', label: 'PDF Access', default: 5 },
                          { key: 'defaultVideoCost', label: 'Video Access', default: 5 },
                          { key: 'chatCost', label: 'Support Chat', default: 1 },
                          { key: 'gameCost', label: 'Spin Wheel', default: 0 },
                          { key: 'profileEditCost', label: 'Edit Profile (Free User)', default: 10 },
                      ].map((item) => (
                          <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                  <label className="text-xs font-bold text-slate-600 uppercase">{item.label}</label>
                                  {/* Toggle Switch Logic: Assuming 0 means "Off/Free" effectively, or we can use a separate boolean. 
                                      User said "coin off... lock laga dega". 
                                      We will use a checkbox that sets cost to 0 if unchecked, or restores default/input if checked? 
                                      Actually better to just have the input. If Admin sets 0, it's free. 
                                      If Admin sets -1 or similar, maybe locked? 
                                      Let's keep it simple: Just the cost input. 0 = Free. >0 = Paid.
                                  */}
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-400">🪙</span>
                                  <input 
                                      type="number" 
                                      // @ts-ignore
                                      value={localSettings[item.key] !== undefined ? localSettings[item.key] : item.default} 
                                      onChange={(e) => setLocalSettings({...localSettings, [item.key]: Number(e.target.value)})}
                                      className="w-full p-2 border rounded-lg font-bold text-slate-800"
                                      min="0"
                                  />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1">Set 0 to make FREE.</p>
                          </div>
                      ))}
                  </div>
              </div>

              {/* CREDIT PACKAGES */}
              <div>
                  <h4 className="font-bold text-lg mb-4 text-slate-800">Credit Packages</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {localSettings.packages.map((pkg) => (
                          <div key={pkg.id} className="border rounded-xl p-3 hover:shadow-md transition-all text-center">
                              <h5 className="font-bold text-slate-800 text-sm">{pkg.name}</h5>
                              <p className="text-xs text-slate-500 my-1">{pkg.credits} CR</p>
                              <p className="text-lg font-black text-blue-600 mb-2">₹{pkg.price}</p>
                              <button onClick={() => setEditingPkg(pkg)} className="w-full py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">
                                  Edit
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlanIdx !== null && localSettings.subscriptionPlans && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Edit Plan: {localSettings.subscriptionPlans[editingPlanIdx].name}</h3>
                  <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-800 text-xs mb-2 uppercase">Basic Tier (MCQ+Notes)</p>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Sale Price (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].basicPrice} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], basicPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Original (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].basicOriginalPrice || ''} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], basicOriginalPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                          </div>
                      </div>

                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                          <p className="font-bold text-purple-800 text-xs mb-2 uppercase">Ultra Tier (PDF+Video)</p>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Sale Price (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].ultraPrice} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], ultraPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Original (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].ultraOriginalPrice || ''} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], ultraOriginalPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingPlanIdx(null)} className="flex-1 py-2 text-slate-500">Cancel</button>
                      <button onClick={() => {handleSaveSettings(); setEditingPlanIdx(null);}} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT PACKAGE MODAL */}
      {editingPkg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Edit Package: {editingPkg.name}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500">Credits</label>
                          <input type="number" value={editingPkg.credits} onChange={(e) => setEditingPkg({...editingPkg, credits: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">Price (₹)</label>
                          <input type="number" value={editingPkg.price} onChange={(e) => setEditingPkg({...editingPkg, price: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingPkg(null)} className="flex-1 py-2 text-slate-500">Cancel</button>
                      <button onClick={() => {
                          const updated = localSettings.packages.map(p => p.id === editingPkg.id ? editingPkg : p);
                          setLocalSettings({...localSettings, packages: updated});
                          handleSaveSettings();
                          setEditingPkg(null);
                      }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'RECYCLE' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Recycle Bin (90 Days)</h3></div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500"><tr className="uppercase text-xs"><th className="p-4">Item</th><th className="p-4">Type</th><th className="p-4">Deleted</th><th className="p-4 text-right">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {recycleBin.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Bin is empty.</td></tr>}
                          {recycleBin.map(item => (
                              <tr key={item.id} className="hover:bg-red-50 transition-colors">
                                  <td className="p-4 font-bold text-slate-700">{item.name}</td>
                                  <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-500">{item.type}</span></td>
                                  <td className="p-4 text-xs text-slate-500">{new Date(item.deletedAt).toLocaleDateString()}</td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      <button onClick={() => handleRestoreItem(item)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><RotateCcw size={16} /></button>
                                      <button onClick={() => handlePermanentDelete(item.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><X size={16} /></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CROPPER MODAL */}
      {cropImageSrc && (
          <ImageCropper 
              imageSrc={cropImageSrc} 
              onCropComplete={handleCropComplete} 
              onCancel={() => setCropImageSrc(null)} 
          />
      )}

      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />

      {/* ADMIN AI ASSISTANT BUTTON */}
      <div className="fixed bottom-6 right-6 z-50">
          <button 
              onClick={() => setShowAdminAi(true)}
              className="w-14 h-14 bg-slate-900 text-green-400 rounded-full shadow-2xl flex items-center justify-center border-2 border-green-500 hover:scale-110 transition-transform animate-pulse"
              title="Admin AI Agent"
          >
              <BrainCircuit size={28} />
          </button>
      </div>

      {showAdminAi && <AdminDevAssistant onClose={() => setShowAdminAi(false)} />}
      
      {showChat && <UniversalChat user={{id: 'ADMIN', name: 'Admin', role: 'ADMIN'} as any} onClose={() => setShowChat(false)} isAdmin={true} />}

      {/* SUB-ADMIN REPORT MODAL */}
      {viewingSubAdminReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in">
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <div>
                          <h3 className="text-xl font-black text-slate-800">Sub-Admin Sales Report</h3>
                          <p className="text-sm text-slate-500">
                              Activity for: <span className="font-bold text-indigo-600">{users.find(u => u.id === viewingSubAdminReport)?.name}</span>
                          </p>
                      </div>
                      <button onClick={() => setViewingSubAdminReport(null)} className="p-2 hover:bg-slate-100 rounded-full">
                          <X size={24} className="text-slate-400" />
                      </button>
                  </div>

                  {(() => {
                      // Calculate Report Data on Render
                      const report = users.reduce((acc, u) => {
                          const userSales = (u.subscriptionHistory || []).filter(h => h.grantedBy === viewingSubAdminReport);
                          userSales.forEach(sale => {
                              acc.items.push({
                                  studentName: u.name,
                                  studentId: u.id,
                                  ...sale
                              });
                              acc.totalValue += (sale.originalPrice || 0);
                              acc.totalCollected += (sale.price || 0);
                          });
                          return acc;
                      }, { items: [] as any[], totalValue: 0, totalCollected: 0 });

                      const sortedItems = report.items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

                      return (
                          <div className="space-y-6">
                              <div className="grid grid-cols-3 gap-4">
                                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                      <p className="text-xs font-bold text-indigo-600 uppercase">Total Grants</p>
                                      <p className="text-2xl font-black text-indigo-900">{report.items.length}</p>
                                  </div>
                                  <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                                      <p className="text-xs font-bold text-green-600 uppercase">Total Value</p>
                                      <p className="text-2xl font-black text-green-900">₹{report.totalValue}</p>
                                  </div>
                                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                      <p className="text-xs font-bold text-blue-600 uppercase">Paid Collected</p>
                                      <p className="text-2xl font-black text-blue-900">₹{report.totalCollected}</p>
                                  </div>
                              </div>

                              <div>
                                  <h4 className="font-bold text-slate-800 mb-3">Transaction History</h4>
                                  <div className="max-h-60 overflow-y-auto border rounded-xl">
                                      <table className="w-full text-left text-xs">
                                          <thead className="bg-slate-50 font-bold text-slate-500 uppercase">
                                              <tr>
                                                  <th className="p-3">Date</th>
                                                  <th className="p-3">Student</th>
                                                  <th className="p-3">Plan</th>
                                                  <th className="p-3 text-right">Value</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {sortedItems.length === 0 && (
                                                  <tr><td colSpan={4} className="p-4 text-center text-slate-400">No subscriptions granted yet.</td></tr>
                                              )}
                                              {sortedItems.map((item, idx) => (
                                                  <tr key={idx} className="hover:bg-slate-50">
                                                      <td className="p-3 text-slate-500">
                                                          {new Date(item.startDate).toLocaleDateString()}
                                                          <div className="text-[10px]">{new Date(item.startDate).toLocaleTimeString()}</div>
                                                      </td>
                                                      <td className="p-3 font-bold text-slate-700">
                                                          {item.studentName}
                                                          <div className="text-[9px] font-normal text-slate-400">{item.studentId}</div>
                                                      </td>
                                                      <td className="p-3">
                                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isFree ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                              {item.isFree ? 'FREE GRANT' : 'PAID'}
                                                          </span>
                                                          <div className="mt-1 font-bold text-slate-600">{item.tier} • {item.level}</div>
                                                      </td>
                                                      <td className="p-3 text-right font-bold text-slate-800">₹{item.originalPrice}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          </div>
                      );
                  })()}
                  
                  <div className="mt-6 text-right">
                       <button onClick={() => setViewingSubAdminReport(null)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900">Close Report</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

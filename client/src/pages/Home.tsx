import { useState, useEffect, useRef } from "react";
import { Globe, Calendar, TestTube, Sparkles, Camera, AlertTriangle, HelpCircle, Settings, MapPin, Info, ChevronDown, ChevronUp, Bug, Home as HomeIcon, Flame, BarChart3, TrendingUp, Award, User, Pencil, Check, X, ThumbsUp, ThumbsDown, CheckCircle } from "lucide-react";
import logoImage from "@assets/gomi-snap-logo.png";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CameraCapture from "@/components/CameraCapture";
import TrashResult from "@/components/TrashResult";
import AlarmSettings from "@/components/AlarmSettings";
import FeedbackDialog from "@/components/FeedbackDialog";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TrashCategory, trashCategoryInfo } from "@shared/schema";
import { Language, t, LANGUAGE_NAMES, LANGUAGE_CODES } from "@/lib/translations";
import { detectLocationZone, LocationZone, LOCATION_ZONES } from "@/lib/locationZones";

interface UserStats {
  todayCount: number;
  weeklyBreakdown: Array<{ date: string; dayName: string; count: number }>;
  totalActiveDays: number;
  currentStreak: number;
  longestStreak: number;
  totalScans: number;
}

// Generate a unique session ID (per browser session)
const getOrCreateSessionId = (): string => {
  let sessionId = sessionStorage.getItem('gomiSnapSessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('gomiSnapSessionId', sessionId);
  }
  return sessionId;
};

// Generate a persistent anonymous user ID
const getOrCreateUserId = (): string => {
  let userId = localStorage.getItem('gomiSnapUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('gomiSnapUserId', userId);
  }
  return userId;
};

// Get pilot location from URL param or localStorage
const getPilotLocation = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const locParam = urlParams.get('loc');
  if (locParam) {
    localStorage.setItem('gomiSnapPilotLocation', locParam);
    return locParam;
  }
  return localStorage.getItem('gomiSnapPilotLocation');
};

// Map pilot location IDs to display names (multi-language)
const PILOT_LOCATION_NAMES: Record<string, Record<Language, string>> = {
  'aphouse1f': {
    en: 'AP House 1F Kitchen', ja: 'APハウス1Fキッチン', zh: 'AP House 1楼厨房',
    my: 'AP House 1F မီးဖိုချောင်', ko: 'AP House 1층 주방', id: 'Dapur AP House 1F'
  },
  'aphouse2f': {
    en: 'AP House 2F Kitchen', ja: 'APハウス2Fキッチン', zh: 'AP House 2楼厨房',
    my: 'AP House 2F မီးဖိုချောင်', ko: 'AP House 2층 주방', id: 'Dapur AP House 2F'
  },
  'aphouse3f': {
    en: 'AP House 3F Kitchen', ja: 'APハウス3Fキッチン', zh: 'AP House 3楼厨房',
    my: 'AP House 3F မီးဖိုချောင်', ko: 'AP House 3층 주방', id: 'Dapur AP House 3F'
  },
  'aphouse4f': {
    en: 'AP House 4F Kitchen', ja: 'APハウス4Fキッチン', zh: 'AP House 4楼厨房',
    my: 'AP House 4F မီးဖိုချောင်', ko: 'AP House 4층 주방', id: 'Dapur AP House 4F'
  },
  'apu-cafeteria': {
    en: 'APU Cafeteria', ja: 'APUカフェテリア', zh: 'APU餐厅',
    my: 'APU စားသောက်ဆိုင်', ko: 'APU 카페테리아', id: 'Kafetaria APU'
  },
  'apu-library': {
    en: 'APU Library', ja: 'APU図書館', zh: 'APU图书馆',
    my: 'APU စာကြည့်တိုက်', ko: 'APU 도서관', id: 'Perpustakaan APU'
  },
};

// Pilot mode configuration
const PILOT_CONFIG: Record<string, Record<Language, string>> = {
  title: {
    en: 'GOMI SNAP – AP House Pilot',
    ja: 'ゴミスナップ – APハウスパイロット',
    zh: 'GOMI SNAP – AP House 试点',
    my: 'GOMI SNAP – AP House စမ်းသပ်',
    ko: 'GOMI SNAP – AP House 파일럿',
    id: 'GOMI SNAP – Pilot AP House'
  },
  subtitle: {
    en: 'Your scans help improve trash sorting. Data is anonymous.',
    ja: 'スキャンでゴミ分別の改善に貢献。データは匿名です。',
    zh: '您的扫描有助于改进垃圾分类。数据是匿名的。',
    my: 'သင့်စကင်ဖတ်ခြင်းများသည် အမှိုက်ခွဲခြားမှုကို တိုးတက်စေပါသည်။ ဒေတာများသည် အမည်မသိပါ။',
    ko: '스캔이 쓰레기 분류 개선에 도움이 됩니다. 데이터는 익명입니다.',
    id: 'Pemindaian Anda membantu meningkatkan pemilahan sampah. Data bersifat anonim.'
  }
};

// Check if debug mode is enabled - Only accessible in development mode for security
const isDebugMode = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const hasDebugParam = urlParams.get('debug') === '1';
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  // Debug panel only available in development mode with ?debug=1 parameter
  return hasDebugParam && isDevelopment;
};

// Event log entry type for debug panel
interface DebugEvent {
  eventName: string;
  timestamp: string;
  payload?: string;
}

// Beppu area coordinates for auto-detection
const BEPPU_BOUNDS = {
  minLat: 33.20,
  maxLat: 33.40,
  minLng: 131.40,
  maxLng: 131.60
};

// Check if coordinates are within Beppu area
const isInBeppu = (lat: number, lng: number): boolean => {
  return lat >= BEPPU_BOUNDS.minLat && lat <= BEPPU_BOUNDS.maxLat &&
         lng >= BEPPU_BOUNDS.minLng && lng <= BEPPU_BOUNDS.maxLng;
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [showWhyExplanation, setShowWhyExplanation] = useState(false);
  const [whyExplanation, setWhyExplanation] = useState<string>("");
  const [result, setResult] = useState<{
    itemName: string;
    category: TrashCategory;
    instructions?: string;
    confidence: number;
    itemCount: number;
    needsClarification?: boolean;
    clarificationQuestion?: string;
    capInstructions?: { material: string; bagColor: string };
    partInstructions?: Array<{ partName: string; bagColor: string }>;
    rejectionReason?: "HUMAN" | "NON_WASTE_CONTEXT" | "UNCOLLECTABLE";
  } | null>(null);
  const [storedImageData, setStoredImageData] = useState<string | null>(null);
  const [showClarificationDialog, setShowClarificationDialog] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const { toast} = useToast();
  
  // Analytics tracking state
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const [anonymousUserId] = useState<string>(() => getOrCreateUserId());
  const [pilotLocationId] = useState<string | null>(() => getPilotLocation());
  
  // Debug mode state
  const [debugMode] = useState<boolean>(() => isDebugMode());
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  
  // How to use section state
  const [showHowToUse, setShowHowToUse] = useState(true);
  
  // Location tracking state (simplified - auto-detect Beppu only)
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [locationConsent, setLocationConsent] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string | null;
  } | null>(null);
  const [detectedZone, setDetectedZone] = useState<LocationZone | null>(null);
  const [hasShownBeppuWelcome, setHasShownBeppuWelcome] = useState(false);
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);
  
  // Disposal verification state
  const [showDisposalVerification, setShowDisposalVerification] = useState(false);
  const [showSatisfactionRating, setShowSatisfactionRating] = useState(false);
  const disposalTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Snapshot of result when disposal dialog is triggered (to preserve data if result is cleared)
  const [disposalResultSnapshot, setDisposalResultSnapshot] = useState<{
    category: TrashCategory;
    itemName: string;
    confidence: number;
    detectedZoneId: string | null;
  } | null>(null);
  
  // User name state (optional, stored in localStorage)
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('gomiSnapUserName') || '';
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Fetch user stats
  const { data: userStats, refetch: refetchStats } = useQuery<UserStats>({
    queryKey: ['/api/user-stats', anonymousUserId],
    enabled: !!anonymousUserId,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });

  // Check location consent on mount
  useEffect(() => {
    const consent = localStorage.getItem('gomiSnapLocationConsent');
    if (consent === null) {
      // First time user - show consent modal
      setShowLocationConsent(true);
    } else {
      setLocationConsent(consent === 'true');
      if (consent === 'true') {
        // User has consented - try to get location
        requestLocation();
      }
    }
  }, []);

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Auto-detect if user is in Beppu area
          const city = isInBeppu(lat, lng) ? "Beppu" : null;
          
          // Detect specific zone (APU Campus or Downtown Beppu)
          const zone = detectLocationZone(lat, lng);
          setDetectedZone(zone);
          
          setCurrentLocation({
            latitude: lat,
            longitude: lng,
            city: city,
          });
          
          // Show zone-specific welcome popup only once
          if (zone && !hasShownBeppuWelcome) {
            setHasShownBeppuWelcome(true);
            const zoneName = zone.nameLang[language];
            toast({
              title: t("welcomeToGomiSnap", language),
              description: t("detectedLocation", language).replace("{zone}", zoneName),
            });
          } else if (city === "Beppu" && !hasShownBeppuWelcome) {
            setHasShownBeppuWelcome(true);
            toast({
              title: t("welcomeToBeppu", language),
              description: t("helpSortBeppu", language),
            });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Set empty location - analytics will still track other data
          setCurrentLocation({
            latitude: 0,
            longitude: 0,
            city: null,
          });
          setDetectedZone(null);
        },
        {
          timeout: 5000,
          enableHighAccuracy: false
        }
      );
    } else {
      // Geolocation not supported - set empty location
      setCurrentLocation({
        latitude: 0,
        longitude: 0,
        city: null,
      });
      setDetectedZone(null);
    }
  };

  const handleLocationConsent = (consented: boolean) => {
    setLocationConsent(consented);
    localStorage.setItem('gomiSnapLocationConsent', consented.toString());
    setShowLocationConsent(false);
    
    if (consented) {
      requestLocation();
    }
  };


  const getProgressStage = (progress: number, lang: Language) => {
    if (progress < 20) return t("progressCapturing", lang);
    if (progress < 50) return t("progressAnalyzing", lang);
    if (progress < 85) return t("progressIdentifying", lang);
    return t("progressPreparing", lang);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && progress < 95) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const increment = prev < 20 ? 4 : prev < 50 ? 3 : prev < 85 ? 2 : 1;
          const newProgress = Math.min(prev + increment, 95);
          setProgressStage(getProgressStage(newProgress, language));
          return newProgress;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isProcessing, progress, language]);

  // Log analytics event
  const logEvent = async (eventName: string, payload?: Record<string, unknown>) => {
    // Add to debug events if debug mode is enabled
    if (debugMode) {
      setDebugEvents(prev => {
        const newEvent: DebugEvent = {
          eventName,
          timestamp: new Date().toLocaleTimeString(),
          payload: payload ? JSON.stringify(payload).slice(0, 100) : undefined,
        };
        return [newEvent, ...prev].slice(0, 10); // Keep last 10 events
      });
    }
    
    // Include detected zone in all events
    const enhancedPayload = {
      ...payload,
      detectedZone: detectedZone?.id || null,
      detectedZoneName: detectedZone?.name || null,
    };
    
    try {
      await apiRequest("POST", "/api/events", {
        eventName,
        anonymousUserId,
        sessionId,
        pilotLocationId: pilotLocationId || detectedZone?.id || null,
        namespace: 'app',
        payload: enhancedPayload,
      });
    } catch (error) {
      console.error("Failed to log event:", error);
    }
  };

  // Log app_opened and page_viewed on mount (with debouncing to prevent inflation)
  useEffect(() => {
    const DEBOUNCE_MS = 30000; // 30 seconds debounce window
    const now = Date.now();
    
    // Check if we should log app_opened (debounced)
    const lastAppOpened = sessionStorage.getItem('lastAppOpenedAt');
    if (!lastAppOpened || now - parseInt(lastAppOpened, 10) > DEBOUNCE_MS) {
      logEvent('app_opened');
      sessionStorage.setItem('lastAppOpenedAt', now.toString());
    }
    
    // Check if we should log page_viewed for home (debounced)
    const lastHomeViewed = sessionStorage.getItem('lastHomeViewedAt');
    if (!lastHomeViewed || now - parseInt(lastHomeViewed, 10) > DEBOUNCE_MS) {
      logEvent('page_viewed', { page: 'home' });
      sessionStorage.setItem('lastHomeViewedAt', now.toString());
    }
  }, []);

  const handleClearResult = () => {
    // Log guidance confirmed when user moves on (implies they accepted the guidance)
    if (result) {
      logEvent('guidance_confirmed', {
        category: result.category,
        itemName: result.itemName,
        confidence: result.confidence,
      });
    }
    // Clear disposal verification timer
    if (disposalTimerRef.current) {
      clearTimeout(disposalTimerRef.current);
      disposalTimerRef.current = null;
    }
    setResult(null);
    setShowWhyExplanation(false);
    setWhyExplanation("");
    setShowFeedbackPrompt(false);
    setShowDisposalVerification(false);
    setShowSatisfactionRating(false);
    setDisposalResultSnapshot(null);
  };

  // Start disposal verification timer when result is shown
  useEffect(() => {
    if (result && !result.needsClarification) {
      // Show disposal verification after 30 seconds
      disposalTimerRef.current = setTimeout(() => {
        // Capture snapshot before showing dialog
        setDisposalResultSnapshot({
          category: result.category,
          itemName: result.itemName,
          confidence: result.confidence,
          detectedZoneId: detectedZone?.id || null,
        });
        setShowDisposalVerification(true);
      }, 30000);
      
      return () => {
        if (disposalTimerRef.current) {
          clearTimeout(disposalTimerRef.current);
        }
      };
    }
  }, [result, detectedZone]);

  // Handle disposal verification response
  const handleDisposalVerification = (disposed: boolean) => {
    setShowDisposalVerification(false);
    
    // Use snapshot data (preserved even if result was cleared)
    const snapshotData = disposalResultSnapshot;
    
    if (disposed && snapshotData) {
      logEvent('disposal_completed', {
        category: snapshotData.category,
        itemName: snapshotData.itemName,
        confidence: snapshotData.confidence,
        detectedZone: snapshotData.detectedZoneId,
      });
      // Show satisfaction rating after disposal confirmation
      setShowSatisfactionRating(true);
    } else if (snapshotData) {
      logEvent('disposal_not_yet', {
        category: snapshotData.category,
        itemName: snapshotData.itemName,
      });
      setDisposalResultSnapshot(null);
    }
  };

  // Handle satisfaction rating
  const handleSatisfactionRating = (satisfied: boolean) => {
    setShowSatisfactionRating(false);
    
    // Use snapshot data (preserved even if result was cleared)
    const snapshotData = disposalResultSnapshot;
    
    if (snapshotData) {
      logEvent('satisfaction_rating', {
        satisfied,
        category: snapshotData.category,
        itemName: snapshotData.itemName,
        detectedZone: snapshotData.detectedZoneId,
      });
    }
    setDisposalResultSnapshot(null);
    
    toast({
      title: t("thankYouTitle", language),
      description: satisfied ? t("gladToHelp", language) : t("willImprove", language),
    });
  };

  // Handle post-scan feedback
  const handleFeedback = (helpful: boolean | null) => {
    setShowFeedbackPrompt(false);
    logEvent('feedback_submitted', {
      helpful,
      category: result?.category,
      itemName: result?.itemName,
    });
    toast({
      title: t("thanksFeedback", language),
      description: t("helpsImprove", language),
    });
  };

  const handleWhyExplanationToggle = async (open: boolean) => {
    setShowWhyExplanation(open);
    
    if (open && result) {
      logEvent('why_opened', { category: result.category, itemName: result.itemName });
      // Also log as rules_viewed for impact reporting
      logEvent('rules_viewed', { category: result.category, itemName: result.itemName });
      
      if (!whyExplanation) {
        try {
          const response = await apiRequest("POST", "/api/explain-trash", {
            category: result.category,
            itemName: result.itemName,
            language
          });
          const data = await response.json();
          setWhyExplanation(data.explanation);
        } catch (error) {
          console.error("Error fetching explanation:", error);
          setWhyExplanation(t("unableToLoadExplanation", language));
        }
      }
    }
  };

  const commonItems: { name: Record<Language, string>; category: TrashCategory; instructions: Record<Language, string>; partInstructions?: Array<{ partName: Record<Language, string>; bagColor: string }>; capInstructions?: { material: Record<Language, string>; bagColor: string } }[] = [
    { 
      name: { en: "PET Bottle", ja: "PETボトル", zh: "塑料瓶", my: "ပလတ်စတစ်ပုလင်း", ko: "페트병", id: "Botol PET" },
      category: "recyclable",
      instructions: { en: "Rinse, remove cap and label", ja: "洗って、キャップとラベルを外す", zh: "清洗，去除瓶盖和标签", my: "ဆေးကြော၍ အဖုံးနှင့် တံဆိပ်ဖယ်ပါ", ko: "헹구고 뚜껑과 라벨 제거", id: "Bilas, lepas tutup dan label" },
      capInstructions: {
        material: { en: "Plastic", ja: "プラスチック", zh: "塑料", my: "ပလတ်စတစ်", ko: "플라스틱", id: "Plastik" },
        bagColor: "Green"
      },
      partInstructions: [
        { partName: { en: "Cap", ja: "キャップ", zh: "瓶盖", my: "အဖုံး", ko: "뚜껑", id: "Tutup" }, bagColor: "Green" },
        { partName: { en: "Label/Wrapper", ja: "ラベル", zh: "标签", my: "တံဆိပ်", ko: "라벨", id: "Label" }, bagColor: "Green" },
      ]
    },
    { 
      name: { en: "Aluminum Can", ja: "アルミ缶", zh: "铝罐", my: "အလူမီနီယမ်ဘူး", ko: "알루미늄 캔", id: "Kaleng Aluminium" },
      category: "recyclable",
      instructions: { en: "Rinse thoroughly", ja: "よく洗う", zh: "彻底清洗", my: "သေချာစွာဆေးကြောပါ", ko: "깨끗이 헹구세요", id: "Bilas sampai bersih" }
    },
    { 
      name: { en: "Milk Carton", ja: "牛乳パック", zh: "牛奶盒", my: "နို့ဘူး", ko: "우유팩", id: "Karton Susu" },
      category: "old-paper-clothing",
      instructions: { en: "Wash, cut open, dry, tie in bundle", ja: "洗って、開いて、乾かして、束ねる", zh: "清洗，剪开，晾干，捆扎", my: "ဆေး၊ ဖြတ်၊ ခြောက်စေ၍ စည်းထုပ်ပါ", ko: "씻고, 펴서, 말려서, 묶기", id: "Cuci, buka, keringkan, ikat" }
    },
    { 
      name: { en: "Plastic Tray", ja: "プラスチックトレイ", zh: "塑料托盘", my: "ပလတ်စတစ်ဗန်း", ko: "플라스틱 트레이", id: "Nampan Plastik" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Coffee Cup", ja: "コーヒーカップ", zh: "咖啡杯", my: "ကော်ဖီခွက်", ko: "커피컵", id: "Gelas Kopi" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Tissue Paper", ja: "ティッシュ", zh: "纸巾", my: "တစ်ရှူးစက္ကူ", ko: "휴지", id: "Tisu" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Snack Wrapper", ja: "スナック包装", zh: "零食包装", my: "မုန့်ထုပ်", ko: "과자 봉지", id: "Bungkus Snack" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Glass Jar", ja: "ガラス瓶", zh: "玻璃瓶", my: "ဖန်ပုလင်း", ko: "유리병", id: "Toples Kaca" },
      category: "recyclable",
      instructions: { en: "Rinse thoroughly, remove lid", ja: "よく洗って、蓋を外す", zh: "彻底清洗，去除盖子", my: "သေချာဆေးကြော၍ အဖုံးဖယ်ပါ", ko: "깨끗이 헹구고 뚜껑 제거", id: "Bilas bersih, lepas tutup" },
      capInstructions: {
        material: { en: "Metal", ja: "金属", zh: "金属", my: "သတ္တု", ko: "금속", id: "Logam" },
        bagColor: "Transparent"
      },
      partInstructions: [
        { partName: { en: "Lid/Top", ja: "フタ", zh: "盖子", my: "အဖုံး", ko: "뚜껑", id: "Penutup" }, bagColor: "Transparent" },
      ]
    },
    { 
      name: { en: "Chopsticks", ja: "箸", zh: "筷子", my: "တူ", ko: "젓가락", id: "Sumpit" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Styrofoam", ja: "発泡スチロール", zh: "泡沫塑料", my: "ဖောမ်ပလတ်စတစ်", ko: "스티로폼", id: "Styrofoam" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Plastic Bag", ja: "ビニール袋", zh: "塑料袋", my: "ပလတ်စတစ်အိတ်", ko: "비닐봉지", id: "Kantong Plastik" },
      category: "burnable",
      instructions: { en: "No preparation needed", ja: "準備不要", zh: "无需准备", my: "ပြင်ဆင်ရန်မလို", ko: "준비 필요 없음", id: "Tidak perlu persiapan" }
    },
    { 
      name: { en: "Cardboard", ja: "段ボール", zh: "纸板箱", my: "ကတ်ထူပုံး", ko: "골판지", id: "Kardus" },
      category: "old-paper-clothing",
      instructions: { en: "Flatten and tie in bundle", ja: "平らにして束ねる", zh: "压平并捆扎", my: "ပြားအောင်ချပြီးစည်းထုပ်ပါ", ko: "납작하게 접어서 묶기", id: "Ratakan dan ikat" }
    },
  ];

  const handleQuickSelect = (item: typeof commonItems[0]) => {
    logEvent('quick_item_selected', { itemName: item.name.en, category: item.category });
    setResult({
      itemName: item.name[language],
      category: item.category,
      instructions: item.instructions[language],
      confidence: 1.0,
      itemCount: 1,
      capInstructions: item.capInstructions ? {
        material: item.capInstructions.material[language] || item.capInstructions.material.en,
        bagColor: item.capInstructions.bagColor
      } : undefined,
      partInstructions: item.partInstructions ? item.partInstructions.map(p => ({
        partName: p.partName[language] || p.partName.en,
        bagColor: p.bagColor
      })) : undefined,
    });
    setShowWhyExplanation(false);
    setShowFeedbackPrompt(true);
    logEvent('classification_finalized', { category: item.category, itemName: item.name.en });
  };

  const handleImageCapture = async (imageData: string, clarificationAnswer?: { question: string; answer: boolean }, retried?: boolean) => {
    setIsProcessing(true);
    if (!clarificationAnswer) {
      // First scan - store image and reset result
      setStoredImageData(imageData);
      setResult(null);
      logEvent('scan_started');
    } else {
      logEvent('clarification_answered', { answer: clarificationAnswer.answer });
    }
    setProgress(0);
    setProgressStage(getProgressStage(0, language));

    // Generate unique scanId for idempotency (prevents duplicate scan logging)
    const scanId = crypto.randomUUID();

    // Prepare location data for analytics (before try block for access in catch)
    const locationData = currentLocation ? {
      sessionId,
      city: currentLocation.city,
      latitude: currentLocation.latitude !== 0 ? currentLocation.latitude : null,
      longitude: currentLocation.longitude !== 0 ? currentLocation.longitude : null,
      locationSource: currentLocation.latitude !== 0 ? 'browser' : 'manual'
    } : {
      sessionId,
      city: null,
      latitude: null,
      longitude: null,
      locationSource: null
    };

    try {
      const response = await apiRequest("POST", "/api/identify-trash", { 
        image: imageData, 
        demoMode, 
        language,
        clarificationAnswer,
        anonymousUserId,
        scanId,
        ...locationData
      });
      const data = await response.json();

      if (data.useDemoMode) {
        setDemoMode(true);
        toast({
          title: t("demoModeEnabled", language),
          description: t("demoModeDescription", language),
        });
        
        const retryResponse = await apiRequest("POST", "/api/identify-trash", { 
          image: imageData, 
          demoMode: true, 
          language,
          anonymousUserId,
          scanId,
          ...locationData
        });
        const retryData = await retryResponse.json();
        
        setProgress(100);
        setProgressStage(t("complete", language));
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Look up instructions from trashCategoryInfo
        const categoryInfo = trashCategoryInfo[retryData.category as TrashCategory];
        setResult({
          ...retryData,
          instructions: retryData.instructions || categoryInfo.instructionsEn
        });
      } else {
        setProgress(100);
        setProgressStage(t("complete", language));
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if clarification is needed
        if (data.needsClarification && !clarificationAnswer) {
          logEvent('clarification_shown', { material: data.clarificationQuestion });
          setResult(data);
          setShowClarificationDialog(true);
        } else {
          // Look up instructions from trashCategoryInfo
          const categoryInfo = trashCategoryInfo[data.category as TrashCategory];
          const finalResult = {
            ...data,
            instructions: data.instructions || categoryInfo.instructionsEn
          };
          setResult(finalResult);
          setShowFeedbackPrompt(true);
          // Note: scan_completed is now logged server-side to prevent duplicate counting
          // Also log guidance_shown for impact reporting
          logEvent('guidance_shown', {
            category: data.category,
            itemName: data.itemName,
            confidence: data.confidence,
          });
          // Refetch user stats after successful scan
          setTimeout(() => refetchStats(), 500);
        }
      }
    } catch (error) {
      console.error("Error identifying trash:", error);
      
      // For clarification retries, attempt one retry before showing error
      if (clarificationAnswer && !retried) {
        console.log("Clarification call failed, retrying once...");
        try {
          setProgress(20);
          const retryResponse = await apiRequest("POST", "/api/identify-trash", {
            image: imageData,
            demoMode,
            language,
            clarificationAnswer,
            anonymousUserId,
            scanId: crypto.randomUUID(),
            ...locationData
          });
          const retryData = await retryResponse.json();
          setProgress(100);
          setProgressStage(t("complete", language));
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const retryCategoryInfo = trashCategoryInfo[retryData.category as TrashCategory];
          const retryResult = {
            ...retryData,
            instructions: retryData.instructions || (retryCategoryInfo ? retryCategoryInfo.instructionsEn : "")
          };
          setResult(retryResult);
          setShowFeedbackPrompt(true);
          logEvent('guidance_shown', {
            category: retryData.category,
            itemName: retryData.itemName,
            confidence: retryData.confidence,
          });
          setTimeout(() => refetchStats(), 500);
          return;
        } catch (retryError) {
          console.error("Clarification retry also failed:", retryError);
        }
      }
      
      const isRateLimited = error instanceof Error && error.message.startsWith("429");
      toast({
        title: t("error", language),
        description: isRateLimited ? t("rateLimited", language) : t("failedToIdentify", language),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleClarificationAnswer = async (answer: boolean) => {
    setShowClarificationDialog(false);
    if (!storedImageData || !result?.clarificationQuestion) {
      console.warn("Clarification answer skipped: missing storedImageData or clarificationQuestion", {
        hasStoredImage: !!storedImageData,
        hasClarificationQ: !!result?.clarificationQuestion,
      });
      return;
    }
    
    // Store the question before clearing state
    const clarificationQuestion = result.clarificationQuestion;
    
    // Reset UI state to show processing state
    setResult(null);
    setProgress(0);
    
    // Resend the image with the clarification answer
    await handleImageCapture(storedImageData, {
      question: clarificationQuestion,
      answer
    });
  };

  // Handle saving user name with sanitization
  const handleSaveName = () => {
    // Sanitize: remove HTML tags, limit to safe characters
    const sanitized = tempName
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>"/\\`]/g, '') // Remove potentially dangerous characters
      .substring(0, 30); // Limit length
    
    // Validate: name must not be empty after sanitization
    if (sanitized.length === 0) {
      toast({
        title: t("invalidName", language),
        description: t("nameCannotBeEmpty", language),
        variant: "destructive",
      });
      return;
    }
    
    setUserName(sanitized);
    localStorage.setItem('gomiSnapUserName', sanitized);
    setIsEditingName(false);
  };

  const handleEditName = () => {
    setTempName(userName);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setTempName('');
    setIsEditingName(false);
  };

  const handleScheduleClick = () => {
    window.open("https://www.city.beppu.oita.jp/sisetsu/gomi/", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-50/30 dark:to-emerald-950/10 flex flex-col">
      {/* Location Consent Modal */}
      <Dialog open={showLocationConsent} onOpenChange={setShowLocationConsent}>
        <DialogContent className="max-w-md" data-testid="dialog-location-consent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t("helpUsImproveTitle", language)}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm leading-relaxed">
                <p>
                  {t("locationConsentMessage", language)}
                </p>
                <p>
                  {t("locationConsentBenefit", language)}
                </p>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-medium">
                    {t("whatWeCollect", language)}
                  </p>
                  <ul className="text-xs space-y-1 mt-1 text-muted-foreground">
                    <li>✓ {t("collectCityName", language)}</li>
                    <li>✓ {t("collectScanTimestamp", language)}</li>
                    <li>✓ {t("collectWasteCategories", language)}</li>
                  </ul>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleLocationConsent(false)}
              data-testid="button-location-deny"
            >
              {t("noThanks", language)}
            </Button>
            <Button
              onClick={() => handleLocationConsent(true)}
              data-testid="button-location-allow"
            >
              {t("yesHelpImprove", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Clarification Dialog */}
      <Dialog open={showClarificationDialog} onOpenChange={setShowClarificationDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-clarification">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              {t("quickQuestion", language)}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 text-base leading-relaxed">
                {result?.clarificationQuestion}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleClarificationAnswer(false)}
              data-testid="button-clarification-no"
              className="w-full sm:w-auto"
            >
              {t("no", language)}
            </Button>
            <Button
              onClick={() => handleClarificationAnswer(true)}
              data-testid="button-clarification-yes"
              className="w-full sm:w-auto"
            >
              {t("yes", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disposal Verification Dialog */}
      <Dialog open={showDisposalVerification} onOpenChange={setShowDisposalVerification}>
        <DialogContent className="max-w-sm" data-testid="dialog-disposal-verification">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              {t("disposalQuestion", language)}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 text-sm text-muted-foreground">
                {t("disposalDescription", language)}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleDisposalVerification(false)}
              data-testid="button-disposal-not-yet"
              className="w-full sm:w-auto"
            >
              {t("notYet", language)}
            </Button>
            <Button
              onClick={() => handleDisposalVerification(true)}
              data-testid="button-disposal-yes"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            >
              {t("yesDisposed", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Satisfaction Rating Dialog */}
      <Dialog open={showSatisfactionRating} onOpenChange={setShowSatisfactionRating}>
        <DialogContent className="max-w-sm" data-testid="dialog-satisfaction-rating">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center text-lg">
              {t("wasThisHelpfulShort", language)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-6 py-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSatisfactionRating(false)}
              data-testid="button-satisfaction-no"
              className="flex flex-col items-center gap-2 h-auto py-4 px-6 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/20"
            >
              <ThumbsDown className="h-8 w-8 text-red-500" />
              <span className="text-sm">{t("no", language)}</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSatisfactionRating(true)}
              data-testid="button-satisfaction-yes"
              className="flex flex-col items-center gap-2 h-auto py-4 px-6 hover:bg-emerald-50 hover:border-emerald-200 dark:hover:bg-emerald-950/20"
            >
              <ThumbsUp className="h-8 w-8 text-emerald-500" />
              <span className="text-sm">{t("yes", language)}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hero Header with Large Logo */}
      <header className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 dark:from-emerald-950 dark:via-emerald-900 dark:to-teal-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-400/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 right-10 w-24 h-24 bg-teal-400/10 rounded-full blur-2xl animate-pulse delay-700" />
        
        <div className="relative z-10 max-w-md mx-auto px-6 pt-6 pb-8">
          {/* Top bar with utility buttons */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {pilotLocationId && (
                <Badge className="gap-1 text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm" data-testid="badge-pilot-location">
                  <MapPin className="h-3 w-3" />
                  {PILOT_LOCATION_NAMES[pilotLocationId]?.[language] || pilotLocationId}
                </Badge>
              )}
              {demoMode && (
                <Badge className="gap-1 text-xs bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <TestTube className="h-3 w-3" />
                  {t("demo", language)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/3d">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-white/80 hover:text-white hover:bg-white/10 text-xs px-3"
                  data-testid="button-landing"
                >
                  {t("aboutUs", language)}
                </Button>
              </Link>
              <FeedbackDialog language={language} />
              {import.meta.env.DEV && (
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-white/80 hover:text-white hover:bg-white/10"
                    data-testid="button-admin"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleScheduleClick}
                className="rounded-full text-white/80 hover:text-white hover:bg-white/10"
                data-testid="button-schedule-header"
              >
                <Calendar className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-white/80 hover:text-white hover:bg-white/10"
                    data-testid="button-language"
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Globe className="h-4 w-4" />
                      <span className="text-[9px] font-bold">{language.toUpperCase()}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" data-testid="dropdown-language">
                  {(Object.keys(LANGUAGE_NAMES) as Language[]).map((lang) => (
                    <DropdownMenuItem
                      key={lang}
                      onClick={() => {
                        if (lang !== language) {
                          logEvent('language_selected', { language: lang, previousLanguage: language });
                        }
                        setLanguage(lang);
                      }}
                      className={language === lang ? "bg-accent" : ""}
                      data-testid={`lang-option-${lang}`}
                    >
                      <span className="mr-2 font-mono text-xs font-bold text-muted-foreground">{LANGUAGE_CODES[lang]}</span>
                      {LANGUAGE_NAMES[lang]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Large centered logo with dark background */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {/* Green glow shadow behind */}
              <div className="absolute -inset-6 bg-emerald-400/30 rounded-full blur-3xl" />
              <img 
                src={logoImage} 
                alt="GOMI SNAP" 
                className="relative h-48 w-auto"
                data-testid="img-logo"
              />
            </div>
            <p className="mt-2 text-lg font-bold text-white tracking-widest uppercase">
              {t("appSlogan", language)}
            </p>
            {/* Welcome back message for returning users */}
            {userName && (
              <p className="mt-3 text-base text-white/90 animate-fade-in" data-testid="text-welcome-back">
                {t("welcomeBack", language)}, <span className="font-semibold">{userName}</span>!
              </p>
            )}
          </div>
        </div>
      </header>
      
      {/* Pilot Mode Banner */}
      {pilotLocationId && (
        <div className="bg-primary text-primary-foreground" data-testid="banner-pilot">
          <div className="max-w-md mx-auto px-6 py-3 text-center">
            <p className="font-semibold text-sm">
              {PILOT_CONFIG.title[language]}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              {PILOT_CONFIG.subtitle[language]}
            </p>
          </div>
        </div>
      )}
      
      <main className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto px-6 py-6 space-y-6">
          {/* Alarm & Stats Row */}
          <div className="flex gap-3 items-stretch flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <AlarmSettings language={language} />
            </div>
            
            {/* Big Stats Button with Octopus Mascot */}
            <Sheet open={statsSheetOpen} onOpenChange={setStatsSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-auto flex flex-col items-center justify-center py-3 px-4 rounded-2xl bg-gradient-to-br from-teal-400 via-emerald-500 to-green-600 shadow-lg min-w-[100px] border-2 border-white/20"
                  data-testid="button-stats"
                >
                  {/* Octopus Mascot */}
                  <div className="relative">
                    <svg width="48" height="48" viewBox="0 0 64 64" className="drop-shadow-md">
                      {/* Octopus body */}
                      <ellipse cx="32" cy="24" rx="20" ry="18" fill="#7DD3FC" stroke="#0EA5E9" strokeWidth="2"/>
                      {/* Eyes */}
                      <circle cx="25" cy="22" r="5" fill="white"/>
                      <circle cx="39" cy="22" r="5" fill="white"/>
                      <circle cx="26" cy="23" r="2.5" fill="#1E293B"/>
                      <circle cx="40" cy="23" r="2.5" fill="#1E293B"/>
                      {/* Eye sparkles */}
                      <circle cx="24" cy="21" r="1" fill="white"/>
                      <circle cx="38" cy="21" r="1" fill="white"/>
                      {/* Smile */}
                      <path d="M 26 30 Q 32 35 38 30" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round"/>
                      {/* Tentacles */}
                      <path d="M 14 36 Q 10 44 14 50" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M 20 38 Q 16 48 20 54" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M 28 40 Q 26 50 30 56" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M 36 40 Q 38 50 34 56" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M 44 38 Q 48 48 44 54" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      <path d="M 50 36 Q 54 44 50 50" fill="none" stroke="#7DD3FC" strokeWidth="4" strokeLinecap="round"/>
                      {/* Tentacle tips */}
                      <circle cx="14" cy="50" r="3" fill="#38BDF8"/>
                      <circle cx="20" cy="54" r="3" fill="#38BDF8"/>
                      <circle cx="30" cy="56" r="3" fill="#38BDF8"/>
                      <circle cx="34" cy="56" r="3" fill="#38BDF8"/>
                      <circle cx="44" cy="54" r="3" fill="#38BDF8"/>
                      <circle cx="50" cy="50" r="3" fill="#38BDF8"/>
                    </svg>
                    {/* Streak flame badge */}
                    {(userStats?.currentStreak ?? 0) > 0 && (
                      <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow-md border border-orange-300">
                        <Flame className="h-3 w-3" />
                        <span>{userStats?.currentStreak}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-white font-bold text-sm mt-1 drop-shadow-sm">
                    {t("stats", language)}
                  </span>
                  {userStats && userStats.todayCount > 0 && (
                    <span className="text-white/90 text-[10px] font-medium">
                      {t("todayShort", language)}: {userStats.todayCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80" data-testid="sheet-stats">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    {t("yourStats", language)}
                  </SheetTitle>
                  <SheetDescription>
                    {t("trackYourProgress", language)}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Today's Count */}
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 text-center" data-testid="section-today-stats">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {t("todayScans", language)}
                    </p>
                    <p className="text-5xl font-bold text-primary" data-testid="text-today-count">
                      {userStats?.todayCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("resetsAt", language)}
                    </p>
                  </div>

                  {/* Streak Section */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-orange-500/10 rounded-xl p-3 text-center" data-testid="section-current-streak">
                      <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                      <p className="text-2xl font-bold text-orange-500" data-testid="text-current-streak">
                        {userStats?.currentStreak ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {t("currentStreak", language)}
                      </p>
                    </div>
                    <div className="flex-1 bg-amber-500/10 rounded-xl p-3 text-center" data-testid="section-longest-streak">
                      <Award className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                      <p className="text-2xl font-bold text-amber-500" data-testid="text-longest-streak">
                        {userStats?.longestStreak ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {t("longestStreak", language)}
                      </p>
                    </div>
                  </div>

                  {/* Weekly Breakdown */}
                  <div data-testid="section-weekly-breakdown">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                      {t("last7Days", language)}
                    </p>
                    <div className="flex gap-1 items-end h-24">
                      {userStats?.weeklyBreakdown?.map((day, idx) => {
                        const maxCount = Math.max(...(userStats.weeklyBreakdown?.map(d => d.count) || [1]), 1);
                        const heightPercent = Math.max((day.count / maxCount) * 100, 8);
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                            <div 
                              className={`w-full rounded-t-sm transition-all ${day.count > 0 ? 'bg-primary' : 'bg-muted'}`}
                              style={{ height: `${heightPercent}%` }}
                              data-testid={`bar-day-${idx}`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {day.dayName.slice(0, 1)}
                            </span>
                            <span className="text-[9px] font-medium">
                              {day.count}
                            </span>
                          </div>
                        );
                      }) || Array(7).fill(null).map((_, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full h-2 bg-muted rounded-t-sm" />
                          <span className="text-[10px] text-muted-foreground">-</span>
                          <span className="text-[9px] font-medium">0</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total Stats */}
                  <div className="flex gap-3 text-center" data-testid="section-total-stats">
                    <div className="flex-1 bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold" data-testid="text-total-scans">
                        {userStats?.totalScans ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {t("totalScans", language)}
                      </p>
                    </div>
                    <div className="flex-1 bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold" data-testid="text-active-days">
                        {userStats?.totalActiveDays ?? 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {t("activeDays", language)}
                      </p>
                    </div>
                  </div>

                  {/* Name Input Section */}
                  <div className="border-t pt-4" data-testid="section-name-input">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {t("personalizeExperience", language)}
                      </p>
                    </div>
                    
                    {isEditingName ? (
                      <div className="space-y-2">
                        <Input
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          placeholder={t("enterYourName", language)}
                          className="text-sm"
                          maxLength={30}
                          data-testid="input-name"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveName}
                            className="flex-1"
                            data-testid="button-save-name"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {t("saveNameBtn", language)}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEditName}
                            className="flex-1"
                            data-testid="button-cancel-name"
                          >
                            <X className="h-3 w-3 mr-1" />
                            {t("cancelBtn", language)}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        {userName ? (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">
                                  {userName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium" data-testid="text-user-name">{userName}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleEditName}
                              data-testid="button-edit-name"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              {t("editNameBtn", language)}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEditName}
                            className="w-full"
                            data-testid="button-add-name"
                          >
                            <User className="h-3 w-3 mr-1" />
                            {t("addNameBtn", language)}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* How to Use Section */}
          {!result && !isProcessing && (
            <Collapsible open={showHowToUse} onOpenChange={setShowHowToUse}>
              <div className="glass-card p-4 rounded-2xl" data-testid="section-how-to-use">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">
                        {t("howToUse", language)}
                      </span>
                    </div>
                    {showHowToUse ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-primary">1</span>
                      <p className="text-muted-foreground pt-0.5">
                        {t("step1", language)}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-primary">2</span>
                      <p className="text-muted-foreground pt-0.5">
                        {t("step2", language)}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-primary">3</span>
                      <p className="text-muted-foreground pt-0.5">
                        {t("step3", language)}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
          
          {!result && !isProcessing && (
            <div className="glass-card p-5 rounded-3xl shadow-lg" data-testid="panel-common-items">
              <h3 className="font-semibold text-sm text-muted-foreground mb-4">
                {t("commonItemsQuickSelect", language)}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {commonItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSelect(item)}
                    className="text-left p-3 rounded-xl bg-background/50 hover:bg-accent/50 border border-border/50 hover:border-accent transition-smooth text-sm hover-elevate active-elevate-2"
                    data-testid={`quick-item-${index}`}
                  >
                    <span className="font-medium">{item.name[language]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="glass-card p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-4" data-testid="container-progress">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg text-primary font-bold">
                    {progressStage}
                  </h3>
                  <Badge variant="secondary" className="text-base font-bold tabular-nums">
                    {progress}%
                  </Badge>
                </div>
                <Progress value={progress} className="h-3" data-testid="progress-bar" />
                <p className="text-sm text-muted-foreground text-center">
                  {t("analyzingWithAI", language)}
                </p>
              </div>
            </div>
          )}
          
          {/* Get Started Prompt for First-Time Users */}
          {!result && !isProcessing && userStats && userStats.totalScans === 0 && (
            <div className="glass-card p-6 rounded-3xl shadow-xl mb-6 animate-in fade-in slide-in-from-top-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200/50 dark:border-emerald-700/50" data-testid="card-get-started">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg flex-shrink-0">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-200">
                    {language === 'ja' ? 'ようこそ！最初のスキャンを試してみましょう' :
                     language === 'zh' ? '欢迎！试试您的第一次扫描' :
                     language === 'ko' ? '환영합니다! 첫 스캔을 시도해보세요' :
                     'Welcome! Try your first scan'}
                  </h3>
                  <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    {language === 'ja' ? 'カメラボタンをタップして、ゴミの写真を撮りましょう。AIが正しい分別方法をお教えします。' :
                     language === 'zh' ? '点击相机按钮拍摄垃圾照片，AI会告诉您正确的分类方法。' :
                     language === 'ko' ? '카메라 버튼을 탭하여 쓰레기 사진을 찍으세요. AI가 올바른 분류 방법을 알려드립니다.' :
                     'Tap the camera button to take a photo of any trash item. Our AI will tell you exactly how to sort it.'}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {language === 'ja' ? '5秒以内で結果が出ます' :
                       language === 'zh' ? '5秒内获得结果' :
                       language === 'ko' ? '5초 이내에 결과 확인' :
                       'Results in under 5 seconds'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!result && (
            <CameraCapture
              onCapture={handleImageCapture}
              isProcessing={isProcessing}
              language={language}
              progress={progress}
            />
          )}

          {result && (
            <div className="space-y-6 relative">
              {/* Large Home Button - Fixed Top Right */}
              <Button
                onClick={handleClearResult}
                size="lg"
                className="fixed top-4 right-4 z-50 rounded-full shadow-2xl bg-white text-emerald-800 hover:bg-emerald-50 border-2 border-emerald-200 h-14 w-14 p-0"
                data-testid="button-home"
                aria-label="Return home"
              >
                <HomeIcon className="h-7 w-7" />
              </Button>
              
              <TrashResult
                itemName={result.itemName}
                category={result.category}
                instructions={result.instructions || ''}
                confidence={result.confidence}
                language={language}
                capInstructions={result.capInstructions}
                partInstructions={result.partInstructions}
                rejectionReason={result.rejectionReason}
              />
              
              {/* Post-scan Feedback Prompt */}
              {showFeedbackPrompt && (
                <div className="glass-card p-4 rounded-2xl animate-in fade-in slide-in-from-bottom-2" data-testid="feedback-prompt">
                  <p className="text-sm font-medium text-center mb-3">
                    {t("wasThisHelpful", language)}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFeedback(true)}
                      className="rounded-xl"
                      data-testid="button-feedback-yes"
                    >
                      {t("yes", language)}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFeedback(false)}
                      className="rounded-xl"
                      data-testid="button-feedback-no"
                    >
                      {t("no", language)}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleFeedback(null)}
                      className="rounded-xl text-muted-foreground"
                      data-testid="button-feedback-skip"
                    >
                      {t("notSure", language)}
                    </Button>
                  </div>
                </div>
              )}
              
              <Collapsible open={showWhyExplanation} onOpenChange={handleWhyExplanationToggle}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full rounded-2xl shadow-md hover:shadow-lg transition-smooth"
                    data-testid="button-why-explanation"
                  >
                    <HelpCircle className="h-5 w-5 mr-2" />
                    {t("whyThisSorting", language)}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="glass-card p-5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2" data-testid="explanation-content">
                    {whyExplanation ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line">{whyExplanation}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("loadingExplanation", language)}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleClearResult}
                variant="outline"
                size="lg"
                className="w-full rounded-2xl shadow-md hover:shadow-lg transition-smooth"
                data-testid="button-take-another"
              >
                <Camera className="h-5 w-5 mr-2" />
                {t("scanAnother", language)}
              </Button>
            </div>
          )}

          {!result && !isProcessing && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 mb-4">
                <Sparkles className="h-8 w-8 text-primary dark:text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {t("takePhotoToIdentify", language)}
              </p>
            </div>
          )}
          
          {/* Privacy & Version Footer */}
          <footer className="text-center py-4 text-xs text-muted-foreground space-y-1" data-testid="footer-privacy">
            <p>
              {t("dataAnonymous", language)}
            </p>
            <p className="opacity-70">GOMI SNAP v1.0 • {t("beppuCityRules", language)}</p>
          </footer>
        </div>
      </main>
      
      {/* Debug Mode Panel */}
      {debugMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50" data-testid="debug-panel">
          <div className="max-w-md mx-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDebugPanelOpen(!debugPanelOpen)}
              className="w-full rounded-none rounded-t-lg bg-gray-900 text-white hover:bg-gray-800 gap-2"
            >
              <Bug className="h-4 w-4" />
              Debug Panel
              {debugPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            
            {debugPanelOpen && (
              <div className="bg-gray-900 text-white p-4 text-xs font-mono max-h-64 overflow-auto">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <span className="text-gray-400">user_id:</span>
                    <span className="ml-1 text-green-400">{anonymousUserId.slice(0, 20)}...</span>
                  </div>
                  <div>
                    <span className="text-gray-400">session:</span>
                    <span className="ml-1 text-blue-400">{sessionId.slice(0, 18)}...</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">pilot_loc:</span>
                    <span className="ml-1 text-yellow-400">{pilotLocationId || 'none'}</span>
                  </div>
                </div>
                
                <div className="border-t border-gray-700 pt-2">
                  <p className="text-gray-400 mb-2">Recent Events ({debugEvents.length}/10):</p>
                  {debugEvents.length === 0 ? (
                    <p className="text-gray-500 italic">No events yet</p>
                  ) : (
                    <div className="space-y-1">
                      {debugEvents.map((event, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-gray-500">{event.timestamp}</span>
                          <span className="text-emerald-400">{event.eventName}</span>
                          {event.payload && (
                            <span className="text-gray-600 truncate">{event.payload}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

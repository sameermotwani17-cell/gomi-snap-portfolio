import { useState, useEffect, useRef, ReactNode, createContext, useContext } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Camera, ArrowRight, Mail, ChevronDown, Scan, Database, BarChart3, Shield, Cpu, MapPin, Check, Minus, Zap, Globe2, Calendar, Trophy } from 'lucide-react';
import { Link } from 'wouter';
import { t, Language, LANGUAGE_NAMES } from '@/lib/translations';

const logoImage = '/gomisnap-logo.png';

import sameerPhoto from '@assets/WhatsApp_Image_2025-12-25_at_11.17.34_1766669715530.jpeg';
import ellyPhoto from '@assets/WhatsApp_Image_2025-12-25_at_11.16.59_1766669721261.jpeg';
import momokaPhoto from '@assets/WhatsApp_Image_2025-12-25_at_11.16.29_1766669728891.jpeg';
import makaremPhoto from '@assets/image_1768387158661.png';
import samiPhoto from '@assets/IMG_6419_1766838394572.jpg';
import raniaPhoto from '@assets/WhatsApp_Image_2025-12-27_at_14.13.08_1766838401739.jpeg';
import hultTeamPhoto1 from '@assets/WhatsApp_Image_2026-01-11_at_06.16.25_1768387516655.jpeg';
import hultTeamPhoto2 from '@assets/WhatsApp_Image_2026-01-08_at_08.57.52_1768387525144.jpeg';

const LanguageContext = createContext<{ language: Language; setLanguage: (l: Language) => void }>({ language: 'en', setLanguage: () => {} });

function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('gomiSnapLanguage');
    return (stored && ['en', 'ja', 'zh', 'my', 'ko', 'id'].includes(stored)) ? stored as Language : 'en';
  });

  useEffect(() => {
    localStorage.setItem('gomiSnapLanguage', language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

function useLanguage() {
  return useContext(LanguageContext);
}

function PageViewTracker() {
  useEffect(() => {
    const trackPageView = async () => {
      try {
        let userId = localStorage.getItem('gomiSnapUserId');
        if (!userId) {
          userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          localStorage.setItem('gomiSnapUserId', userId);
        }
        let sessionId = sessionStorage.getItem('gomiSnapSessionId');
        if (!sessionId) {
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          sessionStorage.setItem('gomiSnapSessionId', sessionId);
        }
        const DEBOUNCE_MS = 30000;
        const now = Date.now();
        const lastLandingViewed = sessionStorage.getItem('lastLandingViewedAt');
        if (lastLandingViewed && now - parseInt(lastLandingViewed, 10) < DEBOUNCE_MS) {
          return;
        }
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName: 'page_viewed',
            anonymousUserId: userId,
            sessionId: sessionId,
            namespace: 'website',
            payload: { page: 'landing', referrer: document.referrer || null }
          })
        });
        sessionStorage.setItem('lastLandingViewedAt', now.toString());
      } catch (error) {
        console.error('Failed to track page view:', error);
      }
    };
    trackPageView();
  }, []);
  return null;
}

function FadeIn({ children, className = '', delay = 0, direction = 'up' }: { children: ReactNode; className?: string; delay?: number; direction?: 'up' | 'down' | 'left' | 'right' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const dirMap = { up: { y: 40 }, down: { y: -40 }, left: { x: 40 }, right: { x: -40 } };
  const initial = { opacity: 0, ...dirMap[direction] };
  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : initial}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}


function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" data-testid="language-switcher">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-white/50 hover:text-white/80 transition-colors border border-white/[0.08]"
        data-testid="button-language-toggle"
      >
        <Globe2 className="w-3.5 h-3.5" />
        {LANGUAGE_NAMES[language]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#1a1d23] border border-white/[0.08] rounded-md overflow-hidden z-50 min-w-[140px]">
          {(Object.keys(LANGUAGE_NAMES) as Language[]).map((code) => (
            <button
              key={code}
              onClick={() => { setLanguage(code); setOpen(false); }}
              className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                code === language ? 'text-[#4ADE80] bg-white/[0.04]' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
              data-testid={`lang-option-${code}`}
            >
              {LANGUAGE_NAMES[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { language } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0F1115]/90 backdrop-blur-md border-b border-white/[0.06]' : ''}`}
      data-testid="navbar"
    >
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="GOMI SNAP" className="w-8 h-8 object-contain" data-testid="img-logo" />
          <span className="text-[#F5F5F5] font-semibold text-lg tracking-tight" data-testid="text-brand">GOMI SNAP</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollToSection('product')} className="text-sm text-white/50 hover:text-white/90 transition-colors" data-testid="nav-product">{t('landingProduct', language)}</button>
          <button onClick={() => scrollToSection('intelligence')} className="text-sm text-white/50 hover:text-white/90 transition-colors" data-testid="nav-intelligence">{t('landingIntelligence', language)}</button>
          <button onClick={() => scrollToSection('impact')} className="text-sm text-white/50 hover:text-white/90 transition-colors" data-testid="nav-impact">{t('landingImpact', language)}</button>
          <button onClick={() => scrollToSection('team')} className="text-sm text-white/50 hover:text-white/90 transition-colors" data-testid="nav-team">{t('landingTeam', language)}</button>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/">
            <Button variant="ghost" className="text-sm text-white/60" data-testid="nav-demo">
              {t('landingLiveDemo', language)}
            </Button>
          </Link>
          <a href="mailto:gomisnap@gmail.com">
            <Button className="text-sm bg-[#214C34] text-white border border-[#2a6344]" data-testid="nav-contact">
              {t('landingRequestPilot', language)}
            </Button>
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

function HeroSection() {
  const { language } = useLanguage();
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden" data-testid="hero-section">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full bg-[#214C34]/20 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#214C34]/10 blur-[100px]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 md:px-12 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <FadeIn delay={0.1}>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold text-[#F5F5F5] leading-[0.95] tracking-tight mb-6">
                {t('landingHeroTitle1', language)}{' '}
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #4ADE80, #214C34)' }}>
                  {t('landingHeroTitle2', language)}
                </span>
              </h1>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-lg md:text-xl text-white/50 max-w-lg mb-10 leading-relaxed" data-testid="text-hero-subtitle">
                {t('landingHeroSubtitle', language)}
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="flex flex-wrap gap-4">
                <a href="mailto:gomisnap@gmail.com">
                  <Button size="lg" className="bg-[#214C34] text-white border border-[#2a6344]" data-testid="hero-request-pilot">
                    {t('landingRequestPilot', language)}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                <Link href="/">
                  <Button variant="outline" size="lg" className="border-white/[0.12] text-white/70" data-testid="hero-demo">
                    {t('landingViewDemo', language)}
                  </Button>
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={0.4}>
              <div className="flex items-center gap-6 mt-12 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                  <span className="text-xs text-white/40" data-testid="text-live-beppu">{t('landingLiveBeppu', language)}</span>
                </div>
                <span className="text-xs text-white/30" data-testid="text-languages">{t('landingSixLanguages', language)}</span>
                <span className="text-xs text-white/30" data-testid="text-no-login">{t('landingNoLogin', language)}</span>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.3} direction="right">
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <div className="absolute -inset-8 bg-[#214C34]/10 rounded-3xl blur-2xl" />
                <img
                  src="/images/phone-mockup.png"
                  alt="GOMI SNAP scanning interface"
                  className="relative w-[280px] md:w-[320px] rounded-2xl"
                  data-testid="hero-phone-mockup"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <ChevronDown className="w-5 h-5 text-white/20" />
      </motion.div>
    </section>
  );
}

function ProductSection() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    {
      labelKey: 'landingScanFlow',
      icon: Scan,
      titleKey: 'landingScanFlowTitle',
      descKey: 'landingScanFlowDesc',
      visual: '/images/phone-mockup.png',
      isPhone: true,
    },
    {
      labelKey: 'landingRuleEngine',
      icon: Database,
      titleKey: 'landingRuleEngineTitle',
      descKey: 'landingRuleEngineDesc',
      visual: '/images/dashboard-mockup.png',
      isPhone: false,
    },
    {
      labelKey: 'landingCityDashboard',
      icon: BarChart3,
      titleKey: 'landingDashboardTitle',
      descKey: 'landingDashboardDesc',
      visual: '/images/dashboard-mockup.png',
      isPhone: false,
    },
  ];

  return (
    <section id="product" className="py-32 px-6 md:px-12 relative" data-testid="product-section">
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4" data-testid="text-product-title">
            {t('landingProductTitle', language)}
          </h2>
          <p className="text-lg text-white/40 max-w-xl mb-16" data-testid="text-product-subtitle">
            {t('landingProductSubtitle', language)}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="flex gap-2 mb-12 flex-wrap">
            {tabs.map((tab, i) => (
              <button
                key={tab.labelKey}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === i
                    ? 'bg-[#214C34] text-white border border-[#2a6344]'
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}
                data-testid={`tab-${tab.labelKey}`}
              >
                <tab.icon className="w-4 h-4" />
                {t(tab.labelKey, language)}
              </button>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <GlassCard className="p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-[#F5F5F5] mb-4" data-testid="text-product-tab-title">
                  {t(tabs[activeTab].titleKey, language)}
                </h3>
                <p className="text-white/50 leading-relaxed text-lg" data-testid="text-product-tab-desc">
                  {t(tabs[activeTab].descKey, language)}
                </p>
              </div>
              <div className="flex justify-center">
                {tabs[activeTab].isPhone ? (
                  <img src={tabs[activeTab].visual} alt={t(tabs[activeTab].titleKey, language)} className="w-[240px] rounded-2xl" data-testid="product-visual" />
                ) : (
                  <img src={tabs[activeTab].visual} alt={t(tabs[activeTab].titleKey, language)} className="w-full max-w-lg rounded-md border border-white/[0.06]" data-testid="product-visual" />
                )}
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="text-xs text-white/25 mt-6 text-center italic" data-testid="text-trust-statement">
            {t('landingTrustStatement', language)}
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

function ProblemSection() {
  const { language } = useLanguage();
  const chainSteps = [
    { key: 'landingProblemWrongSorting' },
    { key: 'landingProblemContamination' },
    { key: 'landingProblemResorting' },
    { key: 'landingProblemIncineration' },
  ];

  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="problem-section">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
      <div className="max-w-[1440px] mx-auto relative z-10">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4 max-w-3xl" data-testid="text-problem-title">
            {t('landingProblemTitle', language)}
          </h2>
          <p className="text-lg text-white/40 max-w-xl mb-20" data-testid="text-problem-subtitle">
            {t('landingProblemSubtitle', language)}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlassCard className="p-8 md:p-12">
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              {chainSteps.map((step, i) => (
                <div key={step.key} className="flex items-center gap-3 md:gap-4">
                  <div className="px-5 py-3 rounded-md border border-white/[0.08] bg-white/[0.04]">
                    <span className="text-sm md:text-base font-semibold text-[#F5F5F5]">{t(step.key, language)}</span>
                  </div>
                  {i < chainSteps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-[#4ADE80]/50 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-white/35 mt-8 max-w-xl mx-auto leading-relaxed">
              {t('landingProblemContaminationDesc', language)}
            </p>
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  );
}

function IntelligenceSection() {
  const { language } = useLanguage();
  const items = [
    { labelKey: 'landingScanHeatmap', descKey: 'landingScanHeatmapDesc' },
    { labelKey: 'landingCostTracker', descKey: 'landingCostTrackerDesc' },
    { labelKey: 'landingMisSortTrends', descKey: 'landingMisSortTrendsDesc' },
    { labelKey: 'landingComplianceScore', descKey: 'landingComplianceScoreDesc' },
  ];

  return (
    <section id="intelligence" className="py-32 px-6 md:px-12 relative" data-testid="intelligence-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <FadeIn>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-6" data-testid="text-intel-title">
                {t('landingIntelTitle', language)}
              </h2>
              <p className="text-lg text-white/40 leading-relaxed mb-10" data-testid="text-intel-subtitle">
                {t('landingIntelSubtitle', language)}
              </p>
            </FadeIn>

            <div className="grid grid-cols-2 gap-4">
              {items.map((item, i) => (
                <FadeIn key={item.labelKey} delay={i * 0.1}>
                  <div className="p-4 rounded-md border border-white/[0.06] bg-white/[0.02]">
                    <div className="text-sm font-semibold text-[#F5F5F5] mb-1">{t(item.labelKey, language)}</div>
                    <div className="text-xs text-white/35">{t(item.descKey, language)}</div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          <FadeIn delay={0.2} direction="right">
            <div className="relative">
              <div className="absolute -inset-4 rounded-xl blur-xl" style={{ background: 'rgba(33, 76, 52, 0.08)' }} />
              <img
                src="/images/dashboard-mockup.png"
                alt={t('landingIntelTitle', language)}
                className="relative w-full rounded-md border border-white/[0.06]"
                data-testid="intelligence-dashboard"
              />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function EconomicImpactSection() {
  const { language } = useLanguage();

  const config = {
    totalWasteTons: 40000,
    costPerTonUSD: 255,
    costPerTonJPY: 40000,
    scenarios: [
      { diversionPct: 5, label: '5%' },
      { diversionPct: 10, label: '10%' },
    ],
  };

  const formatCurrency = (amount: number, lang: string) => {
    if (lang === 'ja') {
      const yenAmount = (amount / config.costPerTonUSD) * config.costPerTonJPY;
      if (yenAmount >= 100000000) return `${(yenAmount / 100000000).toFixed(1)}億円`;
      if (yenAmount >= 10000) return `¥${Math.round(yenAmount / 10000).toLocaleString('ja-JP')}万`;
      return `¥${yenAmount.toLocaleString('ja-JP')}`;
    }
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString('en-US')}`;
  };

  const formatTons = (tons: number, lang: string) => {
    if (lang === 'ja') return `${tons.toLocaleString('ja-JP')}`;
    return tons.toLocaleString('en-US');
  };

  const formatCostPerTon = (lang: string) => {
    if (lang === 'ja') return `~¥${config.costPerTonJPY.toLocaleString('ja-JP')}`;
    return `~$${config.costPerTonUSD}`;
  };

  return (
    <section id="impact" className="py-32 px-6 md:px-12 relative" data-testid="impact-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4" data-testid="text-economic-title">
              {t('landingEconomicTitle', language)}
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto" data-testid="text-economic-subtitle">
              {t('landingEconomicSubtitle', language)}
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {config.scenarios.map((scenario, idx) => {
            const tonnsDiverted = config.totalWasteTons * (scenario.diversionPct / 100);
            const savingsUSD = tonnsDiverted * config.costPerTonUSD;
            const isProjected = idx === 1;

            return (
              <FadeIn key={scenario.diversionPct} delay={0.1 + idx * 0.1}>
                <GlassCard className="p-10 text-center relative overflow-visible">
                  {isProjected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#214C34] border border-[#2a6344] rounded-md text-xs font-semibold text-[#4ADE80]">
                      {t('landingProjected', language)}
                    </div>
                  )}
                  <div className="text-sm text-white/40 uppercase tracking-wider mb-4">
                    {scenario.label} {t('landingDiversion', language)}
                  </div>
                  <div className="text-5xl md:text-6xl font-bold text-[#F5F5F5] mb-2" data-testid={`text-savings-${scenario.diversionPct}`}>
                    {formatCurrency(savingsUSD, language)}
                  </div>
                  <div className="text-lg text-[#4ADE80]/70 font-medium mb-6">
                    {t('landingPerYear', language)}
                  </div>

                  <div className="border-t border-white/[0.06] pt-5 mt-2">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-semibold">
                      {t('landingMathBreakdown', language)}
                    </div>
                    <div className="space-y-1.5 text-xs text-white/35">
                      <div>{formatTons(config.totalWasteTons, language)} {t('landingTotalWaste', language)}</div>
                      <div>&times; {scenario.label} = {formatTons(tonnsDiverted, language)} {t('landingTonsAvoided', language)}</div>
                      <div>{formatTons(tonnsDiverted, language)} &times; {formatCostPerTon(language)} {t('landingCostPerTon', language)}</div>
                      <div className="text-[#4ADE80]/50 font-medium pt-1">= {formatCurrency(savingsUSD, language)}</div>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={0.3}>
          <div className="mt-12 text-center">
            <p className="text-xs text-white/25 max-w-lg mx-auto" data-testid="text-economic-disclaimer">
              {t('landingEconomicDisclaimer', language)}
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function DifferentiationSection() {
  const { language } = useLanguage();
  const rowKeys = [
    'landingDiffRow1',
    'landingDiffRow2',
    'landingDiffRow3',
    'landingDiffRow4',
    'landingDiffRow5',
  ];

  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="differentiation-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4" data-testid="text-diff-title">
            {t('landingDiffTitle', language)}
          </h2>
          <p className="text-lg text-white/40 max-w-xl mb-16" data-testid="text-diff-subtitle">
            {t('landingDiffSubtitle', language)}
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlassCard className="overflow-hidden">
            <div className="grid grid-cols-3 border-b border-white/[0.06]">
              <div className="p-5 text-sm font-semibold text-white/30 uppercase tracking-wider">{t('landingCapability', language)}</div>
              <div className="p-5 text-sm font-semibold text-white/30 uppercase tracking-wider text-center">{t('landingGenericApps', language)}</div>
              <div className="p-5 text-sm font-semibold text-[#4ADE80]/60 uppercase tracking-wider text-center">GOMI SNAP</div>
            </div>
            {rowKeys.map((key, i) => (
              <div key={key} className={`grid grid-cols-3 ${i < rowKeys.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                <div className="p-5 text-sm text-white/60">{t(key, language)}</div>
                <div className="p-5 flex justify-center items-center">
                  <Minus className="w-4 h-4 text-white/20" />
                </div>
                <div className="p-5 flex justify-center items-center">
                  <Check className="w-4 h-4 text-[#4ADE80]" />
                </div>
              </div>
            ))}
          </GlassCard>
        </FadeIn>
      </div>
    </section>
  );
}

function PolicySection() {
  const { language } = useLanguage();
  const cards = [
    { icon: Database, labelKey: 'landingDynamicRuleEngine', descKey: 'landingDynamicRuleEngineDesc' },
    { icon: Zap, labelKey: 'landingRealTimePolicySync', descKey: 'landingRealTimePolicySyncDesc' },
    { icon: MapPin, labelKey: 'landingLocationSpecificData', descKey: 'landingLocationSpecificDataDesc' },
  ];

  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="policy-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#F5F5F5] tracking-tight mb-6" data-testid="text-policy-title">
                {t('landingPolicyTitle', language)}
              </h2>
              <p className="text-lg text-white/45 leading-relaxed" data-testid="text-policy-desc">
                {t('landingPolicyDesc', language)}
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2} direction="right">
            <div className="grid gap-4">
              {cards.map((item) => (
                <GlassCard key={item.labelKey} className="p-6 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-[#214C34]/30 border border-[#214C34]/40 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[#4ADE80]/70" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F5F5F5] mb-1">{t(item.labelKey, language)}</div>
                    <div className="text-xs text-white/35">{t(item.descKey, language)}</div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function TechSection() {
  const { language } = useLanguage();
  const cards = [
    { icon: Cpu, titleKey: 'landingAIVision', descKey: 'landingAIVisionDesc' },
    { icon: Database, titleKey: 'landingPropRuleEngine', descKey: 'landingPropRuleEngineDesc' },
    { icon: MapPin, titleKey: 'landingLocationLogic', descKey: 'landingLocationLogicDesc' },
    { icon: Shield, titleKey: 'landingPrivacyFirst', descKey: 'landingPrivacyFirstDesc' },
  ];

  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="tech-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4" data-testid="text-tech-title">
              {t('landingTechTitle', language)}
            </h2>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <FadeIn key={card.titleKey} delay={i * 0.1}>
              <GlassCard className="p-8 h-full">
                <div className="w-10 h-10 rounded-md bg-[#214C34]/30 border border-[#214C34]/40 flex items-center justify-center mb-6">
                  <card.icon className="w-5 h-5 text-[#4ADE80]/70" />
                </div>
                <h3 className="text-base font-semibold text-[#F5F5F5] mb-3">{t(card.titleKey, language)}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{t(card.descKey, language)}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function AchievementSection() {
  const { language } = useLanguage();

  return (
    <section className="py-32 px-6 md:px-12 relative overflow-hidden" data-testid="achievement-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-[#214C34]/8 blur-[150px]" />
      </div>

      <div className="max-w-[1440px] mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <FadeIn delay={0.1}>
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-8 h-8 text-[#4ADE80]/80" />
                <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#F5F5F5] tracking-tight" data-testid="text-achievement-title">
                  {t('landingAchievementTitle', language)}
                </h2>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-xl md:text-2xl font-semibold text-white/60 mb-8" data-testid="text-achievement-event">
                {t('landingAchievementEvent', language)}
              </p>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="text-lg text-white/45 leading-relaxed mb-6 max-w-lg" data-testid="text-achievement-desc">
                {t('landingAchievementDesc', language)}
              </p>
            </FadeIn>
            <FadeIn delay={0.25}>
              <p className="text-sm text-white/30 leading-relaxed mb-8 max-w-lg" data-testid="text-achievement-support">
                {t('landingAchievementSupport', language)}
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.08] bg-white/[0.03] text-sm text-white/50" data-testid="pill-date">
                  <Calendar className="w-3.5 h-3.5 text-[#4ADE80]/60" />
                  {t('landingAchievementDate', language)}
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/[0.08] bg-white/[0.03] text-sm text-white/50" data-testid="pill-location">
                  <MapPin className="w-3.5 h-3.5 text-[#4ADE80]/60" />
                  {t('landingAchievementLocation', language)}
                </div>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.2} direction="right">
            <div className="flex flex-col gap-6">
              <div className="relative group">
                <div className="absolute -inset-2 bg-[#214C34]/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={hultTeamPhoto1}
                  alt="GOMI SNAP team at Hult Prize"
                  className="relative w-full rounded-md border border-white/[0.08] transition-transform duration-500 group-hover:scale-[1.01]"
                  data-testid="img-achievement-1"
                />
              </div>
              <div className="relative group">
                <div className="absolute -inset-2 bg-[#214C34]/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={hultTeamPhoto2}
                  alt="GOMI SNAP pitch presentation"
                  className="relative w-full rounded-md border border-white/[0.08] transition-transform duration-500 group-hover:scale-[1.01]"
                  data-testid="img-achievement-2"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function GlobalVisionSection() {
  const { language } = useLanguage();
  const milestones = [
    { yearKey: 'landingYear1', regionKey: 'landingYear1Region', descKey: 'landingYear1Desc', active: true },
    { yearKey: 'landingYear2', regionKey: 'landingYear2Region', descKey: 'landingYear2Desc' },
    { yearKey: 'landingYear3', regionKey: 'landingYear3Region', descKey: 'landingYear3Desc' },
    { yearKey: 'landingYear4', regionKey: 'landingYear4Region', descKey: 'landingYear4Desc' },
  ];

  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="vision-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-4 max-w-3xl" data-testid="text-vision-title">
            {t('landingVisionTitle', language)}
          </h2>
          <p className="text-lg text-white/40 max-w-xl mb-20" data-testid="text-vision-subtitle">
            {t('landingVisionSubtitle', language)}
          </p>
        </FadeIn>

        <div className="max-w-2xl">
          {milestones.map((m, i) => (
            <FadeIn key={m.yearKey} delay={i * 0.15}>
              <div className="flex gap-6 mb-12 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${m.active ? 'bg-[#4ADE80]' : 'bg-white/20'}`} />
                  {i < milestones.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-2" />}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#4ADE80]/60 uppercase tracking-wider">{t(m.yearKey, language)}</span>
                    <span className="text-lg font-bold text-[#F5F5F5]">{t(m.regionKey, language)}</span>
                    {m.active && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#214C34]/40 border border-[#214C34]/60 text-[#4ADE80] rounded-md uppercase tracking-wider">
                        {t('landingCurrent', language)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed">{t(m.descKey, language)}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  const { language } = useLanguage();
  const founders = [
    { name: 'Sameer', roleKey: 'landingSameerRole', photo: sameerPhoto, descKey: 'landingSameerDesc' },
    { name: 'Ellysen', roleKey: 'landingEllyRole', photo: ellyPhoto, descKey: 'landingEllyDesc' },
    { name: 'Momoka', roleKey: 'landingMomokaRole', photo: momokaPhoto, descKey: 'landingMomokaDesc' },
  ];

  const teamMembers = [
    { name: 'Makarem', roleKey: 'landingMakaremRole', photo: makaremPhoto, descKey: 'landingMakaremDesc' },
    { name: 'Sami', roleKey: 'landingSamiRole', photo: samiPhoto, descKey: 'landingSamiDesc' },
    { name: 'Rania', roleKey: 'landingRaniaRole', photo: raniaPhoto, descKey: 'landingRaniaDesc' },
  ];

  return (
    <section id="team" className="py-32 px-6 md:px-12 relative" data-testid="team-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="max-w-[1440px] mx-auto">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl font-bold text-[#F5F5F5] tracking-tight mb-16" data-testid="text-team-title">
            {t('landingTeamTitle', language)}
          </h2>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {founders.map((member, i) => (
            <FadeIn key={member.name} delay={i * 0.1}>
              <GlassCard className="p-8">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-16 h-16 rounded-full object-cover mb-6 border border-white/[0.08]"
                  data-testid={`team-photo-${member.name.toLowerCase()}`}
                />
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-1">{member.name}</h3>
                <p className="text-xs text-[#4ADE80]/60 font-medium uppercase tracking-wider mb-4">{t(member.roleKey, language)}</p>
                <p className="text-sm text-white/40 leading-relaxed">{t(member.descKey, language)}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <h3 className="text-2xl md:text-3xl font-bold text-[#F5F5F5] tracking-tight mb-10" data-testid="text-meet-team-title">
            {t('landingMeetTeamTitle', language)}
          </h3>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8">
          {teamMembers.map((member, i) => (
            <FadeIn key={member.name} delay={i * 0.1}>
              <GlassCard className="p-8">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-16 h-16 rounded-full object-cover mb-6 border border-white/[0.08]"
                  data-testid={`team-photo-${member.name.toLowerCase()}`}
                />
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-1">{member.name}</h3>
                <p className="text-xs text-[#4ADE80]/60 font-medium uppercase tracking-wider mb-4">{t(member.roleKey, language)}</p>
                <p className="text-sm text-white/40 leading-relaxed">{t(member.descKey, language)}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { language } = useLanguage();
  return (
    <section className="py-32 px-6 md:px-12 relative" data-testid="cta-section">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#214C34]/15 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative z-10">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F5F5F5] tracking-tight mb-6" data-testid="text-cta-title">
            {t('landingCTATitle', language)}
          </h2>
          <p className="text-lg text-white/40 mb-12 max-w-xl mx-auto" data-testid="text-cta-subtitle">
            {t('landingCTASubtitle', language)}
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:gomisnap@gmail.com">
              <Button size="lg" className="bg-[#214C34] text-white border border-[#2a6344]" data-testid="cta-partner">
                {t('landingPartnerWithUs', language)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Link href="/">
              <Button variant="outline" size="lg" className="border-white/[0.12] text-white/70" data-testid="cta-demo">
                <Camera className="w-4 h-4 mr-2" />
                {t('landingTryLiveDemo', language)}
              </Button>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function Footer() {
  const { language } = useLanguage();
  return (
    <footer className="py-16 px-6 md:px-12 border-t border-white/[0.06]" data-testid="footer">
      <div className="max-w-[1440px] mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoImage} alt="GOMI SNAP" className="w-8 h-8 object-contain" />
              <span className="text-[#F5F5F5] font-semibold text-lg">GOMI SNAP</span>
            </div>
            <p className="text-sm text-white/35 max-w-xs leading-relaxed" data-testid="text-footer-desc">
              {t('landingFooterDesc', language)}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">{t('landingFooterProduct', language)}</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="text-sm text-white/35 hover:text-white/60 transition-colors" data-testid="footer-live-demo">{t('landingLiveDemo', language)}</Link></li>
              <li><button onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-white/35 hover:text-white/60 transition-colors" data-testid="footer-features">{t('landingFooterFeatures', language)}</button></li>
              <li><button onClick={() => document.getElementById('intelligence')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-white/35 hover:text-white/60 transition-colors" data-testid="footer-intelligence">{t('landingIntelligence', language)}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">{t('landingFooterConnect', language)}</h4>
            <ul className="space-y-2">
              <li>
                <a href="mailto:gomisnap@gmail.com" className="text-sm text-white/35 hover:text-white/60 transition-colors flex items-center gap-2" data-testid="footer-email">
                  <Mail className="w-3 h-3" />
                  gomisnap@gmail.com
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/gomi.snap?igsh=cHAxbzMwcmhmdXJz" target="_blank" rel="noopener noreferrer" className="text-sm text-white/35 hover:text-white/60 transition-colors" data-testid="footer-instagram">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://www.tiktok.com/@gomi.snap?lang=en" target="_blank" rel="noopener noreferrer" className="text-sm text-white/35 hover:text-white/60 transition-colors" data-testid="footer-tiktok">
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/25">&copy; 2026 GOMI SNAP. {t('landingFooterAllRights', language)}</p>
          <p className="text-xs text-white/25">{t('landingFooterLangsSupported', language)}</p>
        </div>
      </div>
    </footer>
  );
}

export default function Landing3D() {
  return (
    <LanguageProvider>
      <PageViewTracker />
      <div className="min-h-screen bg-[#0F1115] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <Navbar />
        <HeroSection />
        <AchievementSection />
        <ProductSection />
        <ProblemSection />
        <IntelligenceSection />
        <EconomicImpactSection />
        <DifferentiationSection />
        <PolicySection />
        <TechSection />
        <GlobalVisionSection />
        <TeamSection />
        <CTASection />
        <Footer />
      </div>
    </LanguageProvider>
  );
}

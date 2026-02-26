import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ImageOff, Languages, FileText, Filter, Pin, Trash2, Trash, BarChart3, TrendingUp, TrendingDown, MapPin, Zap, Database, AlertTriangle, ThumbsUp, ThumbsDown, HelpCircle, Activity, Cpu, Clock, RefreshCw, CheckCircle2, XCircle, Users, UserCheck, UserX, Repeat, Download, Calendar, Building, Leaf, Cloud, Recycle, PieChart as PieChartIcon, Info, Eye } from "lucide-react";
import type { Feedback } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("health");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { toast } = useToast();
  
  // Impact dashboard filters
  const [impactStartDate, setImpactStartDate] = useState<string>("2025-01-01");
  const [impactEndDate, setImpactEndDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [impactLocationFilter, setImpactLocationFilter] = useState<string>("all");

  useEffect(() => {
    if (!import.meta.env.DEV) {
      setLocation("/");
    }
  }, [setLocation]);

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/feedback/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "Feedback deleted",
        description: "The feedback has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/feedback");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({
        title: "All feedback cleared",
        description: "All feedback submissions have been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/feedback/${id}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to toggle pin. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearTableMutation = useMutation({
    mutationFn: async (tableName: string) => {
      await apiRequest("POST", "/api/admin/clear-table", { tableName });
    },
    onSuccess: (_, tableName) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/summary"] });
      toast({
        title: "Table Cleared",
        description: `All data from "${tableName}" table has been deleted.`,
      });
      setShowClearDialog(false);
      setSelectedTable("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear table. Please try again.",
        variant: "destructive",
      });
    },
  });

  const issueTypeLabels: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    wrong_identification: { label: "Wrong AI ID", icon: AlertCircle, variant: "destructive" },
    image_upload: { label: "Image Upload", icon: ImageOff, variant: "secondary" },
    translation: { label: "Translation", icon: Languages, variant: "outline" },
    other: { label: "Other", icon: FileText, variant: "default" },
  };

  const filteredFeedback = (feedbackList?.filter((item) => {
    if (filterCategory === "all") return true;
    return item.issueType === filterCategory;
  }) || []).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Post-scan feedback data
  interface PostScanFeedbackItem {
    id: string;
    helpful: boolean | null;
    category: string | null;
    itemName: string | null;
    timestamp: string;
    sessionId: string | null;
    pilotLocationId: string | null;
  }

  const { data: postScanFeedback, isLoading: isLoadingPostScan } = useQuery<{
    feedbackList: PostScanFeedbackItem[];
    summary: {
      totalFeedback: number;
      helpfulCount: number;
      notHelpfulCount: number;
      notSureCount: number;
    };
  }>({
    queryKey: ["/api/admin/analytics/post-scan-feedback"],
    enabled: activeTab === "feedback",
  });

  // Analytics data
  const { data: analyticsSummary } = useQuery<{
    totalScans: number;
    cacheHitRate: number;
    scansByCategory: Record<string, number>;
    scansByCity: Record<string, number>;
    scansByLanguage: Record<string, number>;
  }>({
    queryKey: ["/api/admin/analytics/summary"],
    enabled: activeTab === "analytics",
  });

  // User retention data
  interface RetentionData {
    totalUniqueUsers: number;
    returningUsers: number;
    oneTimeUsers: number;
    returnRate: number;
    powerUsers: number;
    monthlyCohorts: Array<{
      month: string;
      newUsers: number;
      returnedFromPrevious: number;
    }>;
    usersByVisitCount: Array<{
      visits: string;
      count: number;
    }>;
  }

  const { data: retentionData, isLoading: isLoadingRetention, refetch: refetchRetention } = useQuery<RetentionData>({
    queryKey: ["/api/admin/analytics/retention"],
    enabled: activeTab === "retention",
  });

  // Impact KPIs data for institutional report
  interface ImpactKPIsData {
    uniqueUsers: number;
    totalSessions: number;
    guidanceShown: number;
    guidanceConfirmed: number;
    guidanceRejected: number;
    guidanceAcceptanceRate: number;
    completionRate: number;
    medianResolutionTimeMs: number;
    confusionRate: number;
    returningUsers: number;
    newUsers: number;
    topConfusingItems: Array<{ item: string; count: number }>;
    scansByCategory: Record<string, number>;
  }

  interface WeeklyTrendData {
    weekStart: string;
    uniqueUsers: number;
    sessions: number;
    guidanceAcceptanceRate: number;
    confusionRate: number;
  }

  interface EnvironmentalImpactData {
    totalScans: number;
    totalMisSortsPrevented: number;
    totalAvoidedMassKg: number;
    totalAvoidedCostJpy: number;
    totalAvoidedCo2eKg: number;
    preventionRate: number;
    avgCostSavedPerScan: number;
    avgCo2eSavedPerScan: number;
    impactByCategory: Record<string, {
      scans: number;
      misSortsPrevented: number;
      avoidedMassKg: number;
      avoidedCostJpy: number;
      avoidedCo2eKg: number;
    }>;
    impactByLocation: Record<string, {
      scans: number;
      misSortsPrevented: number;
      avoidedCostJpy: number;
      avoidedCo2eKg: number;
    }>;
    trend30Days: Array<{
      period: string;
      scans: number;
      misSortsPrevented: number;
      avoidedCo2eKg: number;
    }>;
  }

  const impactQueryParams = new URLSearchParams();
  if (impactStartDate) impactQueryParams.set('startDate', impactStartDate);
  if (impactEndDate) impactQueryParams.set('endDate', impactEndDate);
  if (impactLocationFilter !== 'all') impactQueryParams.set('locationId', impactLocationFilter);
  const impactQueryString = impactQueryParams.toString();

  const { data: impactKPIs, isLoading: isLoadingImpact, refetch: refetchImpact } = useQuery<ImpactKPIsData>({
    queryKey: ["/api/admin/impact/kpis", impactStartDate, impactEndDate, impactLocationFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/impact/kpis?${impactQueryString}`);
      if (!response.ok) throw new Error('Failed to fetch KPIs');
      return response.json();
    },
    enabled: activeTab === "impact",
  });

  const { data: weeklyTrends, refetch: refetchTrends } = useQuery<WeeklyTrendData[]>({
    queryKey: ["/api/admin/impact/trends", impactLocationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (impactLocationFilter !== 'all') params.set('locationId', impactLocationFilter);
      const response = await fetch(`/api/admin/impact/trends?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch trends');
      return response.json();
    },
    enabled: activeTab === "impact",
  });

  const { data: environmentalImpact, isLoading: isLoadingEnvImpact, refetch: refetchEnvImpact } = useQuery<EnvironmentalImpactData>({
    queryKey: ["/api/admin/impact-analytics/summary", impactStartDate, impactEndDate, impactLocationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (impactStartDate) params.set('startDate', impactStartDate);
      if (impactEndDate) params.set('endDate', impactEndDate);
      if (impactLocationFilter !== 'all') params.set('location', impactLocationFilter);
      const response = await fetch(`/api/admin/impact-analytics/summary?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch environmental impact');
      return response.json();
    },
    enabled: activeTab === "impact",
  });

  const COLORS = {
    burnable: "#10b981",
    recyclable: "#ec4899",
    "non-burnable": "#6b7280",
    "old-paper-clothing": "#f59e0b",
    oversized: "#ef4444",
    "special-recycling": "#8b5cf6",
  };

  const categoryChartData = analyticsSummary?.scansByCategory
    ? Object.entries(analyticsSummary.scansByCategory).map(([name, value]) => ({
        name: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        value,
        color: COLORS[name as keyof typeof COLORS] || "#gray",
      }))
    : [];

  const cityChartData = analyticsSummary?.scansByCity
    ? Object.entries(analyticsSummary.scansByCity).map(([name, value]) => ({
        name,
        scans: value,
      }))
    : [];

  const languageData = analyticsSummary?.scansByLanguage
    ? Object.entries(analyticsSummary.scansByLanguage).map(([name, value]) => ({
        name: name === "en" ? "English" : "Japanese",
        value,
      }))
    : [];

  // System Health data
  interface SystemHealthData {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      activeScans: number;
      peakActiveScans: number;
      scansPerMinute: number;
      openAICallsPerMinute: number;
      cacheHitRate: number;
      averageResponseTime: number;
      consecutiveErrors: number;
      totalScansToday: number;
      totalOpenAICallsToday: number;
      totalErrorsToday: number;
      lastScanAt: string | null;
      lastErrorAt: string | null;
      lastErrorMessage: string | null;
      uptime: number;
    };
    persistedStats?: {
      totalScansAllTime: number;
      totalScansToday: number;
      uniqueUsersAllTime: number;
      uniqueUsersToday: number;
      feedbackCount: number;
    };
    alerts: string[];
    capacity: {
      currentLoad: number;
      estimatedMaxConcurrent: number;
      recommendation: string;
    };
    serverTime: string;
    nodeVersion: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  }

  const { data: systemHealth, isLoading: isLoadingHealth, refetch: refetchHealth } = useQuery<SystemHealthData>({
    queryKey: ["/api/admin/system-health"],
    enabled: activeTab === "health",
    refetchInterval: activeTab === "health" ? 5000 : false, // Auto-refresh every 5 seconds when viewing
  });

  // Page views data
  interface PageViewsData {
    totalPageViews: number;
    todayPageViews: number;
    uniqueVisitors: number;
    byPage: Record<string, number>;
  }

  const { data: pageViews, refetch: refetchPageViews } = useQuery<PageViewsData>({
    queryKey: ["/api/admin/analytics/page-views"],
    enabled: activeTab === "health",
    refetchInterval: activeTab === "health" ? 10000 : false,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900/30 border-green-300';
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300';
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30 border-red-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-6 w-6 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      case 'critical': return <XCircle className="h-6 w-6 text-red-600" />;
      default: return <Activity className="h-6 w-6 text-gray-600" />;
    }
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-50/30 dark:to-emerald-950/10">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            View analytics and manage user feedback
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-5xl grid-cols-6">
            <TabsTrigger value="health" data-testid="tab-health">
              <Activity className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger value="retention" data-testid="tab-retention">
              <Repeat className="h-4 w-4 mr-2" />
              Retention
            </TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">
              <FileText className="h-4 w-4 mr-2" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="impact" data-testid="tab-impact">
              <TrendingUp className="h-4 w-4 mr-2" />
              Impact
            </TabsTrigger>
            <TabsTrigger value="database" data-testid="tab-database">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
          </TabsList>

          {/* System Health Tab */}
          <TabsContent value="health" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Real-Time System Monitoring</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={isLoadingHealth}
                data-testid="button-refresh-health"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {isLoadingHealth ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading system health...
              </div>
            ) : !systemHealth ? (
              <div className="text-center py-8 text-muted-foreground">
                Unable to fetch system health data
              </div>
            ) : (
              <>
                {/* Status Banner */}
                <Card className={`border-2 ${getStatusColor(systemHealth.status)}`} data-testid="card-status-banner">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(systemHealth.status)}
                        <div>
                          <h3 className="text-lg font-bold capitalize" data-testid="text-system-status">
                            System Status: {systemHealth.status.toUpperCase()}
                          </h3>
                          <p className="text-sm opacity-80">{systemHealth.capacity.recommendation}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p>Server Time: {new Date(systemHealth.serverTime).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                        <p className="text-muted-foreground">Uptime: {systemHealth.metrics.uptime.toFixed(1)} hours</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts Section */}
                {systemHealth.alerts.length > 0 && (
                  <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20" data-testid="card-alerts">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                        Active Alerts ({systemHealth.alerts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {systemHealth.alerts.map((alert, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300" data-testid={`text-alert-${index}`}>
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            {alert}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card data-testid="card-active-scans">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Active Scans</p>
                          <p className="text-3xl font-bold" data-testid="text-active-scans">{systemHealth.metrics.activeScans}</p>
                        </div>
                        <div className={`p-3 rounded-full ${systemHealth.metrics.activeScans >= 5 ? 'bg-red-100 dark:bg-red-900/30' : systemHealth.metrics.activeScans >= 3 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                          <Activity className={`h-6 w-6 ${systemHealth.metrics.activeScans >= 5 ? 'text-red-600' : systemHealth.metrics.activeScans >= 3 ? 'text-yellow-600' : 'text-green-600'}`} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Peak today: {systemHealth.metrics.peakActiveScans}</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-capacity">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">System Load</p>
                          <p className="text-3xl font-bold" data-testid="text-load-percent">{systemHealth.capacity.currentLoad}%</p>
                        </div>
                        <div className={`p-3 rounded-full ${systemHealth.capacity.currentLoad >= 80 ? 'bg-red-100 dark:bg-red-900/30' : systemHealth.capacity.currentLoad >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                          <Cpu className={`h-6 w-6 ${systemHealth.capacity.currentLoad >= 80 ? 'text-red-600' : systemHealth.capacity.currentLoad >= 50 ? 'text-yellow-600' : 'text-green-600'}`} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Max: {systemHealth.capacity.estimatedMaxConcurrent} concurrent</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-cache-rate">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
                          <p className="text-3xl font-bold" data-testid="text-cache-rate">{systemHealth.metrics.cacheHitRate}%</p>
                        </div>
                        <div className={`p-3 rounded-full ${systemHealth.metrics.cacheHitRate >= 60 ? 'bg-green-100 dark:bg-green-900/30' : systemHealth.metrics.cacheHitRate >= 30 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          <Zap className={`h-6 w-6 ${systemHealth.metrics.cacheHitRate >= 60 ? 'text-green-600' : systemHealth.metrics.cacheHitRate >= 30 ? 'text-yellow-600' : 'text-red-600'}`} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Higher = less API cost</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-response-time">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Response</p>
                          <p className="text-3xl font-bold" data-testid="text-response-time">{(systemHealth.metrics.averageResponseTime / 1000).toFixed(1)}s</p>
                        </div>
                        <div className={`p-3 rounded-full ${systemHealth.metrics.averageResponseTime <= 5000 ? 'bg-green-100 dark:bg-green-900/30' : systemHealth.metrics.averageResponseTime <= 10000 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          <Clock className={`h-6 w-6 ${systemHealth.metrics.averageResponseTime <= 5000 ? 'text-green-600' : systemHealth.metrics.averageResponseTime <= 10000 ? 'text-yellow-600' : 'text-red-600'}`} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Per scan request</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Database-Persisted Stats (don't reset on server restart) */}
                <Card data-testid="card-persisted-stats">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Statistics (Persisted)
                    </CardTitle>
                    <CardDescription>These numbers are stored in the database and persist across server restarts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Scans (All Time)</p>
                        <p className="text-2xl font-bold text-primary" data-testid="text-total-scans-alltime">{systemHealth.persistedStats?.totalScansAllTime ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Scans Today</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-total-scans-today">{systemHealth.persistedStats?.totalScansToday ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unique Users (All Time)</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="text-unique-users-alltime">{systemHealth.persistedStats?.uniqueUsersAllTime ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Users Today</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-unique-users-today">{systemHealth.persistedStats?.uniqueUsersToday ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Feedback Count</p>
                        <p className="text-2xl font-bold text-orange-600" data-testid="text-feedback-count">{systemHealth.persistedStats?.feedbackCount ?? 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Page Views Stats */}
                {pageViews && (
                  <Card data-testid="card-page-views">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Page Views (Traffic)
                      </CardTitle>
                      <CardDescription>Visitor traffic separate from scan activity</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Page Views</p>
                          <p className="text-2xl font-bold text-cyan-600" data-testid="text-total-page-views">{pageViews.totalPageViews}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Today's Views</p>
                          <p className="text-2xl font-bold text-blue-600" data-testid="text-today-page-views">{pageViews.todayPageViews}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unique Visitors</p>
                          <p className="text-2xl font-bold text-purple-600" data-testid="text-unique-visitors">{pageViews.uniqueVisitors}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">By Page</p>
                          <div className="text-sm">
                            {Object.entries(pageViews.byPage).map(([page, count]) => (
                              <span key={page} className="inline-flex items-center mr-2">
                                <span className="font-medium text-primary">{page}:</span>
                                <span className="ml-1 text-muted-foreground">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Real-time Session Stats (in-memory, reset on restart) */}
                <Card data-testid="card-todays-stats">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Current Session Stats (Since Server Start)
                    </CardTitle>
                    <CardDescription>These reset when the server restarts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Session Scans</p>
                        <p className="text-2xl font-bold text-primary" data-testid="text-total-scans">{systemHealth.metrics.totalScansToday}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">OpenAI API Calls</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-api-calls">{systemHealth.metrics.totalOpenAICallsToday}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Scans/Min (5m avg)</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="text-scans-per-min">{systemHealth.metrics.scansPerMinute}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Session Errors</p>
                        <p className={`text-2xl font-bold ${systemHealth.metrics.totalErrorsToday > 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="text-errors">{systemHealth.metrics.totalErrorsToday}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Error Info */}
                {systemHealth.metrics.lastErrorMessage && (
                  <Card className="border-red-200 bg-red-50 dark:bg-red-900/20" data-testid="card-last-error">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="h-5 w-5" />
                        Last Error
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm font-mono text-red-800 dark:text-red-300" data-testid="text-error-message">{systemHealth.metrics.lastErrorMessage}</p>
                      {systemHealth.metrics.lastErrorAt && (
                        <p className="text-xs text-red-600 mt-2">
                          {new Date(systemHealth.metrics.lastErrorAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Server Info */}
                <Card data-testid="card-server-info">
                  <CardHeader>
                    <CardTitle className="text-lg">Server Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground">Node.js Version</p>
                        <p className="font-mono">{systemHealth.nodeVersion}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Memory (Heap Used)</p>
                        <p className="font-mono">{formatBytes(systemHealth.memoryUsage.heapUsed)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Memory (Heap Total)</p>
                        <p className="font-mono">{formatBytes(systemHealth.memoryUsage.heapTotal)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Memory (RSS)</p>
                        <p className="font-mono">{formatBytes(systemHealth.memoryUsage.rss)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Capacity Warning for Investors */}
                <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20" data-testid="card-capacity-info">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Scaling Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Current architecture supports approximately <strong>4-6 concurrent scans</strong>. 
                      For production launch with 50+ concurrent users, the following upgrades are recommended:
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Upgrade to Reserved Compute with autoscaling
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Implement request queue for OpenAI API calls
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Upgrade OpenAI plan for higher rate limits
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Add connection pooling for database
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* User Retention Tab */}
          <TabsContent value="retention" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">User Retention Analytics</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchRetention()}
                disabled={isLoadingRetention}
                data-testid="button-refresh-retention"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingRetention ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {isLoadingRetention ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading retention data...
              </div>
            ) : !retentionData ? (
              <div className="text-center py-8 text-muted-foreground">
                Unable to fetch retention data
              </div>
            ) : (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card data-testid="card-total-users">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Users className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Users</p>
                          <p className="text-2xl font-bold" data-testid="text-total-users">{retentionData.totalUniqueUsers}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-returning-users">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <UserCheck className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-sm text-muted-foreground">Returning Users</p>
                          <p className="text-2xl font-bold text-green-600" data-testid="text-returning-users">{retentionData.returningUsers}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-one-time-users">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <UserX className="h-8 w-8 text-gray-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">One-time Users</p>
                          <p className="text-2xl font-bold text-gray-500" data-testid="text-one-time-users">{retentionData.oneTimeUsers}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-return-rate">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Repeat className="h-8 w-8 text-purple-600" />
                        <div>
                          <p className="text-sm text-muted-foreground">Return Rate</p>
                          <p className="text-2xl font-bold text-purple-600" data-testid="text-return-rate">{retentionData.returnRate}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-power-users">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Zap className="h-8 w-8 text-orange-600" />
                        <div>
                          <p className="text-sm text-muted-foreground">Power Users (3+ visits)</p>
                          <p className="text-2xl font-bold text-orange-600" data-testid="text-power-users">{retentionData.powerUsers}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visit Distribution */}
                  <Card data-testid="card-visit-distribution">
                    <CardHeader>
                      <CardTitle className="text-lg">Users by Visit Count</CardTitle>
                      <CardDescription>Distribution of how many times users have visited</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {retentionData.usersByVisitCount.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={retentionData.usersByVisitCount}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="visits" label={{ value: 'Visits', position: 'bottom', offset: -5 }} />
                            <YAxis label={{ value: 'Users', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">No visit data available</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly Cohorts */}
                  <Card data-testid="card-monthly-cohorts">
                    <CardHeader>
                      <CardTitle className="text-lg">Monthly User Growth</CardTitle>
                      <CardDescription>New users and returning users by month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {retentionData.monthlyCohorts.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={retentionData.monthlyCohorts}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="newUsers" name="New Users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="returnedFromPrevious" name="Returned" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">No monthly data available</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Investor Summary */}
                <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-purple-50 dark:to-purple-900/10" data-testid="card-investor-summary">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Investor Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-4 bg-background rounded-lg">
                        <p className="font-semibold text-primary">User Acquisition</p>
                        <p className="text-muted-foreground mt-1">
                          {retentionData.totalUniqueUsers} total users across {retentionData.monthlyCohorts.length} months of operation
                        </p>
                      </div>
                      <div className="p-4 bg-background rounded-lg">
                        <p className="font-semibold text-green-600">Organic Retention</p>
                        <p className="text-muted-foreground mt-1">
                          {retentionData.returnRate}% of users return organically ({retentionData.returningUsers} users)
                        </p>
                      </div>
                      <div className="p-4 bg-background rounded-lg">
                        <p className="font-semibold text-orange-600">Engaged Users</p>
                        <p className="text-muted-foreground mt-1">
                          {retentionData.powerUsers} power users (3+ visits) showing strong engagement
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>User Feedback</CardTitle>
                <CardDescription>
                  {filteredFeedback.length} {filteredFeedback.length === 1 ? 'submission' : 'submissions'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteAllMutation.isPending || !feedbackList || feedbackList.length === 0}
                  data-testid="button-clear-all"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issues</SelectItem>
                    <SelectItem value="wrong_identification">Wrong AI ID</SelectItem>
                    <SelectItem value="image_upload">Image Upload</SelectItem>
                    <SelectItem value="translation">Translation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading feedback...
              </div>
            ) : filteredFeedback.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No feedback submissions yet
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Issue Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[200px]">Submitted</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedback.map((item) => {
                      const issueInfo = issueTypeLabels[item.issueType] || issueTypeLabels.other;
                      const Icon = issueInfo.icon;
                      return (
                        <TableRow 
                          key={item.id} 
                          data-testid={`feedback-row-${item.id}`}
                          className={item.pinned ? "bg-accent/50" : ""}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                              <Badge variant={issueInfo.variant} className="gap-1">
                                <Icon className="h-3 w-3" />
                                {issueInfo.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm line-clamp-2">{item.description}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(item.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant={item.pinned ? "default" : "ghost"}
                                size="icon"
                                onClick={() => togglePinMutation.mutate(item.id)}
                                disabled={togglePinMutation.isPending}
                                data-testid={`button-pin-${item.id}`}
                                className="h-8 w-8"
                              >
                                <Pin className={`h-4 w-4 ${item.pinned ? "fill-current" : ""}`} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(item.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${item.id}`}
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

            {/* Post-Scan Feedback Section */}
            <Card className="shadow-lg" data-testid="card-post-scan-feedback">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ThumbsUp className="h-5 w-5 text-green-500" />
                      Post-Scan Feedback
                    </CardTitle>
                    <CardDescription>
                      "Was this helpful?" responses from users after classification
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <ThumbsUp className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-helpful-count">
                        {postScanFeedback?.summary.helpfulCount ?? 0}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-500">Yes (Helpful)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <ThumbsDown className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-400" data-testid="text-not-helpful-count">
                        {postScanFeedback?.summary.notHelpfulCount ?? 0}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-500">No (Not Helpful)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-700">
                    <HelpCircle className="h-8 w-8 text-gray-500" />
                    <div>
                      <p className="text-2xl font-bold text-gray-700 dark:text-gray-400" data-testid="text-not-sure-count">
                        {postScanFeedback?.summary.notSureCount ?? 0}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-500">Not Sure</p>
                    </div>
                  </div>
                </div>

                {/* Feedback List Table */}
                {isLoadingPostScan ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading post-scan feedback...
                  </div>
                ) : !postScanFeedback?.feedbackList?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No post-scan feedback yet. Users will see "Was this helpful?" after each scan.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Response</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-[120px]">Location</TableHead>
                          <TableHead className="w-[180px]">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {postScanFeedback.feedbackList.map((item) => (
                          <TableRow key={item.id} data-testid={`post-scan-row-${item.id}`}>
                            <TableCell>
                              {item.helpful === true ? (
                                <Badge variant="default" className="bg-green-600 gap-1">
                                  <ThumbsUp className="h-3 w-3" />
                                  Yes
                                </Badge>
                              ) : item.helpful === false ? (
                                <Badge variant="destructive" className="gap-1">
                                  <ThumbsDown className="h-3 w-3" />
                                  No
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <HelpCircle className="h-3 w-3" />
                                  Not sure
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.itemName || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {item.category?.replace(/-/g, ' ') || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.pilotLocationId || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(item.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-scans">
                    {analyticsSummary?.totalScans ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">All-time scans</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-cache-hit-rate">
                    {analyticsSummary?.cacheHitRate.toFixed(1) ?? 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">API cost savings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Categories Tracked</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-categories-count">
                    {Object.keys(analyticsSummary?.scansByCategory ?? {}).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Waste types</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Locations</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-locations-count">
                    {Object.keys(analyticsSummary?.scansByCity ?? {}).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Beppu areas</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Scans by Category</CardTitle>
                  <CardDescription>Waste type distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scans by Location</CardTitle>
                  <CardDescription>Distribution across Beppu areas</CardDescription>
                </CardHeader>
                <CardContent>
                  {cityChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={cityChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="scans" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Language Usage</CardTitle>
                  <CardDescription>English vs Japanese</CardDescription>
                </CardHeader>
                <CardContent>
                  {languageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={languageData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {languageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#ec4899"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Impact Metrics</CardTitle>
                  <CardDescription>Environmental & cost impact</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">API Calls Saved</span>
                      <span className="text-sm text-muted-foreground">
                        {Math.round((analyticsSummary?.totalScans ?? 0) * (analyticsSummary?.cacheHitRate ?? 0) / 100)}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${analyticsSummary?.cacheHitRate ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cost Savings</span>
                      <span className="font-medium text-green-600">
                        ~${((analyticsSummary?.totalScans ?? 0) * (analyticsSummary?.cacheHitRate ?? 0) / 100 * 0.002).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Items Sorted</span>
                      <span className="font-medium">{analyticsSummary?.totalScans ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Impact Report Tab */}
          <TabsContent value="impact" className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Institutional Impact Report</h2>
                <p className="text-sm text-muted-foreground">Track behavior change and generate April report data</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={impactStartDate}
                    onChange={(e) => setImpactStartDate(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    data-testid="input-start-date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={impactEndDate}
                    onChange={(e) => setImpactEndDate(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    data-testid="input-end-date"
                  />
                </div>
                <Select value={impactLocationFilter} onValueChange={setImpactLocationFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
                    <Building className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="apu_campus">APU Campus</SelectItem>
                    <SelectItem value="downtown_beppu">Downtown Beppu</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { refetchImpact(); refetchTrends(); }}
                  data-testid="button-refresh-impact"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('format', 'json');
                  if (impactStartDate) params.set('startDate', impactStartDate);
                  if (impactEndDate) params.set('endDate', impactEndDate);
                  if (impactLocationFilter !== 'all') params.set('locationId', impactLocationFilter);
                  window.open(`/api/admin/export/report?${params.toString()}`, '_blank');
                }}
                data-testid="button-export-json"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('format', 'csv');
                  if (impactStartDate) params.set('startDate', impactStartDate);
                  if (impactEndDate) params.set('endDate', impactEndDate);
                  if (impactLocationFilter !== 'all') params.set('locationId', impactLocationFilter);
                  window.open(`/api/admin/export/kpis?${params.toString()}`, '_blank');
                }}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Impact KPI Cards */}
            {isLoadingImpact ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading impact metrics...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-unique-users">
                  <CardHeader className="pb-2">
                    <CardDescription>Unique Users</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-unique-users">
                      {impactKPIs?.uniqueUsers ?? 0}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600 font-medium">{impactKPIs?.returningUsers ?? 0} returning</span> / {impactKPIs?.newUsers ?? 0} new
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-acceptance-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Guidance Acceptance Rate</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-acceptance">
                      {impactKPIs?.guidanceAcceptanceRate?.toFixed(1) ?? 0}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-600 font-medium">{impactKPIs?.guidanceConfirmed ?? 0} confirmed</span> / {impactKPIs?.guidanceShown ?? 0} shown
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-confusion-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Confusion Rate</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-confusion">
                      {impactKPIs?.confusionRate?.toFixed(1) ?? 0}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Scans requiring clarification
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-completion-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Completion Rate</CardDescription>
                    <CardTitle className="text-3xl" data-testid="text-completion">
                      {impactKPIs?.completionRate?.toFixed(1) ?? 0}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Users completing disposal flow
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Acceptance Trend */}
              <Card data-testid="card-weekly-trends">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Weekly Behavior Trends
                  </CardTitle>
                  <CardDescription>Acceptance rate and confusion over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={
                      (weeklyTrends ?? []).slice(-8).map(trend => ({
                        week: new Date(trend.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
                        acceptance: trend.guidanceAcceptanceRate,
                        confusion: trend.confusionRate,
                        users: trend.uniqueUsers,
                      }))
                    }>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="acceptance" name="Acceptance %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="confusion" name="Confusion %" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Scans by Category */}
              <Card data-testid="card-category-chart">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Scans by Category
                  </CardTitle>
                  <CardDescription>Distribution of trash categorization</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={
                      Object.entries(impactKPIs?.scansByCategory ?? {}).map(([name, value]) => ({
                        name: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        count: value
                      }))
                    }>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Confusing Items & Report Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-confusing-items">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Top Confusing Items
                  </CardTitle>
                  <CardDescription>Items requiring clarification most often</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={
                      (impactKPIs?.topConfusingItems ?? [])
                        .slice(0, 8)
                        .map(item => ({ name: item.item, count: item.count }))
                    } layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Report Summary */}
              <Card data-testid="card-report-summary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    April Report Preview
                  </CardTitle>
                  <CardDescription>Key metrics for institutional report</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Total Users</span>
                    <span className="font-semibold">{impactKPIs?.uniqueUsers ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Returning Users</span>
                    <span className="font-semibold text-green-600">{impactKPIs?.returningUsers ?? 0} ({impactKPIs?.uniqueUsers ? ((impactKPIs.returningUsers / impactKPIs.uniqueUsers) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Guidance Shown</span>
                    <span className="font-semibold">{impactKPIs?.guidanceShown ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Guidance Accepted</span>
                    <span className="font-semibold text-green-600">{impactKPIs?.guidanceConfirmed ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">Acceptance Rate</span>
                    <span className="font-semibold text-primary">{impactKPIs?.guidanceAcceptanceRate?.toFixed(1) ?? 0}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Categories Tracked</span>
                    <span className="font-semibold">{Object.keys(impactKPIs?.scansByCategory ?? {}).length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Environmental Impact Analytics Section */}
            <div className="border-t pt-6 mt-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    Environmental Impact Analytics
                  </h2>
                  <p className="text-sm text-muted-foreground">Measuring environmental and cost impact of proper waste sorting</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchEnvImpact()}
                    disabled={isLoadingEnvImpact}
                    data-testid="button-refresh-env-impact"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingEnvImpact ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('format', 'csv');
                      if (impactStartDate) params.set('startDate', impactStartDate);
                      if (impactEndDate) params.set('endDate', impactEndDate);
                      if (impactLocationFilter !== 'all') params.set('location', impactLocationFilter);
                      window.open(`/api/admin/impact-analytics/export?${params.toString()}`, '_blank');
                    }}
                    data-testid="button-export-env-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Environmental Impact KPIs */}
              {isLoadingEnvImpact ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading environmental impact...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card className="border-green-200 dark:border-green-900" data-testid="card-mis-sorts-prevented">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Mis-Sorts Prevented
                      </CardDescription>
                      <CardTitle className="text-3xl text-green-600" data-testid="text-mis-sorts">
                        {environmentalImpact?.totalMisSortsPrevented ?? 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {(environmentalImpact?.preventionRate ?? 0).toFixed(1)}% prevention rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200 dark:border-blue-900" data-testid="card-co2-avoided">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-blue-600" />
                        CO₂ Emissions Avoided
                      </CardDescription>
                      <CardTitle className="text-3xl text-blue-600" data-testid="text-co2">
                        {(environmentalImpact?.totalAvoidedCo2eKg ?? 0).toFixed(2)} kg
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Avg {(environmentalImpact?.avgCo2eSavedPerScan ?? 0).toFixed(4)} kg/scan
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-200 dark:border-amber-900" data-testid="card-cost-savings">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-amber-600" />
                        Cost Savings
                      </CardDescription>
                      <CardTitle className="text-3xl text-amber-600" data-testid="text-cost">
                        ¥{(environmentalImpact?.totalAvoidedCostJpy ?? 0).toFixed(0)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Avg ¥{(environmentalImpact?.avgCostSavedPerScan ?? 0).toFixed(2)}/scan
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-200 dark:border-purple-900" data-testid="card-waste-diverted">
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-2">
                        <Recycle className="h-4 w-4 text-purple-600" />
                        Waste Properly Sorted
                      </CardDescription>
                      <CardTitle className="text-3xl text-purple-600" data-testid="text-waste">
                        {((environmentalImpact?.totalAvoidedMassKg ?? 0) * 1000).toFixed(0)} g
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        From {environmentalImpact?.totalScans ?? 0} total scans
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Impact Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-impact-by-category">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5" />
                      Impact by Category
                    </CardTitle>
                    <CardDescription>CO₂ savings distribution by waste category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={
                        Object.entries(environmentalImpact?.impactByCategory ?? {}).map(([name, data]) => ({
                          name: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                          misSorts: data.misSortsPrevented,
                          co2: Number(data.avoidedCo2eKg.toFixed(3)),
                        }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="misSorts" name="Mis-sorts Prevented" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="co2" name="CO₂ Avoided (kg)" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-daily-impact-trend">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Daily Impact Trend
                    </CardTitle>
                    <CardDescription>Scans and mis-sort prevention over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={
                        (environmentalImpact?.trend30Days ?? []).slice(-14).map(d => ({
                          date: new Date(d.period).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
                          scans: d.scans,
                          misSorts: d.misSortsPrevented,
                        }))
                      }>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="misSorts" name="Mis-sorts Prevented" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="scans" name="Total Scans" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Methodology Note */}
              <Card className="mt-6 bg-muted/50" data-testid="card-methodology">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Methodology & Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>Baseline mis-sort rate: 15% (scans with ≥70% confidence prevent mis-sorts)</p>
                  <p>Incineration emission factor: 900 kg CO₂e/ton (Japan waste management standard)</p>
                  <p>Disposal cost: ¥45,000/ton (Beppu municipal rates)</p>
                  <p>Contamination multiplier: 1.2x (conservative estimate for recycling stream)</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <Card className="shadow-lg border-destructive/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-destructive">Database Management</CardTitle>
                </div>
                <CardDescription>
                  Permanently delete all records from selected tables. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Select Table to Clear
                    </label>
                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                      <SelectTrigger className="w-full" data-testid="select-table">
                        <SelectValue placeholder="Choose a table..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feedback">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>Feedback - User feedback submissions</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="imageCache">
                          <div className="flex items-center gap-2">
                            <ImageOff className="h-4 w-4" />
                            <span>Image Cache - AI results & thumbnails</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="trashScanEvents">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <span>Analytics Events - Scan tracking data</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Warning</p>
                        <p className="text-sm text-muted-foreground">
                          This will permanently delete ALL records from the selected table. 
                          This action is irreversible and cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    size="lg"
                    className="w-full"
                    onClick={() => setShowClearDialog(true)}
                    disabled={!selectedTable || clearTableMutation.isPending}
                    data-testid="button-clear-table"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {clearTableMutation.isPending ? "Clearing..." : "Clear Selected Table"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm Table Deletion
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  You are about to permanently delete all records from the <strong>"{selectedTable}"</strong> table.
                </p>
                <p className="text-destructive font-medium">
                  This action cannot be undone. All data will be lost forever.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-clear">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearTableMutation.mutate(selectedTable)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-clear"
              >
                Yes, Delete All Records
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

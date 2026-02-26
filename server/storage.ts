import { type User, type InsertUser, type Feedback, type InsertFeedback, type ImageCache, type InsertImageCache, type TrashScanEvent, type InsertTrashScanEvent, type AnalyticsEvent, type InsertAnalyticsEvent, type AnalyticsEventType, type ChallengeScan, type InsertChallengeScan, type ImpactLocation, type InsertImpactLocation, type Ruleset, type InsertRuleset, type ImpactSession, type InsertImpactSession, type Outcome, type InsertOutcome, type ScanImpact, type InsertScanImpact, type ImpactSummary, users, feedback, imageCache, trashScanEvents, analyticsEvents, challengeScans, impactLocations, rulesets, impactSessions, outcomes, scanImpacts, CHALLENGE_CONFIG, IMPACT_REPORT_CONFIG, IMPACT_CONFIG, calculateScanImpact } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface UserStats {
  todayCount: number;
  weeklyBreakdown: Array<{ date: string; dayName: string; count: number }>;
  totalActiveDays: number;
  currentStreak: number;
  longestStreak: number;
  totalScans: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  deleteFeedback(id: string): Promise<void>;
  deleteAllFeedback(): Promise<void>;
  togglePinFeedback(id: string): Promise<Feedback>;
  findSimilarImage(perceptualHash: string, threshold: number): Promise<ImageCache | null>;
  cacheImageResult(data: InsertImageCache): Promise<ImageCache>;
  incrementCacheUsage(id: string): Promise<void>;
  updateCachedTranslation(id: string, language: "en" | "ja", itemName: string): Promise<void>;
  logScanEvent(event: InsertTrashScanEvent): Promise<TrashScanEvent>;
  getScanEventByScanId(scanId: string): Promise<TrashScanEvent | null>;
  getScanEvents(limit?: number): Promise<TrashScanEvent[]>;
  getScanEventsByCity(city: string): Promise<TrashScanEvent[]>;
  getScanEventsByCategory(category: string): Promise<TrashScanEvent[]>;
  getScanEventsByDateRange(startDate: string, endDate: string): Promise<TrashScanEvent[]>;
  getAnalyticsSummary(): Promise<{
    totalScans: number;
    cacheHitRate: number;
    scansByCategory: Record<string, number>;
    scansByCity: Record<string, number>;
    scansByLanguage: Record<string, number>;
  }>;
  clearTable(tableName: "feedback" | "imageCache" | "trashScanEvents" | "analyticsEvents"): Promise<void>;
  
  // User personal stats
  getUserStats(userId: string): Promise<UserStats>;
  
  // Analytics events methods
  logAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(limit?: number): Promise<AnalyticsEvent[]>;
  getEventCounts(startDate?: string, endDate?: string): Promise<Record<string, number>>;
  getUniqueUsers(startDate?: string, endDate?: string): Promise<number>;
  getDailyActiveUsers(days: number): Promise<Array<{ date: string; count: number }>>;
  getFunnelAnalytics(): Promise<{
    scanStarted: number;
    scanCompleted: number;
    classificationFinalized: number;
    dropOffRates: { startToComplete: number; completeToFinalized: number };
    distinctSessions: { started: number; completed: number; finalized: number };
  }>;
  getClarificationAnalytics(): Promise<{
    totalClarificationsShown: number;
    clarificationsByType: Record<string, number>;
    clarificationRate: number;
  }>;
  getFeedbackAnalytics(): Promise<{
    totalFeedback: number;
    helpfulCount: number;
    notHelpfulCount: number;
    notSureCount: number;
  }>;
  getPostScanFeedbackList(limit?: number): Promise<Array<{
    id: string;
    helpful: boolean | null;
    category: string | null;
    itemName: string | null;
    timestamp: Date;
    sessionId: string | null;
    pilotLocationId: string | null;
  }>>;
  
  // User retention analytics
  getUserRetentionAnalytics(): Promise<{
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
  }>;
  
  // Challenge anti-abuse methods
  validateChallengeScan(userId: string, perceptualHash: string, confidence: number): Promise<{
    isValid: boolean;
    reason?: 'duplicate_cooldown' | 'daily_cap' | 'low_confidence';
    dailyCount?: number;
    lastSimilarScanAt?: string;
  }>;
  recordChallengeScan(scan: InsertChallengeScan): Promise<ChallengeScan>;
  getChallengeLeaderboard(month: string, limit?: number): Promise<Array<{
    anonymousUserId: string;
    validScans: number;
    totalScans: number;
    uniqueCategories: number;
    avgConfidence: number;
  }>>;
  getUserChallengeStats(userId: string, month: string): Promise<{
    validScans: number;
    totalScans: number;
    todayScans: number;
    streak: number;
    rank: number;
  }>;
  
  // ============================================
  // IMPACT REPORT METHODS
  // ============================================
  
  // Location management
  createImpactLocation(location: InsertImpactLocation): Promise<ImpactLocation>;
  getImpactLocation(id: string): Promise<ImpactLocation | undefined>;
  getAllImpactLocations(): Promise<ImpactLocation[]>;
  updateImpactLocationBaseline(id: string, startDate: string, endDate: string): Promise<ImpactLocation>;
  
  // Ruleset management
  createRuleset(ruleset: InsertRuleset): Promise<Ruleset>;
  getRulesetHistory(locationId: string): Promise<Ruleset[]>;
  
  // Session management
  createImpactSession(session: InsertImpactSession): Promise<ImpactSession>;
  endImpactSession(sessionId: string): Promise<void>;
  
  // Outcome tracking
  recordOutcome(outcome: InsertOutcome): Promise<Outcome>;
  
  // Impact KPIs
  getImpactKPIs(locationId?: string, startDate?: string, endDate?: string): Promise<{
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
  }>;
  
  getWeeklyTrends(locationId?: string, weeks?: number): Promise<Array<{
    weekStart: string;
    uniqueUsers: number;
    sessions: number;
    guidanceAcceptanceRate: number;
    confusionRate: number;
  }>>;
  
  getBaselineComparison(locationId: string): Promise<{
    baseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    postBaseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    improvement: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
  } | null>;
  
  // Export data
  exportImpactEvents(locationId?: string, startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>>;
  exportImpactKPISummary(locationId?: string): Promise<Record<string, unknown>>;
  
  // ============================================
  // IMPACT ANALYTICS ENGINE METHODS
  // ============================================
  
  // Log impact for a scan
  logScanImpact(impact: InsertScanImpact): Promise<ScanImpact>;
  
  // Backfill historical scans with impact data
  backfillScanImpacts(): Promise<{ processed: number; impacted: number }>;
  
  // Get aggregated impact summary
  getImpactSummary(locationId?: string, startDate?: string, endDate?: string): Promise<ImpactSummary>;
  
  // Get impact by location for comparison
  getImpactByLocation(): Promise<Array<{
    location: string;
    scans: number;
    misSortsPrevented: number;
    avoidedCostJpy: number;
    avoidedCo2eKg: number;
  }>>;
  
  // Get daily impact trend
  getDailyImpactTrend(days: number): Promise<Array<{
    date: string;
    scans: number;
    misSortsPrevented: number;
    avoidedCo2eKg: number;
    avoidedCostJpy: number;
  }>>;
  
  // Export impact data for audit
  exportImpactAnalytics(startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>>;
  
  // ============================================
  // ANALYTICS HEALTH & CONSISTENCY METHODS
  // ============================================
  
  // Get count of scan events (single source of truth for scans)
  getScanEventCount(): Promise<number>;
  
  // Get count of analytics events
  getAnalyticsEventCount(): Promise<number>;
  
  // Get analytics events count grouped by namespace
  getAnalyticsEventsByNamespace(): Promise<Record<string, number>>;
}

function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private feedbacks: Feedback[];
  private imageCaches: ImageCache[];
  private scanEvents: TrashScanEvent[];
  private analyticsEventsList: AnalyticsEvent[];

  constructor() {
    this.users = new Map();
    this.feedbacks = [];
    this.imageCaches = [];
    this.scanEvents = [];
    this.analyticsEventsList = [];
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const newFeedback: Feedback = { ...insertFeedback, id, timestamp, pinned: false };
    this.feedbacks.push(newFeedback);
    return newFeedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return [...this.feedbacks].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }

  async deleteFeedback(id: string): Promise<void> {
    const index = this.feedbacks.findIndex((f) => f.id === id);
    if (index !== -1) {
      this.feedbacks.splice(index, 1);
    }
  }

  async deleteAllFeedback(): Promise<void> {
    this.feedbacks = [];
  }

  async togglePinFeedback(id: string): Promise<Feedback> {
    const index = this.feedbacks.findIndex((f) => f.id === id);
    if (index === -1) {
      throw new Error("Feedback not found");
    }
    const current = this.feedbacks[index];
    const updated = { ...current, pinned: !current.pinned };
    this.feedbacks[index] = updated;
    return updated;
  }

  async findSimilarImage(perceptualHash: string, threshold: number): Promise<ImageCache | null> {
    let bestMatch: ImageCache | null = null;
    let bestSimilarity = 0;

    for (const cached of this.imageCaches) {
      const distance = hammingDistance(perceptualHash, cached.perceptualHash);
      const maxDistance = perceptualHash.length;
      const similarity = (maxDistance - distance) / maxDistance;
      
      if (similarity >= threshold && similarity > bestSimilarity) {
        bestMatch = { ...cached };
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  async cacheImageResult(data: InsertImageCache): Promise<ImageCache> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const newCache: ImageCache = { 
      ...data, 
      id, 
      timestamp, 
      timesUsed: 1,
      itemNameEn: data.itemNameEn ?? null,
      itemNameJa: data.itemNameJa ?? null
    };
    this.imageCaches.push(newCache);
    return { ...newCache };
  }

  async incrementCacheUsage(id: string): Promise<void> {
    const index = this.imageCaches.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.imageCaches[index] = {
        ...this.imageCaches[index],
        timesUsed: this.imageCaches[index].timesUsed + 1
      };
    }
  }

  async updateCachedTranslation(id: string, language: "en" | "ja", itemName: string): Promise<void> {
    const index = this.imageCaches.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.imageCaches[index] = {
        ...this.imageCaches[index],
        [language === "en" ? "itemNameEn" : "itemNameJa"]: itemName
      };
    }
  }

  async logScanEvent(insertEvent: InsertTrashScanEvent): Promise<TrashScanEvent> {
    const id = randomUUID();
    const capturedAt = new Date().toISOString();
    const event: TrashScanEvent = { 
      ...insertEvent, 
      id, 
      capturedAt,
      scanId: insertEvent.scanId ?? null,
      userAgent: insertEvent.userAgent ?? null,
      city: insertEvent.city ?? null,
      latitude: insertEvent.latitude ?? null,
      longitude: insertEvent.longitude ?? null,
      locationSource: insertEvent.locationSource ?? null,
      thumbnailRef: insertEvent.thumbnailRef ?? null,
      pilotLocationId: insertEvent.pilotLocationId ?? null,
    };
    this.scanEvents.push(event);
    return { ...event };
  }

  async getScanEventByScanId(scanId: string): Promise<TrashScanEvent | null> {
    return this.scanEvents.find(e => e.scanId === scanId) ?? null;
  }

  async getScanEvents(limit?: number): Promise<TrashScanEvent[]> {
    const sorted = [...this.scanEvents].sort((a, b) => 
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getScanEventsByCity(city: string): Promise<TrashScanEvent[]> {
    return [...this.scanEvents]
      .filter(e => e.city === city)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getScanEventsByCategory(category: string): Promise<TrashScanEvent[]> {
    return [...this.scanEvents]
      .filter(e => e.detectedCategory === category)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getScanEventsByDateRange(startDate: string, endDate: string): Promise<TrashScanEvent[]> {
    return [...this.scanEvents]
      .filter(e => e.capturedAt >= startDate && e.capturedAt <= endDate)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getAnalyticsSummary(): Promise<{
    totalScans: number;
    cacheHitRate: number;
    scansByCategory: Record<string, number>;
    scansByCity: Record<string, number>;
    scansByLanguage: Record<string, number>;
  }> {
    const totalScans = this.scanEvents.length;
    const cacheHits = this.scanEvents.filter(e => e.resultSource === 'cache').length;
    const cacheHitRate = totalScans > 0 ? cacheHits / totalScans : 0;

    const scansByCategory: Record<string, number> = {};
    const scansByCity: Record<string, number> = {};
    const scansByLanguage: Record<string, number> = {};

    for (const event of this.scanEvents) {
      scansByCategory[event.detectedCategory] = (scansByCategory[event.detectedCategory] || 0) + 1;
      if (event.city) {
        scansByCity[event.city] = (scansByCity[event.city] || 0) + 1;
      }
      scansByLanguage[event.language] = (scansByLanguage[event.language] || 0) + 1;
    }

    return {
      totalScans,
      cacheHitRate,
      scansByCategory,
      scansByCity,
      scansByLanguage
    };
  }

  async clearTable(tableName: "feedback" | "imageCache" | "trashScanEvents" | "analyticsEvents"): Promise<void> {
    switch (tableName) {
      case "feedback":
        this.feedbacks = [];
        break;
      case "imageCache":
        this.imageCaches = [];
        break;
      case "trashScanEvents":
        this.scanEvents = [];
        break;
      case "analyticsEvents":
        this.analyticsEventsList = [];
        break;
    }
  }

  async logAnalyticsEvent(insertEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const event: AnalyticsEvent = { 
      ...insertEvent, 
      id, 
      createdAt,
      namespace: insertEvent.namespace ?? 'app',
      pilotLocationId: insertEvent.pilotLocationId ?? null,
      payload: insertEvent.payload ?? null,
    };
    this.analyticsEventsList.push(event);
    return { ...event };
  }

  async getAnalyticsEvents(limit?: number): Promise<AnalyticsEvent[]> {
    const sorted = [...this.analyticsEventsList].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getEventCounts(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    // Filter by namespace='app' only - exclude website events from admin metrics
    let events = this.analyticsEventsList.filter(e => e.namespace === 'app');
    if (startDate) events = events.filter(e => e.createdAt >= startDate);
    if (endDate) events = events.filter(e => e.createdAt <= endDate);
    
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.eventName] = (counts[event.eventName] || 0) + 1;
    }
    return counts;
  }

  async getUniqueUsers(startDate?: string, endDate?: string): Promise<number> {
    // Filter by namespace='app' only - exclude website events from admin metrics
    let events = this.analyticsEventsList.filter(e => e.namespace === 'app');
    if (startDate) events = events.filter(e => e.createdAt >= startDate);
    if (endDate) events = events.filter(e => e.createdAt <= endDate);
    
    const uniqueUsers = new Set(events.map(e => e.anonymousUserId));
    return uniqueUsers.size;
  }

  async getDailyActiveUsers(days: number): Promise<Array<{ date: string; count: number }>> {
    const now = new Date();
    const result: Array<{ date: string; count: number }> = [];
    // Filter by namespace='app' only - exclude website events from admin metrics
    const appEvents = this.analyticsEventsList.filter(e => e.namespace === 'app');
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const usersOnDay = new Set(
        appEvents
          .filter(e => e.createdAt.startsWith(dateStr))
          .map(e => e.anonymousUserId)
      );
      
      result.push({ date: dateStr, count: usersOnDay.size });
    }
    
    return result;
  }

  async getFunnelAnalytics(): Promise<{
    scanStarted: number;
    scanCompleted: number;
    classificationFinalized: number;
    dropOffRates: { startToComplete: number; completeToFinalized: number };
    distinctSessions: { started: number; completed: number; finalized: number };
  }> {
    // Filter by namespace='app' only - exclude website events from admin metrics
    const appEvents = this.analyticsEventsList.filter(e => e.namespace === 'app');
    const scanStarted = appEvents.filter(e => e.eventName === 'scan_started').length;
    const scanCompleted = appEvents.filter(e => e.eventName === 'scan_completed').length;
    const classificationFinalized = appEvents.filter(e => e.eventName === 'classification_finalized').length;
    
    // Count distinct sessions
    const sessionsStarted = new Set(appEvents.filter(e => e.eventName === 'scan_started').map(e => e.sessionId));
    const sessionsCompleted = new Set(appEvents.filter(e => e.eventName === 'scan_completed').map(e => e.sessionId));
    const sessionsFinalized = new Set(appEvents.filter(e => e.eventName === 'classification_finalized').map(e => e.sessionId));
    
    const startedCount = sessionsStarted.size;
    const completedCount = sessionsCompleted.size;
    const finalizedCount = sessionsFinalized.size;
    
    return {
      scanStarted,
      scanCompleted,
      classificationFinalized,
      dropOffRates: {
        startToComplete: startedCount > 0 ? 1 - (completedCount / startedCount) : 0,
        completeToFinalized: completedCount > 0 ? 1 - (finalizedCount / completedCount) : 0,
      },
      distinctSessions: {
        started: startedCount,
        completed: completedCount,
        finalized: finalizedCount,
      }
    };
  }

  async getClarificationAnalytics(): Promise<{
    totalClarificationsShown: number;
    clarificationsByType: Record<string, number>;
    clarificationRate: number;
  }> {
    const clarifications = this.analyticsEventsList.filter(e => e.eventName === 'clarification_shown');
    const scans = this.analyticsEventsList.filter(e => e.eventName === 'scan_completed').length;
    
    const clarificationsByType: Record<string, number> = {};
    for (const event of clarifications) {
      try {
        const payload = JSON.parse(event.payload || '{}');
        const type = payload.type || 'unknown';
        clarificationsByType[type] = (clarificationsByType[type] || 0) + 1;
      } catch {
        clarificationsByType['unknown'] = (clarificationsByType['unknown'] || 0) + 1;
      }
    }
    
    return {
      totalClarificationsShown: clarifications.length,
      clarificationsByType,
      clarificationRate: scans > 0 ? clarifications.length / scans : 0,
    };
  }

  async getFeedbackAnalytics(): Promise<{
    totalFeedback: number;
    helpfulCount: number;
    notHelpfulCount: number;
    notSureCount: number;
  }> {
    const feedbackEvents = this.analyticsEventsList.filter(e => e.eventName === 'feedback_submitted');
    let helpfulCount = 0, notHelpfulCount = 0, notSureCount = 0;
    
    for (const event of feedbackEvents) {
      try {
        const payload = JSON.parse(event.payload || '{}');
        if (payload.helpful === true) helpfulCount++;
        else if (payload.helpful === false) notHelpfulCount++;
        else notSureCount++;
      } catch {
        notSureCount++;
      }
    }
    
    return {
      totalFeedback: feedbackEvents.length,
      helpfulCount,
      notHelpfulCount,
      notSureCount,
    };
  }

  async getPostScanFeedbackList(limit?: number): Promise<Array<{
    id: string;
    helpful: boolean | null;
    category: string | null;
    itemName: string | null;
    timestamp: Date;
    sessionId: string | null;
    pilotLocationId: string | null;
  }>> {
    const feedbackEvents = this.analyticsEventsList
      .filter(e => e.eventName === 'feedback_submitted')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const limited = limit ? feedbackEvents.slice(0, limit) : feedbackEvents;
    
    return limited.map(event => {
      let payload: { helpful?: boolean | null; category?: string; itemName?: string } = {};
      try {
        payload = JSON.parse(event.payload || '{}');
      } catch {}
      
      return {
        id: event.id,
        helpful: payload.helpful ?? null,
        category: payload.category || null,
        itemName: payload.itemName || null,
        timestamp: new Date(event.createdAt),
        sessionId: event.sessionId,
        pilotLocationId: event.pilotLocationId,
      };
    });
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const userEvents = this.analyticsEventsList.filter(
      e => e.anonymousUserId === userId && e.eventName === 'scan_completed'
    );
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCount = userEvents.filter(
      e => new Date(e.createdAt) >= todayStart
    ).length;
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyBreakdown: Array<{ date: string; dayName: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const count = userEvents.filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= dayStart && eventDate < dayEnd;
      }).length;
      
      weeklyBreakdown.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        count,
      });
    }
    
    const activeDatesSet = new Set(
      userEvents.map(e => new Date(e.createdAt).toISOString().split('T')[0])
    );
    const totalActiveDays = activeDatesSet.size;
    
    const sortedDates = Array.from(activeDatesSet).sort().reverse();
    let currentStreak = 0;
    let checkDate = new Date(now);
    
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (activeDatesSet.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }
    
    return {
      todayCount,
      weeklyBreakdown,
      totalActiveDays,
      currentStreak,
      longestStreak,
      totalScans: userEvents.length,
    };
  }

  async getUserRetentionAnalytics(): Promise<{
    totalUniqueUsers: number;
    returningUsers: number;
    oneTimeUsers: number;
    returnRate: number;
    powerUsers: number;
    monthlyCohorts: Array<{ month: string; newUsers: number; returnedFromPrevious: number }>;
    usersByVisitCount: Array<{ visits: string; count: number }>;
  }> {
    const userVisits = new Map<string, Set<string>>();
    
    for (const event of this.analyticsEventsList) {
      const userId = event.anonymousUserId;
      const date = new Date(event.createdAt).toISOString().split('T')[0];
      if (!userVisits.has(userId)) {
        userVisits.set(userId, new Set());
      }
      userVisits.get(userId)!.add(date);
    }
    
    const totalUniqueUsers = userVisits.size;
    let returningUsers = 0;
    let powerUsers = 0;
    const visitCounts: Record<string, number> = {};
    
    Array.from(userVisits.entries()).forEach(([, dates]) => {
      const visitCount = dates.size;
      if (visitCount > 1) returningUsers++;
      if (visitCount >= 3) powerUsers++;
      const bucket = visitCount >= 5 ? '5+' : String(visitCount);
      visitCounts[bucket] = (visitCounts[bucket] || 0) + 1;
    });
    
    const oneTimeUsers = totalUniqueUsers - returningUsers;
    const returnRate = totalUniqueUsers > 0 ? Math.round((returningUsers / totalUniqueUsers) * 1000) / 10 : 0;
    
    return {
      totalUniqueUsers,
      returningUsers,
      oneTimeUsers,
      returnRate,
      powerUsers,
      monthlyCohorts: [],
      usersByVisitCount: Object.entries(visitCounts).map(([visits, count]) => ({ visits, count })),
    };
  }

  // Challenge anti-abuse methods (MemStorage implementation)
  private challengeScansList: ChallengeScan[] = [];

  async validateChallengeScan(userId: string, perceptualHash: string, confidence: number): Promise<{
    isValid: boolean;
    reason?: 'duplicate_cooldown' | 'daily_cap' | 'low_confidence';
    dailyCount?: number;
    lastSimilarScanAt?: string;
  }> {
    // Check confidence threshold
    if (confidence < CHALLENGE_CONFIG.MIN_CONFIDENCE_THRESHOLD) {
      return { isValid: false, reason: 'low_confidence' };
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Check daily cap
    const todayScans = this.challengeScansList.filter(s => 
      s.anonymousUserId === userId && 
      new Date(s.scannedAt) >= todayStart &&
      s.isValid
    );
    if (todayScans.length >= CHALLENGE_CONFIG.DAILY_SCAN_CAP) {
      return { isValid: false, reason: 'daily_cap', dailyCount: todayScans.length };
    }

    // Check duplicate cooldown
    const cooldownTime = new Date(now.getTime() - CHALLENGE_CONFIG.DUPLICATE_COOLDOWN_MINUTES * 60 * 1000);
    const recentSimilar = this.challengeScansList.find(s => 
      s.anonymousUserId === userId &&
      s.perceptualHash === perceptualHash &&
      new Date(s.scannedAt) >= cooldownTime
    );
    if (recentSimilar) {
      return { isValid: false, reason: 'duplicate_cooldown', lastSimilarScanAt: recentSimilar.scannedAt };
    }

    return { isValid: true, dailyCount: todayScans.length };
  }

  async recordChallengeScan(scan: InsertChallengeScan): Promise<ChallengeScan> {
    const newScan: ChallengeScan = {
      ...scan,
      id: randomUUID(),
      scannedAt: new Date().toISOString(),
      isValid: scan.isValid ?? true,
      invalidReason: scan.invalidReason ?? null,
    };
    this.challengeScansList.push(newScan);
    return newScan;
  }

  async getChallengeLeaderboard(month: string, limit: number = 20): Promise<Array<{
    anonymousUserId: string;
    validScans: number;
    totalScans: number;
    uniqueCategories: number;
    avgConfidence: number;
  }>> {
    const monthScans = this.challengeScansList.filter(s => s.challengeMonth === month);
    const userStats = new Map<string, { valid: number; total: number; categories: Set<string>; confidenceSum: number }>();

    for (const scan of monthScans) {
      if (!userStats.has(scan.anonymousUserId)) {
        userStats.set(scan.anonymousUserId, { valid: 0, total: 0, categories: new Set(), confidenceSum: 0 });
      }
      const stats = userStats.get(scan.anonymousUserId)!;
      stats.total++;
      if (scan.isValid) {
        stats.valid++;
        stats.categories.add(scan.category);
        stats.confidenceSum += scan.confidence;
      }
    }

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        anonymousUserId: userId,
        validScans: stats.valid,
        totalScans: stats.total,
        uniqueCategories: stats.categories.size,
        avgConfidence: stats.valid > 0 ? Math.round((stats.confidenceSum / stats.valid) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.validScans - a.validScans)
      .slice(0, limit);
  }

  async getUserChallengeStats(userId: string, month: string): Promise<{
    validScans: number;
    totalScans: number;
    todayScans: number;
    streak: number;
    rank: number;
  }> {
    const userScans = this.challengeScansList.filter(s => s.anonymousUserId === userId && s.challengeMonth === month);
    const validScans = userScans.filter(s => s.isValid).length;
    const totalScans = userScans.length;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayScans = userScans.filter(s => new Date(s.scannedAt) >= todayStart && s.isValid).length;

    const leaderboard = await this.getChallengeLeaderboard(month, 1000);
    const rank = leaderboard.findIndex(u => u.anonymousUserId === userId) + 1;

    return { validScans, totalScans, todayScans, streak: 0, rank: rank || leaderboard.length + 1 };
  }

  // ============================================
  // IMPACT REPORT METHODS (MemStorage stubs)
  // ============================================
  
  private impactLocationsList: ImpactLocation[] = [];
  private rulesetsList: Ruleset[] = [];
  private impactSessionsList: ImpactSession[] = [];
  private outcomesList: Outcome[] = [];

  async createImpactLocation(location: InsertImpactLocation): Promise<ImpactLocation> {
    const newLocation: ImpactLocation = {
      ...location,
      country: location.country ?? "Japan",
      city: location.city ?? "Beppu",
      rulesetVersion: location.rulesetVersion ?? "1.0",
      baselineStartDate: location.baselineStartDate ?? null,
      baselineEndDate: location.baselineEndDate ?? null,
      createdAt: new Date().toISOString(),
      isActive: location.isActive ?? true,
    };
    this.impactLocationsList.push(newLocation);
    return newLocation;
  }

  async getImpactLocation(id: string): Promise<ImpactLocation | undefined> {
    return this.impactLocationsList.find(l => l.id === id);
  }

  async getAllImpactLocations(): Promise<ImpactLocation[]> {
    return [...this.impactLocationsList];
  }

  async updateImpactLocationBaseline(id: string, startDate: string, endDate: string): Promise<ImpactLocation> {
    const location = this.impactLocationsList.find(l => l.id === id);
    if (!location) throw new Error("Location not found");
    location.baselineStartDate = startDate;
    location.baselineEndDate = endDate;
    return location;
  }

  async createRuleset(ruleset: InsertRuleset): Promise<Ruleset> {
    const newRuleset: Ruleset = {
      ...ruleset,
      id: randomUUID(),
      effectiveTo: ruleset.effectiveTo ?? null,
      changedFields: ruleset.changedFields ?? null,
      createdAt: new Date().toISOString(),
    };
    this.rulesetsList.push(newRuleset);
    return newRuleset;
  }

  async getRulesetHistory(locationId: string): Promise<Ruleset[]> {
    return this.rulesetsList.filter(r => r.locationId === locationId);
  }

  async createImpactSession(session: InsertImpactSession): Promise<ImpactSession> {
    const newSession: ImpactSession = {
      ...session,
      id: randomUUID(),
      locationId: session.locationId ?? null,
      startedAt: new Date().toISOString(),
      endedAt: session.endedAt ?? null,
      language: session.language ?? "en",
      platform: session.platform ?? null,
      isBaseline: session.isBaseline ?? false,
    };
    this.impactSessionsList.push(newSession);
    return newSession;
  }

  async endImpactSession(sessionId: string): Promise<void> {
    const session = this.impactSessionsList.find(s => s.id === sessionId);
    if (session) {
      session.endedAt = new Date().toISOString();
    }
  }

  async recordOutcome(outcome: InsertOutcome): Promise<Outcome> {
    const newOutcome: Outcome = {
      ...outcome,
      id: randomUUID(),
      locationId: outcome.locationId ?? null,
      category: outcome.category ?? null,
      confidenceBucket: outcome.confidenceBucket ?? null,
      resolutionTimeMs: outcome.resolutionTimeMs ?? null,
      selfReported: outcome.selfReported ?? true,
      createdAt: new Date().toISOString(),
    };
    this.outcomesList.push(newOutcome);
    return newOutcome;
  }

  async getImpactKPIs(locationId?: string, startDate?: string, endDate?: string): Promise<{
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
  }> {
    // Filter events by date range and location
    let events = this.analyticsEventsList;
    if (locationId) events = events.filter(e => e.pilotLocationId === locationId);
    if (startDate) events = events.filter(e => e.createdAt >= startDate);
    if (endDate) events = events.filter(e => e.createdAt <= endDate);

    const uniqueUsers = new Set(events.map(e => e.anonymousUserId)).size;
    const guidanceShown = events.filter(e => e.eventName === 'guidance_shown' || e.eventName === 'scan_completed').length;
    const guidanceConfirmed = events.filter(e => e.eventName === 'guidance_confirmed').length;
    const guidanceRejected = events.filter(e => e.eventName === 'guidance_rejected').length;
    const disposalCompleted = events.filter(e => e.eventName === 'disposal_completed').length;

    // Calculate returning vs new users
    const userFirstSeen = new Map<string, string>();
    for (const e of events) {
      if (!userFirstSeen.has(e.anonymousUserId) || e.createdAt < userFirstSeen.get(e.anonymousUserId)!) {
        userFirstSeen.set(e.anonymousUserId, e.createdAt);
      }
    }
    const newUsers = Array.from(userFirstSeen.values()).filter(d => (!startDate || d >= startDate) && (!endDate || d <= endDate)).length;
    const returningUsers = uniqueUsers - newUsers;

    // Resolution times from outcomes
    const resolutionTimes = this.outcomesList
      .filter(o => o.resolutionTimeMs && (!locationId || o.locationId === locationId))
      .map(o => o.resolutionTimeMs!)
      .sort((a, b) => a - b);
    const medianResolutionTimeMs = resolutionTimes.length > 0 
      ? resolutionTimes[Math.floor(resolutionTimes.length / 2)] 
      : 0;

    // Top confusing items from scan events with multiple queries
    const itemCounts: Record<string, number> = {};
    for (const e of events.filter(e => e.eventName === 'scan_completed')) {
      try {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        if (payload.itemName) {
          itemCounts[payload.itemName] = (itemCounts[payload.itemName] || 0) + 1;
        }
      } catch {}
    }
    const topConfusingItems = Object.entries(itemCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Scans by category
    const scansByCategory: Record<string, number> = {};
    for (const e of events.filter(e => e.eventName === 'scan_completed')) {
      try {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        if (payload.category) {
          scansByCategory[payload.category] = (scansByCategory[payload.category] || 0) + 1;
        }
      } catch {}
    }

    // Calculate confusion rate from clarification events
    const clarificationEvents = events.filter(e => e.eventName === 'clarification_shown');
    const confusionRate = guidanceShown > 0 ? Math.round((clarificationEvents.length / guidanceShown) * 1000) / 10 : 0;

    return {
      uniqueUsers,
      totalSessions: new Set(events.map(e => e.sessionId)).size,
      guidanceShown,
      guidanceConfirmed,
      guidanceRejected,
      guidanceAcceptanceRate: guidanceShown > 0 ? Math.round((guidanceConfirmed / guidanceShown) * 1000) / 10 : 0,
      completionRate: guidanceShown > 0 ? Math.round((disposalCompleted / guidanceShown) * 1000) / 10 : 0,
      medianResolutionTimeMs,
      confusionRate,
      returningUsers,
      newUsers,
      topConfusingItems,
      scansByCategory,
    };
  }

  async getWeeklyTrends(locationId?: string, weeks: number = 12): Promise<Array<{
    weekStart: string;
    uniqueUsers: number;
    sessions: number;
    guidanceAcceptanceRate: number;
    confusionRate: number;
  }>> {
    const now = new Date();
    const trends: Array<{
      weekStart: string;
      uniqueUsers: number;
      sessions: number;
      guidanceAcceptanceRate: number;
      confusionRate: number;
    }> = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let events = this.analyticsEventsList.filter(e => 
        e.createdAt >= weekStart.toISOString() && 
        e.createdAt < weekEnd.toISOString()
      );
      if (locationId) events = events.filter(e => e.pilotLocationId === locationId);

      const guidanceShown = events.filter(e => e.eventName === 'guidance_shown' || e.eventName === 'scan_completed').length;
      const guidanceConfirmed = events.filter(e => e.eventName === 'guidance_confirmed').length;
      const clarificationEvents = events.filter(e => e.eventName === 'clarification_shown');

      trends.push({
        weekStart: weekStart.toISOString().split('T')[0],
        uniqueUsers: new Set(events.map(e => e.anonymousUserId)).size,
        sessions: new Set(events.map(e => e.sessionId)).size,
        guidanceAcceptanceRate: guidanceShown > 0 ? Math.round((guidanceConfirmed / guidanceShown) * 1000) / 10 : 0,
        confusionRate: guidanceShown > 0 ? Math.round((clarificationEvents.length / guidanceShown) * 1000) / 10 : 0,
      });
    }

    return trends;
  }

  async getBaselineComparison(locationId: string): Promise<{
    baseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    postBaseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    improvement: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
  } | null> {
    const location = await this.getImpactLocation(locationId);
    if (!location?.baselineStartDate || !location?.baselineEndDate) return null;

    const baselineKPIs = await this.getImpactKPIs(locationId, location.baselineStartDate, location.baselineEndDate);
    const baselineDays = Math.ceil((new Date(location.baselineEndDate).getTime() - new Date(location.baselineStartDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;

    const postKPIs = await this.getImpactKPIs(locationId, location.baselineEndDate);
    const postDays = Math.ceil((Date.now() - new Date(location.baselineEndDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;

    return {
      baseline: {
        acceptanceRate: baselineKPIs.guidanceAcceptanceRate,
        confusionRate: baselineKPIs.confusionRate,
        usersPerDay: baselineKPIs.uniqueUsers / baselineDays,
      },
      postBaseline: {
        acceptanceRate: postKPIs.guidanceAcceptanceRate,
        confusionRate: postKPIs.confusionRate,
        usersPerDay: postKPIs.uniqueUsers / postDays,
      },
      improvement: {
        acceptanceRate: postKPIs.guidanceAcceptanceRate - baselineKPIs.guidanceAcceptanceRate,
        confusionRate: baselineKPIs.confusionRate - postKPIs.confusionRate, // Improvement = decrease
        usersPerDay: (postKPIs.uniqueUsers / postDays) - (baselineKPIs.uniqueUsers / baselineDays),
      },
    };
  }

  async exportImpactEvents(locationId?: string, startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>> {
    let events = this.analyticsEventsList;
    if (locationId) events = events.filter(e => e.pilotLocationId === locationId);
    if (startDate) events = events.filter(e => e.createdAt >= startDate);
    if (endDate) events = events.filter(e => e.createdAt <= endDate);
    return events.map(e => ({ ...e }));
  }

  async exportImpactKPISummary(locationId?: string): Promise<Record<string, unknown>> {
    const kpis = await this.getImpactKPIs(locationId);
    const trends = await this.getWeeklyTrends(locationId);
    const locations = await this.getAllImpactLocations();
    
    return {
      generatedAt: new Date().toISOString(),
      timezone: IMPACT_REPORT_CONFIG.TIMEZONE,
      locationId: locationId || 'all',
      kpis,
      weeklyTrends: trends,
      locations: locations.map(l => ({ id: l.id, name: l.name, type: l.type })),
    };
  }

  // ============================================
  // IMPACT ANALYTICS ENGINE (MemStorage stubs)
  // ============================================

  private scanImpactsList: ScanImpact[] = [];

  async logScanImpact(impact: InsertScanImpact): Promise<ScanImpact> {
    const id = randomUUID();
    const newImpact: ScanImpact = {
      id,
      scanEventId: impact.scanEventId,
      itemType: impact.itemType,
      category: impact.category,
      location: impact.location ?? null,
      confidenceScore: impact.confidenceScore,
      misSortPrevented: impact.misSortPrevented ?? false,
      avoidedMassKg: impact.avoidedMassKg ?? 0,
      avoidedCostJpy: impact.avoidedCostJpy ?? 0,
      avoidedCo2eKg: impact.avoidedCo2eKg ?? 0,
      baselineMisSortRate: impact.baselineMisSortRate,
      disposalCostPerTon: impact.disposalCostPerTon,
      emissionFactor: impact.emissionFactor,
      contaminationMultiplier: impact.contaminationMultiplier,
      createdAt: new Date().toISOString(),
    };
    this.scanImpactsList.push(newImpact);
    return newImpact;
  }

  async backfillScanImpacts(): Promise<{ processed: number; impacted: number }> {
    let processed = 0;
    let impacted = 0;
    
    for (const scan of this.scanEvents) {
      const impact = calculateScanImpact(
        scan.detectedItemName,
        scan.detectedCategory,
        scan.confidence,
        scan.city
      );
      
      await this.logScanImpact({
        scanEventId: scan.id,
        itemType: scan.detectedItemName,
        category: scan.detectedCategory,
        location: scan.city ?? null,
        confidenceScore: scan.confidence,
        misSortPrevented: impact.misSortPrevented,
        avoidedMassKg: impact.avoidedMassKg,
        avoidedCostJpy: impact.avoidedCostJpy,
        avoidedCo2eKg: impact.avoidedCo2eKg,
        baselineMisSortRate: IMPACT_CONFIG.BASELINE_MIS_SORT_RATE,
        disposalCostPerTon: IMPACT_CONFIG.DISPOSAL_COST_PER_TON_JPY,
        emissionFactor: IMPACT_CONFIG.INCINERATION_EMISSION_FACTOR,
        contaminationMultiplier: IMPACT_CONFIG.CONTAMINATION_MULTIPLIER,
      });
      
      processed++;
      if (impact.misSortPrevented) impacted++;
    }
    
    return { processed, impacted };
  }

  async getImpactSummary(locationId?: string, startDate?: string, endDate?: string): Promise<ImpactSummary> {
    let impacts = this.scanImpactsList;
    if (locationId) impacts = impacts.filter(i => i.location === locationId);
    if (startDate) impacts = impacts.filter(i => i.createdAt >= startDate);
    if (endDate) impacts = impacts.filter(i => i.createdAt <= endDate);

    const totalScans = impacts.length;
    const totalMisSortsPrevented = impacts.filter(i => i.misSortPrevented).length;
    const totalAvoidedMassKg = impacts.reduce((sum, i) => sum + i.avoidedMassKg, 0);
    const totalAvoidedCostJpy = impacts.reduce((sum, i) => sum + i.avoidedCostJpy, 0);
    const totalAvoidedCo2eKg = impacts.reduce((sum, i) => sum + i.avoidedCo2eKg, 0);

    const impactByCategory: Record<string, any> = {};
    const impactByLocation: Record<string, any> = {};

    for (const impact of impacts) {
      if (!impactByCategory[impact.category]) {
        impactByCategory[impact.category] = { scans: 0, misSortsPrevented: 0, avoidedMassKg: 0, avoidedCostJpy: 0, avoidedCo2eKg: 0 };
      }
      impactByCategory[impact.category].scans++;
      if (impact.misSortPrevented) impactByCategory[impact.category].misSortsPrevented++;
      impactByCategory[impact.category].avoidedMassKg += impact.avoidedMassKg;
      impactByCategory[impact.category].avoidedCostJpy += impact.avoidedCostJpy;
      impactByCategory[impact.category].avoidedCo2eKg += impact.avoidedCo2eKg;

      const loc = impact.location || 'Unknown';
      if (!impactByLocation[loc]) {
        impactByLocation[loc] = { scans: 0, misSortsPrevented: 0, avoidedCostJpy: 0, avoidedCo2eKg: 0 };
      }
      impactByLocation[loc].scans++;
      if (impact.misSortPrevented) impactByLocation[loc].misSortsPrevented++;
      impactByLocation[loc].avoidedCostJpy += impact.avoidedCostJpy;
      impactByLocation[loc].avoidedCo2eKg += impact.avoidedCo2eKg;
    }

    return {
      totalScans,
      totalMisSortsPrevented,
      totalAvoidedMassKg,
      totalAvoidedCostJpy,
      totalAvoidedCo2eKg,
      preventionRate: totalScans > 0 ? (totalMisSortsPrevented / totalScans) * 100 : 0,
      avgCostSavedPerScan: totalScans > 0 ? totalAvoidedCostJpy / totalScans : 0,
      avgCo2eSavedPerScan: totalScans > 0 ? totalAvoidedCo2eKg / totalScans : 0,
      impactByCategory,
      impactByLocation,
      trend30Days: [],
    };
  }

  async getImpactByLocation(): Promise<Array<{ location: string; scans: number; misSortsPrevented: number; avoidedCostJpy: number; avoidedCo2eKg: number }>> {
    const summary = await this.getImpactSummary();
    return Object.entries(summary.impactByLocation).map(([location, data]) => ({
      location,
      ...data,
    }));
  }

  async getDailyImpactTrend(days: number): Promise<Array<{ date: string; scans: number; misSortsPrevented: number; avoidedCo2eKg: number; avoidedCostJpy: number }>> {
    const result: Record<string, { scans: number; misSortsPrevented: number; avoidedCo2eKg: number; avoidedCostJpy: number }> = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    for (const impact of this.scanImpactsList) {
      if (new Date(impact.createdAt) < cutoff) continue;
      const date = impact.createdAt.substring(0, 10);
      if (!result[date]) {
        result[date] = { scans: 0, misSortsPrevented: 0, avoidedCo2eKg: 0, avoidedCostJpy: 0 };
      }
      result[date].scans++;
      if (impact.misSortPrevented) result[date].misSortsPrevented++;
      result[date].avoidedCo2eKg += impact.avoidedCo2eKg;
      result[date].avoidedCostJpy += impact.avoidedCostJpy;
    }

    return Object.entries(result)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async exportImpactAnalytics(startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>> {
    let impacts = this.scanImpactsList;
    if (startDate) impacts = impacts.filter(i => i.createdAt >= startDate);
    if (endDate) impacts = impacts.filter(i => i.createdAt <= endDate);
    return impacts.map(i => ({ ...i }));
  }

  async getScanEventCount(): Promise<number> {
    return this.scanEvents.length;
  }

  async getAnalyticsEventCount(): Promise<number> {
    return this.analyticsEventsList.length;
  }

  async getAnalyticsEventsByNamespace(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const event of this.analyticsEventsList) {
      const ns = event.namespace || 'null';
      counts[ns] = (counts[ns] || 0) + 1;
    }
    return counts;
  }
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(feedback).values(insertFeedback).returning();
    return result[0];
  }

  async getAllFeedback(): Promise<Feedback[]> {
    if (!db) throw new Error("Database not configured");
    return await db.select().from(feedback).orderBy(desc(feedback.pinned), feedback.timestamp);
  }

  async deleteFeedback(id: string): Promise<void> {
    if (!db) throw new Error("Database not configured");
    await db.delete(feedback).where(eq(feedback.id, id));
  }

  async deleteAllFeedback(): Promise<void> {
    if (!db) throw new Error("Database not configured");
    await db.delete(feedback);
  }

  async togglePinFeedback(id: string): Promise<Feedback> {
    if (!db) throw new Error("Database not configured");
    const current = await db.select().from(feedback).where(eq(feedback.id, id));
    if (!current[0]) {
      throw new Error("Feedback not found");
    }
    const updated = await db
      .update(feedback)
      .set({ pinned: !current[0].pinned })
      .where(eq(feedback.id, id))
      .returning();
    return updated[0];
  }

  async findSimilarImage(perceptualHash: string, threshold: number): Promise<ImageCache | null> {
    if (!db) throw new Error("Database not configured");
    
    // Limit results to recent 1000 entries to avoid full table scan on large databases
    const allCached = await db.select().from(imageCache).limit(1000);
    
    let bestMatch: ImageCache | null = null;
    let bestSimilarity = 0;
    const maxDistance = perceptualHash.length;
    const maxAllowedDistance = Math.floor(maxDistance * (1 - threshold));

    for (const cached of allCached) {
      const distance = hammingDistance(perceptualHash, cached.perceptualHash);
      
      // Early exit if distance exceeds threshold
      if (distance > maxAllowedDistance) continue;
      
      const similarity = (maxDistance - distance) / maxDistance;
      
      if (similarity > bestSimilarity) {
        bestMatch = cached;
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  async cacheImageResult(data: InsertImageCache): Promise<ImageCache> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(imageCache).values(data).returning();
    return result[0];
  }

  async incrementCacheUsage(id: string): Promise<void> {
    if (!db) throw new Error("Database not configured");
    const current = await db.select().from(imageCache).where(eq(imageCache.id, id));
    if (current[0]) {
      await db
        .update(imageCache)
        .set({ timesUsed: current[0].timesUsed + 1 })
        .where(eq(imageCache.id, id));
    }
  }

  async updateCachedTranslation(id: string, language: "en" | "ja", itemName: string): Promise<void> {
    if (!db) throw new Error("Database not configured");
    await db
      .update(imageCache)
      .set(language === "en" ? { itemNameEn: itemName } : { itemNameJa: itemName })
      .where(eq(imageCache.id, id));
  }

  async logScanEvent(insertEvent: InsertTrashScanEvent): Promise<TrashScanEvent> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(trashScanEvents).values(insertEvent).returning();
    return result[0];
  }

  async getScanEventByScanId(scanId: string): Promise<TrashScanEvent | null> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select().from(trashScanEvents).where(eq(trashScanEvents.scanId, scanId)).limit(1);
    return result[0] ?? null;
  }

  async getScanEvents(limit?: number): Promise<TrashScanEvent[]> {
    if (!db) throw new Error("Database not configured");
    const query = db.select().from(trashScanEvents).orderBy(desc(trashScanEvents.capturedAt));
    return limit ? await query.limit(limit) : await query;
  }

  async getScanEventsByCity(city: string): Promise<TrashScanEvent[]> {
    if (!db) throw new Error("Database not configured");
    return await db
      .select()
      .from(trashScanEvents)
      .where(eq(trashScanEvents.city, city))
      .orderBy(desc(trashScanEvents.capturedAt));
  }

  async getScanEventsByCategory(category: string): Promise<TrashScanEvent[]> {
    if (!db) throw new Error("Database not configured");
    return await db
      .select()
      .from(trashScanEvents)
      .where(eq(trashScanEvents.detectedCategory, category))
      .orderBy(desc(trashScanEvents.capturedAt));
  }

  async getScanEventsByDateRange(startDate: string, endDate: string): Promise<TrashScanEvent[]> {
    if (!db) throw new Error("Database not configured");
    return await db
      .select()
      .from(trashScanEvents)
      .where(and(
        gte(trashScanEvents.capturedAt, startDate),
        lte(trashScanEvents.capturedAt, endDate)
      ))
      .orderBy(desc(trashScanEvents.capturedAt));
  }

  async getAnalyticsSummary(): Promise<{
    totalScans: number;
    cacheHitRate: number;
    scansByCategory: Record<string, number>;
    scansByCity: Record<string, number>;
    scansByLanguage: Record<string, number>;
  }> {
    if (!db) throw new Error("Database not configured");
    
    const allEvents = await db.select().from(trashScanEvents);
    const totalScans = allEvents.length;
    const cacheHits = allEvents.filter(e => e.resultSource === 'cache').length;
    const cacheHitRate = totalScans > 0 ? cacheHits / totalScans : 0;

    const scansByCategory: Record<string, number> = {};
    const scansByCity: Record<string, number> = {};
    const scansByLanguage: Record<string, number> = {};

    for (const event of allEvents) {
      scansByCategory[event.detectedCategory] = (scansByCategory[event.detectedCategory] || 0) + 1;
      if (event.city) {
        scansByCity[event.city] = (scansByCity[event.city] || 0) + 1;
      }
      scansByLanguage[event.language] = (scansByLanguage[event.language] || 0) + 1;
    }

    return {
      totalScans,
      cacheHitRate,
      scansByCategory,
      scansByCity,
      scansByLanguage
    };
  }

  async clearTable(tableName: "feedback" | "imageCache" | "trashScanEvents" | "analyticsEvents"): Promise<void> {
    if (!db) throw new Error("Database not configured");
    
    switch (tableName) {
      case "feedback":
        await db.delete(feedback);
        break;
      case "imageCache":
        await db.delete(imageCache);
        break;
      case "trashScanEvents":
        await db.delete(trashScanEvents);
        break;
      case "analyticsEvents":
        await db.delete(analyticsEvents);
        break;
    }
  }

  async logAnalyticsEvent(insertEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(analyticsEvents).values(insertEvent).returning();
    return result[0];
  }

  async getAnalyticsEvents(limit?: number): Promise<AnalyticsEvent[]> {
    if (!db) throw new Error("Database not configured");
    const query = db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt));
    return limit ? await query.limit(limit) : await query;
  }

  async getEventCounts(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    if (!db) throw new Error("Database not configured");
    
    // Filter by namespace='app' only - exclude website events from admin metrics
    let query = db.select().from(analyticsEvents).where(eq(analyticsEvents.namespace, 'app'));
    if (startDate && endDate) {
      query = query.where(and(
        eq(analyticsEvents.namespace, 'app'),
        gte(analyticsEvents.createdAt, startDate),
        lte(analyticsEvents.createdAt, endDate)
      )) as typeof query;
    }
    
    const events = await query;
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event.eventName] = (counts[event.eventName] || 0) + 1;
    }
    return counts;
  }

  async getUniqueUsers(startDate?: string, endDate?: string): Promise<number> {
    if (!db) throw new Error("Database not configured");
    
    // Filter by namespace='app' only - exclude website events from admin metrics
    let query = db.select().from(analyticsEvents).where(eq(analyticsEvents.namespace, 'app'));
    if (startDate && endDate) {
      query = query.where(and(
        eq(analyticsEvents.namespace, 'app'),
        gte(analyticsEvents.createdAt, startDate),
        lte(analyticsEvents.createdAt, endDate)
      )) as typeof query;
    }
    
    const events = await query;
    const uniqueUsers = new Set(events.map(e => e.anonymousUserId));
    return uniqueUsers.size;
  }

  async getDailyActiveUsers(days: number): Promise<Array<{ date: string; count: number }>> {
    if (!db) throw new Error("Database not configured");
    
    // Filter by namespace='app' only - exclude website events from admin metrics
    const allEvents = await db.select().from(analyticsEvents).where(eq(analyticsEvents.namespace, 'app'));
    const now = new Date();
    const result: Array<{ date: string; count: number }> = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const usersOnDay = new Set(
        allEvents
          .filter(e => e.createdAt.startsWith(dateStr))
          .map(e => e.anonymousUserId)
      );
      
      result.push({ date: dateStr, count: usersOnDay.size });
    }
    
    return result;
  }

  async getFunnelAnalytics(): Promise<{
    scanStarted: number;
    scanCompleted: number;
    classificationFinalized: number;
    dropOffRates: { startToComplete: number; completeToFinalized: number };
    distinctSessions: { started: number; completed: number; finalized: number };
  }> {
    if (!db) throw new Error("Database not configured");
    
    // Filter by namespace='app' only - exclude website events from admin metrics
    const allEvents = await db.select().from(analyticsEvents).where(eq(analyticsEvents.namespace, 'app'));
    
    // Count total events
    const scanStarted = allEvents.filter(e => e.eventName === 'scan_started').length;
    const scanCompleted = allEvents.filter(e => e.eventName === 'scan_completed').length;
    const classificationFinalized = allEvents.filter(e => e.eventName === 'classification_finalized').length;
    
    // Count distinct sessions for more accurate funnel analysis
    const sessionsStarted = new Set(allEvents.filter(e => e.eventName === 'scan_started').map(e => e.sessionId));
    const sessionsCompleted = new Set(allEvents.filter(e => e.eventName === 'scan_completed').map(e => e.sessionId));
    const sessionsFinalized = new Set(allEvents.filter(e => e.eventName === 'classification_finalized').map(e => e.sessionId));
    
    // Calculate drop-off based on distinct sessions
    const startedCount = sessionsStarted.size;
    const completedCount = sessionsCompleted.size;
    const finalizedCount = sessionsFinalized.size;
    
    return {
      scanStarted,
      scanCompleted,
      classificationFinalized,
      dropOffRates: {
        startToComplete: startedCount > 0 ? 1 - (completedCount / startedCount) : 0,
        completeToFinalized: completedCount > 0 ? 1 - (finalizedCount / completedCount) : 0,
      },
      distinctSessions: {
        started: startedCount,
        completed: completedCount,
        finalized: finalizedCount,
      }
    };
  }

  async getClarificationAnalytics(): Promise<{
    totalClarificationsShown: number;
    clarificationsByType: Record<string, number>;
    clarificationRate: number;
  }> {
    if (!db) throw new Error("Database not configured");
    
    const allEvents = await db.select().from(analyticsEvents);
    const clarifications = allEvents.filter(e => e.eventName === 'clarification_shown');
    const scans = allEvents.filter(e => e.eventName === 'scan_completed').length;
    
    const clarificationsByType: Record<string, number> = {};
    for (const event of clarifications) {
      try {
        const payload = JSON.parse(event.payload || '{}');
        const type = payload.type || 'unknown';
        clarificationsByType[type] = (clarificationsByType[type] || 0) + 1;
      } catch {
        clarificationsByType['unknown'] = (clarificationsByType['unknown'] || 0) + 1;
      }
    }
    
    return {
      totalClarificationsShown: clarifications.length,
      clarificationsByType,
      clarificationRate: scans > 0 ? clarifications.length / scans : 0,
    };
  }

  async getFeedbackAnalytics(): Promise<{
    totalFeedback: number;
    helpfulCount: number;
    notHelpfulCount: number;
    notSureCount: number;
  }> {
    if (!db) throw new Error("Database not configured");
    
    const allEvents = await db.select().from(analyticsEvents);
    const feedbackEvents = allEvents.filter(e => e.eventName === 'feedback_submitted');
    let helpfulCount = 0, notHelpfulCount = 0, notSureCount = 0;
    
    for (const event of feedbackEvents) {
      try {
        const payload = JSON.parse(event.payload || '{}');
        if (payload.helpful === true) helpfulCount++;
        else if (payload.helpful === false) notHelpfulCount++;
        else notSureCount++;
      } catch {
        notSureCount++;
      }
    }
    
    return {
      totalFeedback: feedbackEvents.length,
      helpfulCount,
      notHelpfulCount,
      notSureCount,
    };
  }

  async getPostScanFeedbackList(limit?: number): Promise<Array<{
    id: string;
    helpful: boolean | null;
    category: string | null;
    itemName: string | null;
    timestamp: Date;
    sessionId: string | null;
    pilotLocationId: string | null;
  }>> {
    if (!db) throw new Error("Database not configured");
    
    const allEvents = await db.select().from(analyticsEvents)
      .where(eq(analyticsEvents.eventName, 'feedback_submitted'))
      .orderBy(desc(analyticsEvents.createdAt));
    
    const limited = limit ? allEvents.slice(0, limit) : allEvents;
    
    return limited.map(event => {
      let payload: { helpful?: boolean | null; category?: string; itemName?: string } = {};
      try {
        payload = JSON.parse(event.payload || '{}');
      } catch {}
      
      return {
        id: event.id,
        helpful: payload.helpful ?? null,
        category: payload.category || null,
        itemName: payload.itemName || null,
        timestamp: new Date(event.createdAt),
        sessionId: event.sessionId,
        pilotLocationId: event.pilotLocationId,
      };
    });
  }

  async getUserStats(userId: string): Promise<UserStats> {
    if (!db) throw new Error("Database not configured");
    
    const userEvents = await db.select().from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.anonymousUserId, userId),
        eq(analyticsEvents.eventName, 'scan_completed')
      ))
      .orderBy(desc(analyticsEvents.createdAt));
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCount = userEvents.filter(
      e => new Date(e.createdAt) >= todayStart
    ).length;
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyBreakdown: Array<{ date: string; dayName: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const count = userEvents.filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= dayStart && eventDate < dayEnd;
      }).length;
      
      weeklyBreakdown.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        count,
      });
    }
    
    const activeDatesSet = new Set(
      userEvents.map(e => new Date(e.createdAt).toISOString().split('T')[0])
    );
    const totalActiveDays = activeDatesSet.size;
    
    const sortedDates = Array.from(activeDatesSet).sort().reverse();
    let currentStreak = 0;
    let checkDate = new Date(now);
    
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (activeDatesSet.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }
    
    return {
      todayCount,
      weeklyBreakdown,
      totalActiveDays,
      currentStreak,
      longestStreak,
      totalScans: userEvents.length,
    };
  }

  async getUserRetentionAnalytics(): Promise<{
    totalUniqueUsers: number;
    returningUsers: number;
    oneTimeUsers: number;
    returnRate: number;
    powerUsers: number;
    monthlyCohorts: Array<{ month: string; newUsers: number; returnedFromPrevious: number }>;
    usersByVisitCount: Array<{ visits: string; count: number }>;
  }> {
    if (!db) throw new Error("Database not configured");
    
    const allEvents = await db.select({
      userId: analyticsEvents.anonymousUserId,
      createdAt: analyticsEvents.createdAt,
    }).from(analyticsEvents);
    
    const userVisits = new Map<string, Set<string>>();
    const userFirstMonth = new Map<string, string>();
    
    for (const event of allEvents) {
      const userId = event.userId;
      const eventDate = new Date(event.createdAt);
      const date = eventDate.toISOString().split('T')[0];
      const month = date.substring(0, 7);
      
      if (!userVisits.has(userId)) {
        userVisits.set(userId, new Set());
        userFirstMonth.set(userId, month);
      }
      userVisits.get(userId)!.add(date);
      
      if (month < userFirstMonth.get(userId)!) {
        userFirstMonth.set(userId, month);
      }
    }
    
    const totalUniqueUsers = userVisits.size;
    let returningUsers = 0;
    let powerUsers = 0;
    const visitCounts: Record<string, number> = {};
    
    Array.from(userVisits.entries()).forEach(([, dates]) => {
      const visitCount = dates.size;
      if (visitCount > 1) returningUsers++;
      if (visitCount >= 3) powerUsers++;
      const bucket = visitCount >= 5 ? '5+' : String(visitCount);
      visitCounts[bucket] = (visitCounts[bucket] || 0) + 1;
    });
    
    const oneTimeUsers = totalUniqueUsers - returningUsers;
    const returnRate = totalUniqueUsers > 0 ? Math.round((returningUsers / totalUniqueUsers) * 1000) / 10 : 0;
    
    const monthlyData = new Map<string, { newUsers: Set<string>; activeUsers: Set<string> }>();
    
    Array.from(userVisits.entries()).forEach(([userId, dates]) => {
      const firstMonth = userFirstMonth.get(userId)!;
      Array.from(dates).forEach((date) => {
        const month = date.substring(0, 7);
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { newUsers: new Set(), activeUsers: new Set() });
        }
        monthlyData.get(month)!.activeUsers.add(userId);
        if (month === firstMonth) {
          monthlyData.get(month)!.newUsers.add(userId);
        }
      });
    });
    
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    const monthlyCohorts: Array<{ month: string; newUsers: number; returnedFromPrevious: number }> = [];
    
    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const data = monthlyData.get(month)!;
      let returnedFromPrevious = 0;
      
      if (i > 0) {
        const prevMonth = sortedMonths[i - 1];
        const prevUsers = monthlyData.get(prevMonth)!.activeUsers;
        Array.from(data.activeUsers).forEach((userId) => {
          if (prevUsers.has(userId) && !data.newUsers.has(userId)) {
            returnedFromPrevious++;
          }
        });
      }
      
      monthlyCohorts.push({
        month,
        newUsers: data.newUsers.size,
        returnedFromPrevious,
      });
    }
    
    return {
      totalUniqueUsers,
      returningUsers,
      oneTimeUsers,
      returnRate,
      powerUsers,
      monthlyCohorts,
      usersByVisitCount: Object.entries(visitCounts)
        .map(([visits, count]) => ({ visits, count }))
        .sort((a, b) => {
          const aNum = a.visits === '5+' ? 5 : parseInt(a.visits);
          const bNum = b.visits === '5+' ? 5 : parseInt(b.visits);
          return aNum - bNum;
        }),
    };
  }

  // Challenge anti-abuse methods (DbStorage implementation)
  async validateChallengeScan(userId: string, perceptualHash: string, confidence: number): Promise<{
    isValid: boolean;
    reason?: 'duplicate_cooldown' | 'daily_cap' | 'low_confidence';
    dailyCount?: number;
    lastSimilarScanAt?: string;
  }> {
    if (!db) throw new Error("Database not configured");

    // Check confidence threshold
    if (confidence < CHALLENGE_CONFIG.MIN_CONFIDENCE_THRESHOLD) {
      return { isValid: false, reason: 'low_confidence' };
    }

    // Get JST today start
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const jstDateStr = jstNow.toISOString().split('T')[0];
    const todayStartUTC = new Date(jstDateStr + 'T00:00:00+09:00').toISOString();

    // Check daily cap
    const todayScansResult = await db
      .select({ count: count() })
      .from(challengeScans)
      .where(and(
        eq(challengeScans.anonymousUserId, userId),
        gte(challengeScans.scannedAt, todayStartUTC),
        eq(challengeScans.isValid, true)
      ));
    const dailyCount = todayScansResult[0]?.count || 0;

    if (dailyCount >= CHALLENGE_CONFIG.DAILY_SCAN_CAP) {
      return { isValid: false, reason: 'daily_cap', dailyCount };
    }

    // Check duplicate cooldown
    const cooldownTime = new Date(now.getTime() - CHALLENGE_CONFIG.DUPLICATE_COOLDOWN_MINUTES * 60 * 1000).toISOString();
    const recentSimilar = await db
      .select()
      .from(challengeScans)
      .where(and(
        eq(challengeScans.anonymousUserId, userId),
        eq(challengeScans.perceptualHash, perceptualHash),
        gte(challengeScans.scannedAt, cooldownTime)
      ))
      .limit(1);

    if (recentSimilar.length > 0) {
      return { isValid: false, reason: 'duplicate_cooldown', lastSimilarScanAt: recentSimilar[0].scannedAt };
    }

    return { isValid: true, dailyCount };
  }

  async recordChallengeScan(scan: InsertChallengeScan): Promise<ChallengeScan> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(challengeScans).values(scan).returning();
    return result[0];
  }

  async getChallengeLeaderboard(month: string, limit: number = 20): Promise<Array<{
    anonymousUserId: string;
    validScans: number;
    totalScans: number;
    uniqueCategories: number;
    avgConfidence: number;
  }>> {
    if (!db) throw new Error("Database not configured");

    const allScans = await db
      .select()
      .from(challengeScans)
      .where(eq(challengeScans.challengeMonth, month));

    const userStats = new Map<string, { valid: number; total: number; categories: Set<string>; confidenceSum: number }>();

    for (const scan of allScans) {
      if (!userStats.has(scan.anonymousUserId)) {
        userStats.set(scan.anonymousUserId, { valid: 0, total: 0, categories: new Set(), confidenceSum: 0 });
      }
      const stats = userStats.get(scan.anonymousUserId)!;
      stats.total++;
      if (scan.isValid) {
        stats.valid++;
        stats.categories.add(scan.category);
        stats.confidenceSum += scan.confidence;
      }
    }

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        anonymousUserId: userId,
        validScans: stats.valid,
        totalScans: stats.total,
        uniqueCategories: stats.categories.size,
        avgConfidence: stats.valid > 0 ? Math.round((stats.confidenceSum / stats.valid) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.validScans - a.validScans)
      .slice(0, limit);
  }

  async getUserChallengeStats(userId: string, month: string): Promise<{
    validScans: number;
    totalScans: number;
    todayScans: number;
    streak: number;
    rank: number;
  }> {
    if (!db) throw new Error("Database not configured");

    const userScans = await db
      .select()
      .from(challengeScans)
      .where(and(
        eq(challengeScans.anonymousUserId, userId),
        eq(challengeScans.challengeMonth, month)
      ));

    const validScans = userScans.filter(s => s.isValid).length;
    const totalScans = userScans.length;

    // Get JST today start
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const jstDateStr = jstNow.toISOString().split('T')[0];
    const todayStartUTC = new Date(jstDateStr + 'T00:00:00+09:00').toISOString();

    const todayScans = userScans.filter(s => s.scannedAt >= todayStartUTC && s.isValid).length;

    const leaderboard = await this.getChallengeLeaderboard(month, 1000);
    const rank = leaderboard.findIndex(u => u.anonymousUserId === userId) + 1;

    // Calculate streak (days with at least one valid scan)
    const scanDates = new Set(userScans.filter(s => s.isValid).map(s => s.scannedAt.split('T')[0]));
    let streak = 0;
    let checkDate = new Date(jstNow);
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (scanDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { validScans, totalScans, todayScans, streak, rank: rank || leaderboard.length + 1 };
  }

  // ============================================
  // IMPACT REPORT METHODS (DbStorage)
  // ============================================

  async createImpactLocation(location: InsertImpactLocation): Promise<ImpactLocation> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(impactLocations).values(location).returning();
    return result[0];
  }

  async getImpactLocation(id: string): Promise<ImpactLocation | undefined> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select().from(impactLocations).where(eq(impactLocations.id, id));
    return result[0];
  }

  async getAllImpactLocations(): Promise<ImpactLocation[]> {
    if (!db) throw new Error("Database not configured");
    return await db.select().from(impactLocations).orderBy(impactLocations.name);
  }

  async updateImpactLocationBaseline(id: string, startDate: string, endDate: string): Promise<ImpactLocation> {
    if (!db) throw new Error("Database not configured");
    const result = await db
      .update(impactLocations)
      .set({ baselineStartDate: startDate, baselineEndDate: endDate })
      .where(eq(impactLocations.id, id))
      .returning();
    if (!result[0]) throw new Error("Location not found");
    return result[0];
  }

  async createRuleset(ruleset: InsertRuleset): Promise<Ruleset> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(rulesets).values(ruleset).returning();
    return result[0];
  }

  async getRulesetHistory(locationId: string): Promise<Ruleset[]> {
    if (!db) throw new Error("Database not configured");
    return await db
      .select()
      .from(rulesets)
      .where(eq(rulesets.locationId, locationId))
      .orderBy(desc(rulesets.effectiveFrom));
  }

  async createImpactSession(session: InsertImpactSession): Promise<ImpactSession> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(impactSessions).values(session).returning();
    return result[0];
  }

  async endImpactSession(sessionId: string): Promise<void> {
    if (!db) throw new Error("Database not configured");
    await db
      .update(impactSessions)
      .set({ endedAt: new Date().toISOString() })
      .where(eq(impactSessions.id, sessionId));
  }

  async recordOutcome(outcome: InsertOutcome): Promise<Outcome> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(outcomes).values(outcome).returning();
    return result[0];
  }

  async getImpactKPIs(locationId?: string, startDate?: string, endDate?: string): Promise<{
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
  }> {
    if (!db) throw new Error("Database not configured");

    // Build conditions for filtering events
    const conditions = [];
    if (locationId) conditions.push(eq(analyticsEvents.pilotLocationId, locationId));
    if (startDate) conditions.push(gte(analyticsEvents.createdAt, startDate));
    if (endDate) conditions.push(lte(analyticsEvents.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all events matching the filters
    const events = whereClause 
      ? await db.select().from(analyticsEvents).where(whereClause)
      : await db.select().from(analyticsEvents);

    const uniqueUsers = new Set(events.map(e => e.anonymousUserId)).size;
    const guidanceShown = events.filter(e => e.eventName === 'guidance_shown' || e.eventName === 'scan_completed').length;
    const guidanceConfirmed = events.filter(e => e.eventName === 'guidance_confirmed').length;
    const guidanceRejected = events.filter(e => e.eventName === 'guidance_rejected').length;
    const disposalCompleted = events.filter(e => e.eventName === 'disposal_completed').length;

    // Calculate returning vs new users by finding first appearance
    const userFirstSeen = new Map<string, string>();
    const allUserEvents = await db.select().from(analyticsEvents);
    for (const e of allUserEvents) {
      if (!userFirstSeen.has(e.anonymousUserId) || e.createdAt < userFirstSeen.get(e.anonymousUserId)!) {
        userFirstSeen.set(e.anonymousUserId, e.createdAt);
      }
    }
    
    const usersInRange = Array.from(new Set(events.map(e => e.anonymousUserId)));
    let newUsers = 0;
    for (const userId of usersInRange) {
      const firstSeen = userFirstSeen.get(userId);
      if (firstSeen && (!startDate || firstSeen >= startDate) && (!endDate || firstSeen <= endDate)) {
        newUsers++;
      }
    }
    const returningUsers = uniqueUsers - newUsers;

    // Get resolution times from outcomes
    const outcomeConditions = [];
    if (locationId) outcomeConditions.push(eq(outcomes.locationId, locationId));
    if (startDate) outcomeConditions.push(gte(outcomes.createdAt, startDate));
    if (endDate) outcomeConditions.push(lte(outcomes.createdAt, endDate));

    const outcomeWhere = outcomeConditions.length > 0 ? and(...outcomeConditions) : undefined;
    const outcomeData = outcomeWhere
      ? await db.select().from(outcomes).where(outcomeWhere)
      : await db.select().from(outcomes);

    const resolutionTimes = outcomeData
      .filter(o => o.resolutionTimeMs !== null)
      .map(o => o.resolutionTimeMs!)
      .sort((a, b) => a - b);
    const medianResolutionTimeMs = resolutionTimes.length > 0 
      ? resolutionTimes[Math.floor(resolutionTimes.length / 2)] 
      : 0;

    // Top confusing items from scan events
    const itemCounts: Record<string, number> = {};
    for (const e of events.filter(e => e.eventName === 'scan_completed')) {
      try {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        if (payload.itemName) {
          itemCounts[payload.itemName] = (itemCounts[payload.itemName] || 0) + 1;
        }
      } catch {}
    }
    const topConfusingItems = Object.entries(itemCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Scans by category
    const scansByCategory: Record<string, number> = {};
    for (const e of events.filter(e => e.eventName === 'scan_completed')) {
      try {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        if (payload.category) {
          scansByCategory[payload.category] = (scansByCategory[payload.category] || 0) + 1;
        }
      } catch {}
    }

    // Calculate confusion rate from clarification events
    const clarificationEvents = events.filter(e => e.eventName === 'clarification_shown');
    const confusionRate = guidanceShown > 0 ? Math.round((clarificationEvents.length / guidanceShown) * 1000) / 10 : 0;

    return {
      uniqueUsers,
      totalSessions: new Set(events.map(e => e.sessionId)).size,
      guidanceShown,
      guidanceConfirmed,
      guidanceRejected,
      guidanceAcceptanceRate: guidanceShown > 0 ? Math.round((guidanceConfirmed / guidanceShown) * 1000) / 10 : 0,
      completionRate: guidanceShown > 0 ? Math.round((disposalCompleted / guidanceShown) * 1000) / 10 : 0,
      medianResolutionTimeMs,
      confusionRate,
      returningUsers,
      newUsers,
      topConfusingItems,
      scansByCategory,
    };
  }

  async getWeeklyTrends(locationId?: string, weeks: number = 12): Promise<Array<{
    weekStart: string;
    uniqueUsers: number;
    sessions: number;
    guidanceAcceptanceRate: number;
    confusionRate: number;
  }>> {
    if (!db) throw new Error("Database not configured");

    const now = new Date();
    const trends: Array<{
      weekStart: string;
      uniqueUsers: number;
      sessions: number;
      guidanceAcceptanceRate: number;
      confusionRate: number;
    }> = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7 + now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const conditions = [
        gte(analyticsEvents.createdAt, weekStart.toISOString()),
        lte(analyticsEvents.createdAt, weekEnd.toISOString()),
      ];
      if (locationId) conditions.push(eq(analyticsEvents.pilotLocationId, locationId));

      const events = await db.select().from(analyticsEvents).where(and(...conditions));

      const guidanceShown = events.filter(e => e.eventName === 'guidance_shown' || e.eventName === 'scan_completed').length;
      const guidanceConfirmed = events.filter(e => e.eventName === 'guidance_confirmed').length;
      const clarificationEvents = events.filter(e => e.eventName === 'clarification_shown');

      trends.push({
        weekStart: weekStart.toISOString().split('T')[0],
        uniqueUsers: new Set(events.map(e => e.anonymousUserId)).size,
        sessions: new Set(events.map(e => e.sessionId)).size,
        guidanceAcceptanceRate: guidanceShown > 0 ? Math.round((guidanceConfirmed / guidanceShown) * 1000) / 10 : 0,
        confusionRate: guidanceShown > 0 ? Math.round((clarificationEvents.length / guidanceShown) * 1000) / 10 : 0,
      });
    }

    return trends;
  }

  async getBaselineComparison(locationId: string): Promise<{
    baseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    postBaseline: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
    improvement: { acceptanceRate: number; confusionRate: number; usersPerDay: number };
  } | null> {
    if (!db) throw new Error("Database not configured");

    const location = await this.getImpactLocation(locationId);
    if (!location?.baselineStartDate || !location?.baselineEndDate) return null;

    const baselineKPIs = await this.getImpactKPIs(locationId, location.baselineStartDate, location.baselineEndDate);
    const baselineDays = Math.ceil((new Date(location.baselineEndDate).getTime() - new Date(location.baselineStartDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;

    const postKPIs = await this.getImpactKPIs(locationId, location.baselineEndDate);
    const postDays = Math.ceil((Date.now() - new Date(location.baselineEndDate).getTime()) / (1000 * 60 * 60 * 24)) || 1;

    return {
      baseline: {
        acceptanceRate: baselineKPIs.guidanceAcceptanceRate,
        confusionRate: baselineKPIs.confusionRate,
        usersPerDay: baselineKPIs.uniqueUsers / baselineDays,
      },
      postBaseline: {
        acceptanceRate: postKPIs.guidanceAcceptanceRate,
        confusionRate: postKPIs.confusionRate,
        usersPerDay: postKPIs.uniqueUsers / postDays,
      },
      improvement: {
        acceptanceRate: postKPIs.guidanceAcceptanceRate - baselineKPIs.guidanceAcceptanceRate,
        confusionRate: baselineKPIs.confusionRate - postKPIs.confusionRate,
        usersPerDay: (postKPIs.uniqueUsers / postDays) - (baselineKPIs.uniqueUsers / baselineDays),
      },
    };
  }

  async exportImpactEvents(locationId?: string, startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>> {
    if (!db) throw new Error("Database not configured");

    const conditions = [];
    if (locationId) conditions.push(eq(analyticsEvents.pilotLocationId, locationId));
    if (startDate) conditions.push(gte(analyticsEvents.createdAt, startDate));
    if (endDate) conditions.push(lte(analyticsEvents.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const events = whereClause 
      ? await db.select().from(analyticsEvents).where(whereClause)
      : await db.select().from(analyticsEvents);

    return events.map(e => ({ ...e }));
  }

  async exportImpactKPISummary(locationId?: string): Promise<Record<string, unknown>> {
    const kpis = await this.getImpactKPIs(locationId);
    const trends = await this.getWeeklyTrends(locationId);
    const locations = await this.getAllImpactLocations();
    
    return {
      generatedAt: new Date().toISOString(),
      timezone: IMPACT_REPORT_CONFIG.TIMEZONE,
      locationId: locationId || 'all',
      kpis,
      weeklyTrends: trends,
      locations: locations.map(l => ({ id: l.id, name: l.name, type: l.type })),
    };
  }

  // ============================================
  // IMPACT ANALYTICS ENGINE (DbStorage)
  // ============================================

  async logScanImpact(impact: InsertScanImpact): Promise<ScanImpact> {
    if (!db) throw new Error("Database not configured");
    const result = await db.insert(scanImpacts).values(impact).returning();
    return result[0];
  }

  async backfillScanImpacts(): Promise<{ processed: number; impacted: number }> {
    if (!db) throw new Error("Database not configured");
    
    // Get all scan events that don't have impact records yet
    const allScans = await db.select().from(trashScanEvents);
    const existingImpacts = await db.select({ scanEventId: scanImpacts.scanEventId }).from(scanImpacts);
    const existingIds = new Set(existingImpacts.map(i => i.scanEventId));
    
    const scansToProcess = allScans.filter(s => !existingIds.has(s.id));
    
    let processed = 0;
    let impacted = 0;
    
    for (const scan of scansToProcess) {
      const impact = calculateScanImpact(
        scan.detectedItemName,
        scan.detectedCategory,
        scan.confidence,
        scan.city
      );
      
      await db.insert(scanImpacts).values({
        scanEventId: scan.id,
        itemType: scan.detectedItemName,
        category: scan.detectedCategory,
        location: scan.city ?? null,
        confidenceScore: scan.confidence,
        misSortPrevented: impact.misSortPrevented,
        avoidedMassKg: impact.avoidedMassKg,
        avoidedCostJpy: impact.avoidedCostJpy,
        avoidedCo2eKg: impact.avoidedCo2eKg,
        baselineMisSortRate: IMPACT_CONFIG.BASELINE_MIS_SORT_RATE,
        disposalCostPerTon: IMPACT_CONFIG.DISPOSAL_COST_PER_TON_JPY,
        emissionFactor: IMPACT_CONFIG.INCINERATION_EMISSION_FACTOR,
        contaminationMultiplier: IMPACT_CONFIG.CONTAMINATION_MULTIPLIER,
      });
      
      processed++;
      if (impact.misSortPrevented) impacted++;
    }
    
    return { processed, impacted };
  }

  async getImpactSummary(locationId?: string, startDate?: string, endDate?: string): Promise<ImpactSummary> {
    if (!db) throw new Error("Database not configured");

    const conditions = [];
    if (locationId) conditions.push(eq(scanImpacts.location, locationId));
    if (startDate) conditions.push(gte(scanImpacts.createdAt, startDate));
    if (endDate) conditions.push(lte(scanImpacts.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const impacts = whereClause
      ? await db.select().from(scanImpacts).where(whereClause)
      : await db.select().from(scanImpacts);

    const totalScans = impacts.length;
    const totalMisSortsPrevented = impacts.filter(i => i.misSortPrevented).length;
    const totalAvoidedMassKg = impacts.reduce((sum, i) => sum + i.avoidedMassKg, 0);
    const totalAvoidedCostJpy = impacts.reduce((sum, i) => sum + i.avoidedCostJpy, 0);
    const totalAvoidedCo2eKg = impacts.reduce((sum, i) => sum + i.avoidedCo2eKg, 0);

    const impactByCategory: Record<string, { scans: number; misSortsPrevented: number; avoidedMassKg: number; avoidedCostJpy: number; avoidedCo2eKg: number }> = {};
    const impactByLocation: Record<string, { scans: number; misSortsPrevented: number; avoidedCostJpy: number; avoidedCo2eKg: number }> = {};

    for (const impact of impacts) {
      if (!impactByCategory[impact.category]) {
        impactByCategory[impact.category] = { scans: 0, misSortsPrevented: 0, avoidedMassKg: 0, avoidedCostJpy: 0, avoidedCo2eKg: 0 };
      }
      impactByCategory[impact.category].scans++;
      if (impact.misSortPrevented) impactByCategory[impact.category].misSortsPrevented++;
      impactByCategory[impact.category].avoidedMassKg += impact.avoidedMassKg;
      impactByCategory[impact.category].avoidedCostJpy += impact.avoidedCostJpy;
      impactByCategory[impact.category].avoidedCo2eKg += impact.avoidedCo2eKg;

      const loc = impact.location || 'Unknown';
      if (!impactByLocation[loc]) {
        impactByLocation[loc] = { scans: 0, misSortsPrevented: 0, avoidedCostJpy: 0, avoidedCo2eKg: 0 };
      }
      impactByLocation[loc].scans++;
      if (impact.misSortPrevented) impactByLocation[loc].misSortsPrevented++;
      impactByLocation[loc].avoidedCostJpy += impact.avoidedCostJpy;
      impactByLocation[loc].avoidedCo2eKg += impact.avoidedCo2eKg;
    }

    // Calculate 30-day trend
    const trend30Days: ImpactSummary['trend30Days'] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      
      const dayImpacts = impacts.filter(im => im.createdAt.startsWith(dateStr));
      trend30Days.push({
        period: dateStr,
        scans: dayImpacts.length,
        misSortsPrevented: dayImpacts.filter(im => im.misSortPrevented).length,
        avoidedCo2eKg: dayImpacts.reduce((sum, im) => sum + im.avoidedCo2eKg, 0),
      });
    }

    return {
      totalScans,
      totalMisSortsPrevented,
      totalAvoidedMassKg,
      totalAvoidedCostJpy,
      totalAvoidedCo2eKg,
      preventionRate: totalScans > 0 ? (totalMisSortsPrevented / totalScans) * 100 : 0,
      avgCostSavedPerScan: totalScans > 0 ? totalAvoidedCostJpy / totalScans : 0,
      avgCo2eSavedPerScan: totalScans > 0 ? totalAvoidedCo2eKg / totalScans : 0,
      impactByCategory,
      impactByLocation,
      trend30Days,
    };
  }

  async getImpactByLocation(): Promise<Array<{ location: string; scans: number; misSortsPrevented: number; avoidedCostJpy: number; avoidedCo2eKg: number }>> {
    const summary = await this.getImpactSummary();
    return Object.entries(summary.impactByLocation).map(([location, data]) => ({
      location,
      ...data,
    }));
  }

  async getDailyImpactTrend(days: number): Promise<Array<{ date: string; scans: number; misSortsPrevented: number; avoidedCo2eKg: number; avoidedCostJpy: number }>> {
    if (!db) throw new Error("Database not configured");
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const impacts = await db.select().from(scanImpacts)
      .where(gte(scanImpacts.createdAt, cutoff.toISOString()));

    const result: Record<string, { scans: number; misSortsPrevented: number; avoidedCo2eKg: number; avoidedCostJpy: number }> = {};

    for (const impact of impacts) {
      const date = impact.createdAt.substring(0, 10);
      if (!result[date]) {
        result[date] = { scans: 0, misSortsPrevented: 0, avoidedCo2eKg: 0, avoidedCostJpy: 0 };
      }
      result[date].scans++;
      if (impact.misSortPrevented) result[date].misSortsPrevented++;
      result[date].avoidedCo2eKg += impact.avoidedCo2eKg;
      result[date].avoidedCostJpy += impact.avoidedCostJpy;
    }

    return Object.entries(result)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async exportImpactAnalytics(startDate?: string, endDate?: string): Promise<Array<Record<string, unknown>>> {
    if (!db) throw new Error("Database not configured");
    
    const conditions = [];
    if (startDate) conditions.push(gte(scanImpacts.createdAt, startDate));
    if (endDate) conditions.push(lte(scanImpacts.createdAt, endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const impacts = whereClause
      ? await db.select().from(scanImpacts).where(whereClause)
      : await db.select().from(scanImpacts);

    return impacts.map(i => ({ ...i }));
  }

  async getScanEventCount(): Promise<number> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(trashScanEvents);
    return result[0]?.count ?? 0;
  }

  async getAnalyticsEventCount(): Promise<number> {
    if (!db) throw new Error("Database not configured");
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(analyticsEvents);
    return result[0]?.count ?? 0;
  }

  async getAnalyticsEventsByNamespace(): Promise<Record<string, number>> {
    if (!db) throw new Error("Database not configured");
    const result = await db
      .select({ 
        namespace: analyticsEvents.namespace, 
        count: sql<number>`count(*)::int` 
      })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.namespace);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      const ns = row.namespace || 'null';
      counts[ns] = row.count;
    }
    return counts;
  }

  async checkConnection(): Promise<boolean> {
    if (!db) return false;
    try {
      await db.select({ one: sql`1` }).from(users).limit(1);
      return true;
    } catch {
      return false;
    }
  }
}

// Use DbStorage if DATABASE_URL is configured, otherwise fall back to MemStorage
export const storage: IStorage = process.env.DATABASE_URL 
  ? new DbStorage() 
  : new MemStorage();

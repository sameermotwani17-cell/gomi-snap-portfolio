import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
  blocked: boolean;
  blockedUntil?: number;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

interface SecurityEvent {
  timestamp: number;
  type: 'rate_limit_hit' | 'blocked' | 'suspicious_activity' | 'bot_detected';
  ip: string;
  userId?: string;
  endpoint: string;
  details: string;
}

const ipLimits: RateLimitStore = {};
const userLimits: RateLimitStore = {};
const securityLog: SecurityEvent[] = [];

const MAX_LOG_SIZE = 1000;

const CONFIG = {
  enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  globalLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '100'),
  globalWindowMs: 60 * 1000,
  identifyLimit: parseInt(process.env.IDENTIFY_RATE_LIMIT || '20'),
  identifyWindowMs: 60 * 60 * 1000,
  burstLimit: 5,
  burstWindowMs: 10 * 1000,
  blockDurationMs: parseInt(process.env.BLOCK_DURATION_MINUTES || '15') * 60 * 1000,
  suspiciousThreshold: 3,
};

function getClientIP(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getUserId(req: Request): string | null {
  // Only use server-trusted session identifiers, not client-provided ones
  // Client-provided userIds can be rotated by attackers to bypass rate limits
  // We rely primarily on IP-based rate limiting for security
  return null;
}

function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>) {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  securityLog.push(fullEvent);
  
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.shift();
  }
  
  console.log(`[SECURITY] ${event.type}: IP=${event.ip}, endpoint=${event.endpoint}, ${event.details}`);
}

function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  burstLimit?: number,
  burstWindowMs?: number
): { allowed: boolean; remaining: number; resetTime: number; blocked: boolean } {
  const now = Date.now();
  const entry = store[key];
  
  if (!entry) {
    store[key] = {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false,
    };
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs, blocked: false };
  }
  
  if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, remaining: 0, resetTime: entry.blockedUntil, blocked: true };
  }
  
  if (entry.blocked && entry.blockedUntil && now >= entry.blockedUntil) {
    store[key] = {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false,
    };
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs, blocked: false };
  }
  
  if (now - entry.firstRequest > windowMs) {
    store[key] = {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false,
    };
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs, blocked: false };
  }
  
  if (burstLimit && burstWindowMs) {
    const timeSinceLastRequest = now - entry.lastRequest;
    if (timeSinceLastRequest < burstWindowMs && entry.count >= burstLimit) {
      return { allowed: false, remaining: 0, resetTime: entry.firstRequest + windowMs, blocked: false };
    }
  }
  
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: entry.firstRequest + windowMs, blocked: false };
  }
  
  entry.count++;
  entry.lastRequest = now;
  return { allowed: true, remaining: limit - entry.count, resetTime: entry.firstRequest + windowMs, blocked: false };
}

function blockClient(store: RateLimitStore, key: string) {
  const entry = store[key];
  if (entry) {
    entry.blocked = true;
    entry.blockedUntil = Date.now() + CONFIG.blockDurationMs;
  }
}

export function identifyTrashRateLimiter(req: Request, res: Response, next: NextFunction) {
  if (!CONFIG.enabled) {
    return next();
  }
  
  const ip = getClientIP(req);
  const userId = getUserId(req);
  const endpoint = req.path;
  
  const isClarificationFollowUp = !!(req.body && req.body.clarificationAnswer);
  
  const ipResult = checkRateLimit(
    ipLimits,
    `identify:${ip}`,
    CONFIG.identifyLimit,
    CONFIG.identifyWindowMs,
    isClarificationFollowUp ? undefined : CONFIG.burstLimit,
    isClarificationFollowUp ? undefined : CONFIG.burstWindowMs
  );
  
  if (!ipResult.allowed) {
    const retryAfterSeconds = Math.ceil((ipResult.resetTime - Date.now()) / 1000);
    
    logSecurityEvent({
      type: ipResult.blocked ? 'blocked' : 'rate_limit_hit',
      ip,
      userId: userId || undefined,
      endpoint,
      details: ipResult.blocked 
        ? `IP is blocked until ${new Date(ipResult.resetTime).toISOString()}`
        : `IP rate limit exceeded. Reset at ${new Date(ipResult.resetTime).toISOString()}`,
    });
    
    res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', CONFIG.identifyLimit);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', Math.floor(ipResult.resetTime / 1000));
    
    return res.status(429).json({
      error: ipResult.blocked 
        ? 'Too many requests. You have been temporarily blocked.'
        : 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.max(1, retryAfterSeconds),
      blocked: ipResult.blocked,
    });
  }
  
  if (userId) {
    const userResult = checkRateLimit(
      userLimits,
      `identify:${userId}`,
      CONFIG.identifyLimit * 2,
      CONFIG.identifyWindowMs
    );
    
    if (!userResult.allowed) {
      logSecurityEvent({
        type: 'rate_limit_hit',
        ip,
        userId,
        endpoint,
        details: `User rate limit exceeded`,
      });
      
      res.setHeader('Retry-After', Math.ceil((userResult.resetTime - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Rate limit exceeded for your account. Please try again later.',
        retryAfter: Math.ceil((userResult.resetTime - Date.now()) / 1000),
      });
    }
  }
  
  res.setHeader('X-RateLimit-Limit', CONFIG.identifyLimit);
  res.setHeader('X-RateLimit-Remaining', ipResult.remaining);
  res.setHeader('X-RateLimit-Reset', Math.floor(ipResult.resetTime / 1000));
  
  next();
}

const SUSPICIOUS_USER_AGENTS = [
  'python-requests',
  'curl/',
  'wget/',
  'scrapy',
  'bot',
  'spider',
  'crawler',
];

const REQUIRED_HEADERS = ['user-agent', 'accept'];

export function botDetection(req: Request, res: Response, next: NextFunction) {
  if (!CONFIG.enabled) {
    return next();
  }
  
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const endpoint = req.path;
  
  for (const suspicious of SUSPICIOUS_USER_AGENTS) {
    if (userAgent.toLowerCase().includes(suspicious)) {
      logSecurityEvent({
        type: 'bot_detected',
        ip,
        endpoint,
        details: `Suspicious user-agent: ${userAgent.substring(0, 100)}`,
      });
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  const missingHeaders = REQUIRED_HEADERS.filter(h => !req.headers[h]);
  if (missingHeaders.length > 0) {
    logSecurityEvent({
      type: 'suspicious_activity',
      ip,
      endpoint,
      details: `Missing required headers: ${missingHeaders.join(', ')}`,
    });
  }
  
  next();
}

export function requestValidation(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 10 * 1024 * 1024;
    if (contentLength > maxSize) {
      return res.status(413).json({ error: 'Request body too large' });
    }
  }
  
  next();
}

export function getSecurityLogs(limit: number = 100): SecurityEvent[] {
  return securityLog.slice(-limit);
}

export function getSecurityStats() {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const recentEvents = securityLog.filter(e => e.timestamp > hourAgo);
  const dayEvents = securityLog.filter(e => e.timestamp > dayAgo);
  
  const blockedIPs = Object.entries(ipLimits)
    .filter(([_, entry]) => entry.blocked && entry.blockedUntil && entry.blockedUntil > now)
    .map(([key, entry]) => ({
      key,
      blockedUntil: entry.blockedUntil,
      remainingMs: (entry.blockedUntil || 0) - now,
    }));
  
  return {
    lastHour: {
      rateLimitHits: recentEvents.filter(e => e.type === 'rate_limit_hit').length,
      blocked: recentEvents.filter(e => e.type === 'blocked').length,
      botsDetected: recentEvents.filter(e => e.type === 'bot_detected').length,
      suspiciousActivity: recentEvents.filter(e => e.type === 'suspicious_activity').length,
    },
    last24Hours: {
      rateLimitHits: dayEvents.filter(e => e.type === 'rate_limit_hit').length,
      blocked: dayEvents.filter(e => e.type === 'blocked').length,
      botsDetected: dayEvents.filter(e => e.type === 'bot_detected').length,
      suspiciousActivity: dayEvents.filter(e => e.type === 'suspicious_activity').length,
    },
    currentlyBlocked: blockedIPs,
    totalEventsLogged: securityLog.length,
  };
}

export function clearOldEntries() {
  const now = Date.now();
  
  for (const key of Object.keys(ipLimits)) {
    const entry = ipLimits[key];
    if (now - entry.lastRequest > CONFIG.identifyWindowMs * 2) {
      delete ipLimits[key];
    }
  }
  
  for (const key of Object.keys(userLimits)) {
    const entry = userLimits[key];
    if (now - entry.lastRequest > CONFIG.identifyWindowMs * 2) {
      delete userLimits[key];
    }
  }
}

setInterval(clearOldEntries, 60 * 60 * 1000);

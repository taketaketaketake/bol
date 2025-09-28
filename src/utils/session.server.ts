// src/utils/session.server.ts
// Astro-compatible session management using Web APIs

// Set SESSION_SECRET in your env (Netlify/Local)
const sessionSecret = import.meta.env.SESSION_SECRET || "dev-secret-change-me";

interface SessionData {
  [key: string]: any;
}

class AstroSession {
  private data: SessionData = {};
  private hasChanged = false;

  constructor(cookieData?: SessionData) {
    if (cookieData) {
      this.data = cookieData;
    }
  }

  get(key: string) {
    return this.data[key];
  }

  set(key: string, value: any) {
    this.data[key] = value;
    this.hasChanged = true;
  }

  unset(key: string) {
    delete this.data[key];
    this.hasChanged = true;
  }

  has(key: string) {
    return key in this.data;
  }

  getData() {
    return this.data;
  }

  getHasChanged() {
    return this.hasChanged;
  }
}

function encryptSessionData(data: SessionData): string {
  // Simple base64 encoding - in production, use proper encryption
  return btoa(JSON.stringify(data));
}

function decryptSessionData(encryptedData: string): SessionData {
  try {
    return JSON.parse(atob(encryptedData));
  } catch {
    return {};
  }
}

export function getSession(cookieHeader: string | null): AstroSession {
  if (!cookieHeader) {
    return new AstroSession();
  }

  // Parse cookies
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );

  const sessionCookie = cookies['__bol_session'];
  if (!sessionCookie) {
    return new AstroSession();
  }

  const sessionData = decryptSessionData(sessionCookie);
  return new AstroSession(sessionData);
}

export function commitSession(session: AstroSession): string {
  if (!session.getHasChanged()) {
    return '';
  }

  const encryptedData = encryptSessionData(session.getData());
  const isProduction = import.meta.env.MODE === 'production';

  const cookieOptions = [
    `__bol_session=${encryptedData}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
    ...(isProduction ? ['Secure'] : [])
  ];

  return cookieOptions.join('; ');
}

export function destroySession(): string {
  const isProduction = import.meta.env.MODE === 'production';

  const cookieOptions = [
    '__bol_session=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    ...(isProduction ? ['Secure'] : [])
  ];

  return cookieOptions.join('; ');
}
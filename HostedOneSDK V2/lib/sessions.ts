export interface Session {
  id: string;
  hostedUrl: string;
  urlExpiry: string;
  entityId?: string;
  createdAt: string;
  preAnswers?: Record<string, string>;
  postAnswers?: Record<string, string>;
  status: 'pending' | 'pre_complete' | 'idv_complete' | 'complete';
}

// In-memory store for POC. In production, use a database.
const sessions = new Map<string, Session>();

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function createSession(session: Session): void {
  sessions.set(session.id, session);
}

export function updateSession(id: string, updates: Partial<Session>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const updated = { ...session, ...updates };
  sessions.set(id, updated);
  return updated;
}

export interface CreateAuditLogDto {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  category?: 'AUTH' | 'USERS' | 'GROUPS' | 'SCHEDULING' | 'AVA_SYNC' | 'SYSTEM';
  status?: 'SUCCESS' | 'FAILURE' | 'WARNING';
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any> | string | null;
}

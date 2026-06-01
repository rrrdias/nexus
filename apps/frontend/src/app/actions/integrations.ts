"use server"

import { fetchFromApi } from "./api"

export async function getIntegrationStatus() {
  return fetchFromApi('/api/academic/integrations/status', { method: 'GET', cache: 'no-store' });
}

export async function getIntegrationProfiles() {
  return fetchFromApi('/api/academic/integrations/profiles', { method: 'GET', cache: 'no-store' });
}

export async function getIntegrationHistory() {
  return fetchFromApi('/api/academic/integrations/history', { method: 'GET', cache: 'no-store' });
}

export async function triggerIntegrationJob(profileName: string, jobName: string, type: 'sync' | 'down') {
  return fetchFromApi('/api/academic/integrations/run', {
    method: 'POST',
    body: JSON.stringify({ profileName, jobName, type }),
  });
}

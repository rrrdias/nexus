"use server"

import { fetchFromApi } from "./api"

export async function getIntegrationStatus() {
  try {
    return await fetchFromApi('/api/academic/integrations/status', { method: 'GET', cache: 'no-store' });
  } catch (error: any) {
    return { success: false, error: error.message || "Erro desconhecido ao obter status da integração." };
  }
}

export async function getIntegrationProfiles() {
  try {
    return await fetchFromApi('/api/academic/integrations/profiles', { method: 'GET', cache: 'no-store' });
  } catch (error: any) {
    return { success: false, error: error.message || "Erro desconhecido ao obter perfis de integração." };
  }
}

export async function getIntegrationHistory() {
  try {
    return await fetchFromApi('/api/academic/integrations/history', { method: 'GET', cache: 'no-store' });
  } catch (error: any) {
    return { success: false, error: error.message || "Erro desconhecido ao obter histórico da integração." };
  }
}

export async function triggerIntegrationJob(profileName: string, jobName: string, type: 'sync' | 'down') {
  try {
    return await fetchFromApi('/api/academic/integrations/run', {
      method: 'POST',
      body: JSON.stringify({ profileName, jobName, type }),
    });
  } catch (error: any) {
    return { success: false, error: error.message || "Erro desconhecido ao disparar job de integração." };
  }
}

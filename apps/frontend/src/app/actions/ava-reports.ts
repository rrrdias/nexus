"use server"

import { fetchFromApi } from "./api"

export async function syncMoodleData(institution?: string, type?: 'grades' | 'progress') {
  try {
    const data = await fetchFromApi('/api/ava-reports/sync', {
      method: 'POST',
      body: JSON.stringify({ institution, type })
    });
    return { success: true, data };
  } catch (error: any) {
    console.error("[syncMoodleData Action Error]:", error);
    return { success: false, error: error.message || 'Falha na sincronização' };
  }
}

export async function getConsolidatedAvaData(page: number, size: number, filters: any) {
  return fetchFromApi('/api/ava-reports/consolidated', {
    method: 'POST',
    body: JSON.stringify({ page, size, filters })
  });
}

export async function exportConsolidatedAvaData(filters: any) {
  return fetchFromApi('/api/ava-reports/consolidated/export', {
    method: 'POST',
    body: JSON.stringify({ filters })
  });
}

export async function getAvaDashboardStats() {
  return fetchFromApi('/api/ava-reports/dashboard-stats', {
    method: 'GET',
    cache: 'no-store'
  });
}



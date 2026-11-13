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
  try {
    return await fetchFromApi('/api/ava-reports/consolidated', {
      method: 'POST',
      body: JSON.stringify({ page, size, filters })
    });
  } catch (error: any) {
    console.error("[getConsolidatedAvaData Action Error]:", error?.message);
    return null;
  }
}

export async function exportConsolidatedAvaData(filters: any) {
  try {
    const res = await fetchFromApi('/api/ava-reports/consolidated/export', {
      method: 'POST',
      body: JSON.stringify({ filters })
    });
    return Array.isArray(res) ? res : [];
  } catch (error: any) {
    console.error("[exportConsolidatedAvaData Action Error]:", error?.message);
    return [];
  }
}

export async function getAvaDashboardStats() {
  try {
    return await fetchFromApi('/api/ava-reports/dashboard-stats', {
      method: 'GET',
      cache: 'no-store'
    });
  } catch (error: any) {
    console.error("[getAvaDashboardStats Action Error]:", error?.message);
    return null;
  }
}



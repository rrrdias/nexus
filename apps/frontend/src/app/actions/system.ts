"use server"

import { cache } from "react"
import { fetchFromApi } from "./api"

export async function getAllModules() {
  try {
    const res = await fetchFromApi('/api/system/modules', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.error("[getAllModules Action Error]:", err?.message);
    return [];
  }
}

const fetchSidebarModulesMemoized = cache(async () => {
  try {
    const res = await fetchFromApi('/api/system/sidebar-modules', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.error("[getSidebarModules Action Error]:", err?.message);
    return [];
  }
})

export async function getSidebarModules() {
  return fetchSidebarModulesMemoized();
}

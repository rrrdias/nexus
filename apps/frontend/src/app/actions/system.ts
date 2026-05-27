"use server"

import { fetchFromApi } from "./api"

export async function getAllModules() {
  return fetchFromApi('/api/system/modules', { method: 'GET' });
}

export async function getSidebarModules() {
  return fetchFromApi('/api/system/sidebar-modules', { method: 'GET' });
}

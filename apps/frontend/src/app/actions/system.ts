"use server"

import { cache } from "react"
import { fetchFromApi } from "./api"

export async function getAllModules() {
  return fetchFromApi('/api/system/modules', { method: 'GET' });
}

const fetchSidebarModulesMemoized = cache(async () => {
  return fetchFromApi('/api/system/sidebar-modules', { method: 'GET' });
})

export async function getSidebarModules() {
  return fetchSidebarModulesMemoized();
}

"use server"

import { fetchFromApi } from "./api"
import { revalidatePath } from "next/cache"

export async function getGroups() {
  return fetchFromApi('/api/groups', { method: 'GET' });
}

export async function getGroupWithModules(groupId: string) {
  return fetchFromApi(`/api/groups/${groupId}`, { method: 'GET' });
}

export async function createGroup(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const moduleIds = formData.getAll("moduleIds") as string[];

  await fetchFromApi('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description, moduleIds })
  });
  revalidatePath("/admin/groups");
  return { success: true };
}

export async function updateGroup(groupId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const moduleIds = formData.getAll("moduleIds") as string[];

  await fetchFromApi(`/api/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description, moduleIds })
  });
  revalidatePath("/admin/groups");
  return { success: true };
}

export async function deleteGroup(groupId: string) {
  await fetchFromApi(`/api/groups/${groupId}`, { method: 'DELETE' });
  revalidatePath("/admin/groups");
  return { success: true };
}

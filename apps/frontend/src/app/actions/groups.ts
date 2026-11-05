"use server"

import { fetchFromApi } from "./api"
import { revalidatePath } from "next/cache"

export type ActionResult<T = any> =
  | { success: true; data?: T }
  | { success: false; error: string }

export async function getGroups() {
  return fetchFromApi('/api/groups', { method: 'GET' });
}

export async function getGroupWithModules(groupId: string) {
  return fetchFromApi(`/api/groups/${groupId}`, { method: 'GET' });
}

export async function createGroup(formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const moduleIds = formData.getAll("moduleIds") as string[];

    const res = await fetchFromApi('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, moduleIds })
    });
    revalidatePath("/admin/groups");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao criar grupo." };
  }
}

export async function updateGroup(groupId: string, formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const moduleIds = formData.getAll("moduleIds") as string[];

    const res = await fetchFromApi(`/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, moduleIds })
    });
    revalidatePath("/admin/groups");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar grupo." };
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  try {
    const res = await fetchFromApi(`/api/groups/${groupId}`, { method: 'DELETE' });
    revalidatePath("/admin/groups");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao excluir grupo." };
  }
}

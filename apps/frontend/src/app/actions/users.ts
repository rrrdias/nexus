"use server"

import { fetchFromApi } from "./api"
import { revalidatePath } from "next/cache"

export type ActionResult<T = any> =
  | { success: true; data?: T }
  | { success: false; error: string }

export async function getUsers() {
  try {
    const res = await fetchFromApi('/api/users', { method: 'GET' });
    return Array.isArray(res) ? res : [];
  } catch (err: any) {
    console.error("[getUsers Action Error]:", err?.message);
    return [];
  }
}

export async function getUserForEdit(userId: string) {
  try {
    return await fetchFromApi(`/api/users/${userId}`, { method: 'GET' });
  } catch (err: any) {
    console.error("[getUserForEdit Action Error]:", err?.message);
    return null;
  }
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const userid = formData.get("userid") as string;
    const isActive = formData.get("isActive") === "on";
    const groupIds = formData.getAll("groupIds") as string[];
    const moduleIds = formData.getAll("moduleIds") as string[];

    const res = await fetchFromApi('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds })
    });
    revalidatePath("/admin/users");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao cadastrar usuário." };
  }
}

export async function updateUser(userId: string, formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const userid = formData.get("userid") as string;
    const isActive = formData.get("isActive") === "on";
    const groupIds = formData.getAll("groupIds") as string[];
    const moduleIds = formData.getAll("moduleIds") as string[];

    const res = await fetchFromApi(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds })
    });
    revalidatePath("/admin/users");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao atualizar usuário." };
  }
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const res = await fetchFromApi(`/api/users/${userId}/active`, {
      method: 'PUT',
      body: JSON.stringify({ isActive })
    });
    revalidatePath("/admin/users");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao alterar status do usuário." };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const res = await fetchFromApi(`/api/users/${userId}`, { method: 'DELETE' });
    revalidatePath("/admin/users");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erro ao excluir usuário." };
  }
}

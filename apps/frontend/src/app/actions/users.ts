"use server"

import { fetchFromApi } from "./api"
import { revalidatePath } from "next/cache"

export async function getUsers() {
  return fetchFromApi('/api/users', { method: 'GET' });
}

export async function getUserForEdit(userId: string) {
  return fetchFromApi(`/api/users/${userId}`, { method: 'GET' });
}

export async function createUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const userid = formData.get("userid") as string;
  const isActive = formData.get("isActive") === "on";
  const groupIds = formData.getAll("groupIds") as string[];
  const moduleIds = formData.getAll("moduleIds") as string[];

  await fetchFromApi('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds })
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUser(userId: string, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const userid = formData.get("userid") as string;
  const isActive = formData.get("isActive") === "on";
  const groupIds = formData.getAll("groupIds") as string[];
  const moduleIds = formData.getAll("moduleIds") as string[];

  await fetchFromApi(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, email, password, userid, isActive, groupIds, moduleIds })
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await fetchFromApi(`/api/users/${userId}/active`, {
    method: 'PUT',
    body: JSON.stringify({ isActive })
  });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  await fetchFromApi(`/api/users/${userId}`, { method: 'DELETE' });
  revalidatePath("/admin/users");
  return { success: true };
}

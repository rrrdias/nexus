"use server"

import { fetchFromApi } from "./api"
import { revalidatePath } from "next/cache"

export async function getLocals(options: { todos?: boolean } = {}) {
  const url = options.todos ? '/api/scheduling/locals?todos=true' : '/api/scheduling/locals';
  return fetchFromApi(url, { method: 'GET' });
}

export async function createLocal(data: { nome: string; endereco: string; linkLocal?: string; telefone?: string }) {
  const res = await fetchFromApi('/api/scheduling/locals', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  revalidatePath("/admin/scheduling");
  return res;
}

export async function updateLocal(id: string, data: Partial<{ nome: string; endereco: string; linkLocal: string; telefone: string; status: boolean }>) {
  const res = await fetchFromApi(`/api/scheduling/locals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  revalidatePath("/admin/scheduling");
  return res;
}

export async function getOptions(filters: { localId?: string; data?: string; apenasDisponiveis?: boolean; incluirInativos?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.localId) params.append('localId', filters.localId);
  if (filters.data) params.append('data', filters.data);
  if (filters.apenasDisponiveis) params.append('apenasDisponiveis', 'true');
  if (filters.incluirInativos) params.append('incluirInativos', 'true');
  
  return fetchFromApi(`/api/scheduling/options?${params.toString()}`, { method: 'GET' });
}

export async function createOption(data: { localId: string; data: string; horaInicio: string; horaFim: string; vagas: number }) {
  const res = await fetchFromApi('/api/scheduling/options', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  revalidatePath("/admin/scheduling");
  return res;
}

export async function updateOption(id: string, data: Partial<{ vagas: number; status: boolean }>) {
  const res = await fetchFromApi(`/api/scheduling/options/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  revalidatePath("/admin/scheduling");
  return res;
}

export async function getStudentProfile(matricula: string, periodo: string) {
  return fetchFromApi(`/api/scheduling/profile/${matricula}/${periodo}`, { method: 'GET' });
}

export async function getBookings(filters: {
  matricula?: string;
  localId?: string;
  periodo?: string;
  data?: string;
  status?: string;
  page?: number;
  size?: number;
} = {}) {
  const params = new URLSearchParams();
  if (filters.matricula) params.append('matricula', filters.matricula);
  if (filters.localId) params.append('localId', filters.localId);
  if (filters.periodo) params.append('periodo', filters.periodo);
  if (filters.data) params.append('data', filters.data);
  if (filters.status) params.append('status', filters.status);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.size) params.append('size', String(filters.size));

  return fetchFromApi(`/api/scheduling/bookings?${params.toString()}`, { method: 'GET' });
}

export async function createBooking(data: { opcaoId: string; matricula: string; periodo: string }) {
  try {
    const res = await fetchFromApi('/api/scheduling/bookings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    revalidatePath("/admin/scheduling");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao criar agendamento." };
  }
}

export async function concludeBooking(id: string) {
  try {
    const res = await fetchFromApi(`/api/scheduling/bookings/${id}/conclude`, {
      method: 'POST'
    });
    revalidatePath("/admin/scheduling");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao registrar presença." };
  }
}

export async function markAbsentBooking(id: string) {
  try {
    const res = await fetchFromApi(`/api/scheduling/bookings/${id}/absent`, {
      method: 'POST'
    });
    revalidatePath("/admin/scheduling");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao registrar falta." };
  }
}

export async function cancelBooking(id: string) {
  try {
    const res = await fetchFromApi(`/api/scheduling/bookings/${id}`, {
      method: 'DELETE'
    });
    revalidatePath("/admin/scheduling");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao cancelar agendamento." };
  }
}

export async function importBookings(bookings: any[]) {
  try {
    const res = await fetchFromApi('/api/scheduling/import', {
      method: 'POST',
      body: JSON.stringify({ bookings })
    });
    revalidatePath("/admin/scheduling");
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao importar agendamentos." };
  }
}

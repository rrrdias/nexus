"use server"

import { fetchFromApi } from "./api"

export interface JobStatusResult {
  id: string;
  queue: string;
  name: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";
  progress: number;
  step?: string;
  data: any;
  result?: any;
  failedReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
}

export async function getJobStatus(queue: string, jobId: string): Promise<{ success: boolean; data?: JobStatusResult; error?: string }> {
  try {
    const res = await fetchFromApi(`/api/jobs/${encodeURIComponent(queue)}/${encodeURIComponent(jobId)}/status`, {
      method: 'GET',
    });
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar status do job." };
  }
}

"use client";

/** Client-safe config. Only NEXT_PUBLIC_* values are available in the browser. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Harbor";
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
// The authoritative limit is enforced server-side; this is the local soft counter default.
export const FREE_DAILY_TASK_BUDGET = Number(process.env.NEXT_PUBLIC_FREE_DAILY_TASK_BUDGET) || 15;
export const MAX_ATTACHMENTS = Number(process.env.NEXT_PUBLIC_MAX_ATTACHMENTS_PER_TASK) || 6;
export const MAX_FILE_BYTES = (Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10) * 1_000_000;

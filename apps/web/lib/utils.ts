import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format number to fixed decimals
export function toFixed(value: number, decimals: number) {
  return value.toFixed(decimals);
}

// Format date to readable string
export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  });
}
/**
 * Validation utilities
 */

/**
 * Check if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if a market question is valid
 */
export function isValidMarketQuestion(question: string): boolean {
  return question.trim().length >= 10 && question.trim().length <= 500;
}

/**
 * Check if market end time is valid
 */
export function isValidEndTime(endTime: number): boolean {
  const now = Date.now() / 1000;
  const minTime = now + 3600; // At least 1 hour in future
  const maxTime = now + 365 * 24 * 3600; // Max 1 year in future
  
  return endTime >= minTime && endTime <= maxTime;
}

/**
 * Check if amount is valid (positive and not zero)
 */
export function isValidAmount(amount: bigint): boolean {
  return amount > 0n;
}

/**
 * Check if outcomes array is valid
 */
export function isValidOutcomes(outcomes: string[]): boolean {
  if (outcomes.length < 2 || outcomes.length > 10) {
    return false;
  }
  
  // Check each outcome is not empty and unique
  const uniqueOutcomes = new Set(outcomes.map((o) => o.trim().toLowerCase()));
  return uniqueOutcomes.size === outcomes.length && outcomes.every((o) => o.trim().length > 0);
}

/**
 * Sanitize market question
 */
export function sanitizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}

/**
 * Sanitize outcome text
 */
export function sanitizeOutcome(outcome: string): string {
  return outcome.trim().replace(/\s+/g, " ");
}


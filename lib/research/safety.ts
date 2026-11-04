/* Post-checks on model output. The prompts already forbid this content;
   these filters are the backstop that does not rely on the model. */

const FINANCIAL =
  /\b(net worth|networth|salary|salaries|income|wealth(y)?|millionaire|billionaire|home value|house value|property value|compensation|stock awards?|purchasing power|can afford|affluent|high[- ]net[- ]worth)\b/i;
const PROTECTED =
  /\b(religio\w*|ethnicit\w*|racial|race\b|sexual orientation|disabilit\w*|pregnan\w*|marital status|national origin)\b/i;
const PHONE = /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const STREET =
  /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z][\w'-]*(?:\s[A-Z][\w'-]*){0,3}\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Circle|Cir|Trail|Trl)\b\.?/;

export type SafetyReason = "financial" | "protected" | "contact";

export function sensitiveReason(textValue: string): SafetyReason | null {
  if (FINANCIAL.test(textValue)) return "financial";
  if (PROTECTED.test(textValue)) return "protected";
  if (PHONE.test(textValue) || EMAIL.test(textValue) || STREET.test(textValue)) return "contact";
  return null;
}

export interface FilterOutcome<T> {
  kept: T[];
  removed: Record<SafetyReason, number>;
}

export function filterSensitive<T>(items: T[], textOf: (t: T) => string): FilterOutcome<T> {
  const removed: Record<SafetyReason, number> = { financial: 0, protected: 0, contact: 0 };
  const kept = items.filter((item) => {
    const reason = sensitiveReason(textOf(item));
    if (reason) removed[reason]++;
    return !reason;
  });
  return { kept, removed };
}

export function safetyNotes(removed: Record<SafetyReason, number>): string[] {
  const notes: string[] = [];
  if (removed.financial)
    notes.push(
      `Removed ${removed.financial} statement(s) about personal finances or compensation. This tool does not assess income, wealth or purchasing power.`,
    );
  if (removed.protected)
    notes.push(`Removed ${removed.protected} statement(s) touching on protected personal characteristics.`);
  if (removed.contact)
    notes.push(`Removed ${removed.contact} statement(s) containing personal contact or address details.`);
  return notes;
}

export function mergeRemoved(...all: Record<SafetyReason, number>[]): Record<SafetyReason, number> {
  return all.reduce(
    (acc, r) => ({
      financial: acc.financial + r.financial,
      protected: acc.protected + r.protected,
      contact: acc.contact + r.contact,
    }),
    { financial: 0, protected: 0, contact: 0 },
  );
}

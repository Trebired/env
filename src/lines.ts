import { toTrimmedString } from "@trebired/utils";

type EnvMap = Record<string, string>;
type EnvAssignment = {
  key: string;
  value: string;
};
type FormatEnvAssignmentOptions = {
  quote?: boolean;
};

function stripEnvQuotes(value: unknown): string {
  const text = String(value || "");
  if (text.length < 2) return text;
  const first = text[0];
  const last = text[text.length - 1];
  if ((first === "'" && last === "'") || (first === `"` && last === `"`)) {
    return text.slice(1, -1);
  }
  return text;
}

function parseEnvAssignmentLine(value: unknown): EnvAssignment | null {
  let line = toTrimmedString(value);
  if (!line || line.startsWith("#")) return null;
  if (line.startsWith("export ")) line = line.slice(7).trim();
  const eq = line.indexOf("=");
  if (eq <= 0) return null;
  const key = line.slice(0, eq).trim();
  if (!key) return null;
  return { key, value: stripEnvQuotes(line.slice(eq + 1).trim()) };
}

function parseEnvText(text: unknown): EnvMap {
  const out: EnvMap = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const assignment = parseEnvAssignmentLine(line);
    if (assignment) out[assignment.key] = assignment.value;
  }
  return out;
}

function formatEnvAssignment(
  key: unknown,
  value: unknown,
  options: FormatEnvAssignmentOptions = {},
): string {
  const safeValue = String(value ?? "");
  return `${toTrimmedString(key)}=${
  options.quote === false ? safeValue : JSON.stringify(safeValue)
  }`;
}

function sortEnvKeys(keys: readonly unknown[]): string[] {
  return keys.map((key) => toTrimmedString(key)).filter(Boolean).sort();
}

function serializeEnvLines(lines: readonly unknown[]): string {
  const body = lines.map((line) => String(line || "").trim()).filter(Boolean);
  return body.length ? `${body.join("\n")}\n` : "";
}

function updateEnvTextValue(
  text: unknown,
  key: string,
  value: unknown,
  options: FormatEnvAssignmentOptions = {},
): string {
  const out: string[] = [];
  const seen = new Set<string>();
  let replaced = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const assignment = parseEnvAssignmentLine(line);
    if (!assignment || seen.has(assignment.key)) continue;
    seen.add(assignment.key);
    if (assignment.key === key) replaced = true;
    out.push(formatEnvAssignment(assignment.key, assignment.key === key ? value : assignment.value, options));
  }
  if (!replaced) out.push(formatEnvAssignment(key, value, options));
  return serializeEnvLines(out);
}

export {
  formatEnvAssignment,
  parseEnvAssignmentLine,
  parseEnvText,
  serializeEnvLines,
  sortEnvKeys,
  stripEnvQuotes,
  updateEnvTextValue,
};
export type { EnvAssignment, EnvMap, FormatEnvAssignmentOptions };

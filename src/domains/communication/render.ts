import type { TemplateVars } from './types';

// Substitute {{key}} placeholders with values from vars. Unknown keys
// render as empty string. Whitespace inside the braces is tolerated
// ({{ guest_name }}). Pure — reused by the handler and the editor preview.
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => vars[key] ?? '');
}

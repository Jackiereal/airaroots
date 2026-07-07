import { registerAllHandlers } from './register-handlers';

let initialized = false;

export async function ensureHandlers(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await registerAllHandlers();
}

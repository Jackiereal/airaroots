import { NextResponse } from 'next/server';
import { AppError } from '../errors/app-error';

function isZodError(err: unknown): err is { issues: unknown[] } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'issues' in err &&
    Array.isArray((err as Record<string, unknown>)['issues']) &&
    (err as Record<string, unknown>)['name'] === 'ZodError'
  );
}

export function handleApiError(error: unknown, context: string): NextResponse {
  if (isZodError(error)) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  console.error(`[${context}]`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

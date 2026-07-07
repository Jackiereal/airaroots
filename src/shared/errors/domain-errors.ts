import { AppError } from './app-error';

export class ConflictError extends AppError {
  constructor(message: string, public conflicts: unknown[]) {
    super(message, 409, 'RESERVATION_CONFLICT');
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Cannot transition reservation from '${from}' to '${to}'`, 422, 'INVALID_STATUS_TRANSITION');
    this.name = 'InvalidStatusTransitionError';
  }
}

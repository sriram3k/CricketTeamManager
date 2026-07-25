/**
 * Application errors carry a status plus optional per-field messages, so the
 * mobile client can render validation inline rather than dumping raw API text.
 */
export class AppError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    opts: { code?: string; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = opts.code ?? 'error';
    this.fieldErrors = opts.fieldErrors;
  }
}

export const badRequest = (message: string, fieldErrors?: Record<string, string>) =>
  new AppError(400, message, { code: 'bad_request', fieldErrors });

export const validationError = (fieldErrors: Record<string, string>) =>
  new AppError(422, 'Please correct the highlighted fields', {
    code: 'validation_error',
    fieldErrors,
  });

export const unauthorized = (message = 'Not authenticated') =>
  new AppError(401, message, { code: 'unauthorized' });

export const forbidden = (message = 'You do not have access to this') =>
  new AppError(403, message, { code: 'forbidden' });

export const notFound = (message = 'Not found') =>
  new AppError(404, message, { code: 'not_found' });

export const conflict = (message: string, fieldErrors?: Record<string, string>) =>
  new AppError(409, message, { code: 'conflict', fieldErrors });

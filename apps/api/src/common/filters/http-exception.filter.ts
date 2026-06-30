import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details: unknown[];
}

/**
 * Global exception filter that formats all HTTP errors into a consistent response shape.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Catches and formats exceptions into a standardized error response.
   * @param exception - The thrown exception
   * @param host - The arguments host providing access to the response
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? exception.message;
        error = (resp['error'] as string) ?? 'Error';
        if (Array.isArray(resp['message'])) {
          details = resp['message'] as unknown[];
          message = 'Validation failed';
        }
      }

      error = error || HttpStatus[statusCode] || 'Error';
    }

    const body: ErrorResponse = {
      statusCode,
      error,
      message,
      details,
    };

    response.status(statusCode).json(body);
  }
}

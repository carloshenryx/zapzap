/**
 * Standard success response
 */
export function successResponse(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        ...data
    });
}

/**
 * Standard error response
 */
export function errorResponse(res, message, statusCode = 500) {
    return res.status(statusCode).json({
        success: false,
        error: message,
        message
    });
}

export function errorFromException(res, error, message = 'Unexpected error', statusCode = 500) {
    const safeMessage = String(message || 'Unexpected error');
    const details = error && typeof error === 'object' && 'message' in error ? String(error.message || '') : '';
    const payload = details && details !== safeMessage ? `${safeMessage}: ${details}` : safeMessage;
    return errorResponse(res, payload, statusCode);
}

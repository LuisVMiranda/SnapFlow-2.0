class HttpError extends Error {
  constructor(status, message, code = 'error', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeMulterError(error) {
  if (!error || error.name !== 'MulterError') return null;

  if (error.code === 'LIMIT_FILE_SIZE') {
    return new HttpError(
      413,
      'Uma ou mais fotos excedem o limite de upload configurado.',
      'upload_file_too_large'
    );
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new HttpError(
      400,
      'Quantidade máxima de fotos excedida para este envio. Envie menos arquivos por vez ou ajuste MAX_FILES_PER_UPLOAD no backend.',
      'upload_file_count_exceeded'
    );
  }

  return new HttpError(400, error.message || 'Upload inválido. Envie apenas imagens nos formatos aceitos e tente novamente.', error.code || 'upload_error');
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalizedError = normalizeMulterError(error) || error;
  const status = Number(normalizedError.status) || 500;
  if (status >= 500) console.error(normalizedError);
  const payload = {
    error: status >= 500
      ? 'Erro interno do servidor. Verifique o terminal APP FOTOGRAFIA - SERVIDOR para detalhes e reinicie o backend se a falha persistir.'
      : normalizedError.message,
    code: normalizedError.code || 'error',
  };
  if (normalizedError.details) payload.details = normalizedError.details;
  res.status(status).json(payload);
}

module.exports = { HttpError, asyncHandler, errorHandler };

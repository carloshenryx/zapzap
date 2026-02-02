/**
 * Utilitário de Toast - Usar com sonner
 * Exporta funções diretas para usar em qualquer lugar do sistema
 * sem precisar de hook
 */
import { toast } from 'sonner';

const defaultOptions = {
  duration: 5000,
  closeButton: true,
};

export const toastSuccess = (message, options = {}) => {
  toast.success(message, { ...defaultOptions, ...options });
};

export const toastError = (message, options = {}) => {
  toast.error(message, { ...defaultOptions, ...options });
};

export const toastInfo = (message, options = {}) => {
  toast.info(message, { ...defaultOptions, ...options });
};

export const toastLoading = (message, options = {}) => {
  return toast.loading(message, {
    duration: Infinity,
    closeButton: false,
    ...options,
  });
};

export const toastPromise = (promise, messages, options = {}) => {
  return toast.promise(promise, {
    loading: messages.loading || 'Processando...',
    success: messages.success || 'Sucesso!',
    error: messages.error || 'Erro ao processar',
    ...defaultOptions,
    ...options,
  });
};

export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};
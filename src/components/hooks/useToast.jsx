import { toast } from 'sonner';

/**
 * Hook customizado para notificações toast em todo o sistema
 * Padroniza sucesso, erro, carregamento e informações
 * Duração padrão: 5 segundos com possibilidade de fechar
 */
export function useToast() {
  return {
    success: (message, options = {}) => {
      toast.success(message, {
        duration: 5000,
        closeButton: true,
        ...options,
      });
    },

    error: (message, options = {}) => {
      toast.error(message, {
        duration: 5000,
        closeButton: true,
        ...options,
      });
    },

    info: (message, options = {}) => {
      toast.info(message, {
        duration: 5000,
        closeButton: true,
        ...options,
      });
    },

    loading: (message, options = {}) => {
      return toast.loading(message, {
        duration: Infinity,
        closeButton: false,
        ...options,
      });
    },

    promise: (promise, messages, options = {}) => {
      return toast.promise(promise, {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
        duration: 5000,
        closeButton: true,
        ...options,
      });
    },

    dismiss: (toastId) => {
      if (toastId) {
        toast.dismiss(toastId);
      } else {
        toast.dismiss();
      }
    },
  };
}
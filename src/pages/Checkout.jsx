import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, CreditCard, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { QRCodeSVG } from 'qrcode.react';

export default function Checkout() {
  const urlParams = new URLSearchParams(window.location.search);
  const isTrialExpired = urlParams.get('trial_expired') === 'true';
  const existingTenantId = urlParams.get('tenant_id');
  const selectedPlanFromUrl = urlParams.get('plan');
  const { userProfile } = useAuth();

  // Use AuthContext userProfile
  const user = userProfile;

  const { data: plansFromDB = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['available-plans-checkout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const plans = plansFromDB.reduce((acc, plan) => {
    acc[plan.name] = {
      name: plan.name,
      price: plan.price,
      features: (plan.features || []).map(f => typeof f === 'string' ? f : f.name)
    };
    return acc;
  }, {});

  // Vincular tenant após login
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenant_id');
    const userEmail = urlParams.get('user_email');
    const stepParam = urlParams.get('step');

    if (user && stepParam === 'link' && !user.tenant_id) {
      const linkTenant = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('link-tenant-to-user', {
            body: {
              tenant_id: tenantId,
              user_email: userEmail || user.email
            }
          });

          if (error) throw error;

          if (data && data.success) {
            toast.success('Conta vinculada com sucesso!');
            setTimeout(() => {
              window.location.href = createPageUrl('Dashboard');
            }, 1500);
          } else {
            toast.error(data?.error || 'Erro ao vincular conta');
          }
        } catch (error) {
          console.error('Erro ao vincular:', error);
          toast.error('Erro ao vincular conta');
        }
      };

      linkTenant();
    } else if (user && user.tenant_id && stepParam === 'link') {
      // Já está vinculado, redirecionar
      setTimeout(() => {
        window.location.href = createPageUrl('Dashboard');
      }, 500);
    }
  }, [user]);

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [buyerData, setBuyerData] = useState({
    full_name: '',
    email: '',
    cpf: '',
    phone: '',
    company_name: '',
    segment: '',
    employees: ''
  });
  const [formData, setFormData] = useState({
    company_name: '',
    segment: '',
    employees: '',
    phone: ''
  });
  const [createdTenantId, setCreatedTenantId] = useState(null);

  const selectedPlanName = selectedPlanFromUrl || 'Basic';

  const planDetails = plansFromDB.find(p => p.name.toLowerCase() === selectedPlanName.toLowerCase());
  const plan = planDetails ? { name: planDetails.name, price: planDetails.price, trial_duration_days: planDetails.trial_duration_days, billing_cycle: planDetails.billing_cycle } : { name: 'Basic', price: 97, billing_cycle: 'monthly' };

  const billingCycleLabel = (() => {
    const v = String(plan.billing_cycle || '').toLowerCase();
    if (v === 'annual') return 'Cobrança anual';
    if (v === 'quarterly') return 'Cobrança trimestral';
    return 'Cobrança mensal';
  })();

  const priceSuffix = (() => {
    const v = String(plan.billing_cycle || '').toLowerCase();
    if (v === 'annual') return '/ano';
    if (v === 'quarterly') return '/tri';
    return '/mês';
  })();

  const validateBuyerData = () => {
    if (!buyerData.full_name.trim()) {
      toast.error('Preencha o nome completo');
      return false;
    }
    if (!buyerData.email.trim()) {
      toast.error('Preencha o email');
      return false;
    }
    if (!buyerData.cpf.trim()) {
      toast.error('Preencha o CPF');
      return false;
    }
    if (!buyerData.phone.trim()) {
      toast.error('Preencha o telefone');
      return false;
    }
    if (!buyerData.company_name.trim()) {
      toast.error('Preencha o nome da empresa');
      return false;
    }
    return true;
  };

  const handleProcessPayment = async (method) => {
    if (!validateBuyerData()) {
      return;
    }

    setIsProcessing(true);
    try {
      const billingType = method === 'pix' ? 'PIX' : 'CREDIT_CARD';
      const functionName = 'create-asaas-payment';
      const payload = {
        plan_type: plan.name,
        customer_email: buyerData.email,
        customer_name: buyerData.full_name,
        customer_phone: buyerData.phone,
        customer_cpf: buyerData.cpf,
        billingType: billingType
      };

      // Se for upgrade de teste expirado
      if (isTrialExpired && existingTenantId) {
        // Maybe pass tenant_id if needed by the function
        payload.tenant_id = existingTenantId;
        payload.is_upgrade = true;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;

      if (method === 'pix') {
        setPixData(data);
        setPaymentMethod('pix');
        startPaymentPolling(data.payment_id);
      } else {
        window.location.href = data.invoice_url;
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar pagamento: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const startPaymentPolling = (paymentId) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-asaas-payment-status', {
          body: { payment_id: paymentId }
        });

        if (!error && data && data.isPaid) {
          clearInterval(interval);
          toast.success('Pagamento confirmado!');
          handlePaymentSuccess();
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000);

    setTimeout(() => clearInterval(interval), 600000);
  };

  const handleVerifyPayment = async () => {
    if (!pixData?.payment_id) {
      toast.error('ID de pagamento não encontrado');
      return;
    }

    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-asaas-payment-status', {
        body: { payment_id: pixData.payment_id }
      });

      if (!error && data && data.isPaid) {
        toast.success('Pagamento confirmado!');
        handlePaymentSuccess();
      } else {
        toast.warning('Pagamento ainda não foi identificado. Por favor, aguarde ou tente novamente em instantes.');
      }
    } catch (error) {
      toast.error('Erro ao verificar pagamento');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Se for upgrade de teste expirado, atualizar o tenant existente
    if (isTrialExpired && existingTenantId) {
      try {
        const { data, error } = await supabase.functions.invoke('upgrade-tenant-plan', {
          body: {
            tenant_id: existingTenantId,
            new_plan_type: plan.name
          }
        });

        if (!error && data && data.success) {
          toast.success('Plano atualizado com sucesso!');
          setTimeout(() => {
            window.location.href = createPageUrl('Dashboard');
          }, 1500);
        } else {
          throw new Error(data?.error || 'Erro ao atualizar');
        }
      } catch (error) {
        toast.error('Erro ao atualizar plano');
      }
      return;
    }

    setStep(2);
    toast.success('Pagamento aprovado com sucesso!');
  };

  const handleCompanyRegistration = async (e) => {
    e.preventDefault();

    if (!formData.company_name) {
      toast.error('Preencha o nome da empresa');
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-tenant-only', {
        body: {
          company_name: formData.company_name,
          contact_phone: formData.phone,
          plan_type: plan.name,
          segment: formData.segment,
          employees: formData.employees,
          owner_user_id: user?.id
        }
      });

      if (error) throw error;

      if (data && data.success) {
        setCreatedTenantId(data.tenant_id);
        toast.success('Empresa cadastrada! Agora faça login para continuar.');
        setTimeout(() => {
          // Redirect to login with proper params
          window.location.href = `/login?tenant_id=${data.tenant_id}&step=link`;
        }, 2000);
      } else {
        toast.error(data?.error || 'Erro ao criar empresa');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar cadastro: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center mb-12 gap-4"
        >
          <motion.div
            className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}
            whileHover={{ scale: 1.05 }}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${step >= 1 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200'
              }`}>
              {step > 1 ? <CheckCircle2 className="w-6 h-6" /> : '1'}
            </div>
            <span className="hidden sm:inline font-medium">Pagamento</span>
          </motion.div>
          <div className={`w-16 h-1.5 rounded transition-all duration-300 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'
            }`}></div>
          <motion.div
            className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}
            whileHover={{ scale: 1.05 }}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${step >= 2 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200'
              }`}>
              2
            </div>
            <span className="hidden sm:inline font-medium">Cadastro</span>
          </motion.div>
        </motion.div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            {isTrialExpired && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold text-orange-900 mb-2">⏰ Seu Teste Grátis Expirou</h3>
                <p className="text-orange-700">
                  Continue aproveitando todos os recursos do AvaliaZap escolhendo um plano abaixo.
                </p>
              </div>
            )}

            <h2 className="text-3xl font-bold mb-6 text-slate-800">
              Finalize seu Pedido
            </h2>

            {/* Plan Summary */}
            <div className="bg-slate-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">Plano Selecionado</h3>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-800">{plan.name}</p>
                  <p className="text-sm text-slate-500">{billingCycleLabel}</p>
                </div>
                <p className="text-2xl font-bold text-indigo-600">R$ {plan.price}{priceSuffix}</p>
              </div>
            </div>

            {/* Buyer Personal Data */}
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-4 text-slate-800">Dados Pessoais</h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      value={buyerData.full_name}
                      onChange={(e) => setBuyerData({ ...buyerData, full_name: e.target.value })}
                      placeholder="Ex: João Silva"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={buyerData.email}
                      onChange={(e) => setBuyerData({ ...buyerData, email: e.target.value })}
                      placeholder="Ex: joao@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={buyerData.cpf}
                      onChange={(e) => setBuyerData({ ...buyerData, cpf: e.target.value })}
                      placeholder="Ex: 000.000.000-00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      value={buyerData.phone}
                      onChange={(e) => setBuyerData({ ...buyerData, phone: e.target.value })}
                      placeholder="Ex: (00) 00000-0000"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_name_buyer">Nome da Empresa *</Label>
                  <Input
                    id="company_name_buyer"
                    value={buyerData.company_name}
                    onChange={(e) => setBuyerData({ ...buyerData, company_name: e.target.value })}
                    placeholder="Ex: Minha Empresa Ltda"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="segment_buyer">Segmento</Label>
                    <Input
                      id="segment_buyer"
                      value={buyerData.segment}
                      onChange={(e) => setBuyerData({ ...buyerData, segment: e.target.value })}
                      placeholder="Ex: Varejo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employees_buyer">Nº de Funcionários</Label>
                    <Input
                      id="employees_buyer"
                      value={buyerData.employees}
                      onChange={(e) => setBuyerData({ ...buyerData, employees: e.target.value })}
                      placeholder="Ex: 10-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <h3 className="font-semibold text-lg mb-4 text-slate-800">Escolha a Forma de Pagamento</h3>
            <div className="grid gap-4 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleProcessPayment('card')}
                disabled={isProcessing}
                className="group flex items-center gap-4 p-5 border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">Cartão de Crédito</p>
                  <p className="text-sm text-slate-500">Aprovação imediata • Parcelamento disponível</p>
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleProcessPayment('pix')}
                disabled={isProcessing}
                className="group flex items-center gap-4 p-5 border-2 border-slate-200 rounded-xl hover:border-green-500 hover:bg-green-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Smartphone className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-slate-800 group-hover:text-green-600 transition-colors">Pix</p>
                  <p className="text-sm text-slate-500">Pagamento instantâneo • Confirmação em segundos</p>
                </div>
              </motion.button>
            </div>

            {/* PIX Display */}
            {pixData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-8"
              >
                <h4 className="font-semibold text-green-900 mb-4 text-center text-lg">Pagamento via PIX</h4>

                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Valor:</p>
                      <p className="font-semibold text-slate-800">R$ {pixData.value}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Vencimento:</p>
                      <p className="font-semibold text-slate-800">{new Date(pixData.due_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-slate-500 text-xs">Descrição:</p>
                    <p className="text-slate-700 text-sm">Assinatura {plan.name} - AvaliaZap</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 mb-4 flex flex-col items-center">
                  <p className="text-sm text-slate-600 mb-3 font-medium">Escaneie o QR Code:</p>
                  {pixData.pix_qr_code ? (
                    <>
                      <QRCodeSVG
                        value={pixData.pix_qr_code}
                        size={200}
                        level="M"
                        includeMargin={true}
                      />
                      <p className="text-xs text-slate-500 mt-3 text-center">
                        Use o app do seu banco para escanear
                      </p>
                    </>
                  ) : (
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Gerando QR Code...</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg mb-4">
                  <p className="text-sm text-slate-600 mb-2 font-medium">Ou use o Pix Copia e Cola:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-slate-100 rounded text-xs text-slate-800 break-all font-mono">
                      {pixData.pix_copy_paste}
                    </code>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.pix_copy_paste);
                        toast.success('Chave PIX copiada!');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 px-4"
                    >
                      Copiar
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleVerifyPayment}
                  disabled={isCheckingPayment}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg disabled:opacity-50"
                >
                  {isCheckingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verificando Pagamento...
                    </>
                  ) : (
                    '✓ Já Realizei o Pagamento'
                  )}
                </Button>

                <p className="text-xs text-center text-green-700 mt-2">
                  💡 O sistema verifica automaticamente seu pagamento a cada 5 segundos
                </p>
              </motion.div>
            )}

            <p className="text-xs text-slate-500 text-center mt-4">
              Seus dados estão protegidos com criptografia SSL
            </p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold mb-2 text-slate-800">
                Pagamento Confirmado!
              </h2>
              <p className="text-slate-600">
                Agora vamos criar sua conta no AvaliaZap
              </p>
            </div>

            <form onSubmit={handleCompanyRegistration} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Ex: Minha Empresa Ltda"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segment">Segmento</Label>
                  <Input
                    id="segment"
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                    placeholder="Ex: Varejo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employees">Nº de Funcionários</Label>
                  <Input
                    id="employees"
                    value={formData.employees}
                    onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                    placeholder="Ex: 10-50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 Após criar a empresa, você será redirecionado para fazer login com sua conta existente ou criar uma nova conta.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 h-12"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Criando sua conta...
                  </>
                ) : (
                  'Criar Minha Conta'
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}

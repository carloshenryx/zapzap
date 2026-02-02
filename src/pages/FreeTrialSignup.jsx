import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Sparkles, X, AlertTriangle, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import ParticleEffectHero from '@/components/ui/particle-effect-for-hero';
import { useAuth } from '@/lib/AuthContext';

export default function FreeTrialSignup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    password: '',
    confirm_password: '',
  });

  const urlParams = new URLSearchParams(window.location.search);
  const hasNoTenantError = urlParams.get('error') === 'no_tenant';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name || !formData.email || !formData.phone || !formData.company_name || !formData.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsProcessing(true);

    try {
      const signupResult = await signUp(formData.email, formData.password, {
        full_name: formData.full_name,
        company_name: formData.company_name,
        phone: formData.phone,
      });

      if (!signupResult.success) {
        throw new Error(signupResult.error || 'Erro ao criar conta');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada');
      }

      const onboardResponse = await fetch('/api/tenants?action=onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_name: formData.company_name,
          contact_phone: formData.phone,
          plan_type: 'freetrial',
          full_name: formData.full_name,
        }),
      });

      const onboardData = await onboardResponse.json().catch(() => null);
      if (!onboardResponse.ok) {
        throw new Error(onboardData?.message || onboardData?.error || 'Erro ao iniciar teste grátis');
      }

      await supabase.auth.refreshSession().catch(() => {});
      setIsSuccess(true);
      toast.success('Teste grátis iniciado! Acessando sua conta...');
      setTimeout(() => {
        window.location.href = createPageUrl('Dashboard');
      }, 1500);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar cadastro: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const painPoints = [
    'Não consegue centralizar todas as avaliações e feedbacks dos clientes em um único lugar, gerando desorganização',
    'Não consegue acompanhar a satisfação dos clientes em tempo real',
    'Sua equipe não sabe quais clientes precisam de atenção ou acompanhamento imediato',
    'Não possui dados e relatórios confiáveis sobre o desempenho do atendimento'
  ];

  return (
    <ParticleEffectHero>
      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 max-w-3xl w-full my-auto"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Teste Grátis
            </h1>
            <p className="text-lg text-slate-700 font-medium">
              Experimente o AvaliaZap gratuitamente por 7 dias!
            </p>
          </div>

          {hasNoTenantError && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-amber-900 mb-2">
                    Você não possui cadastro no sistema
                  </h3>
                  <p className="text-amber-800 text-sm">
                    Para acessar o sistema, você precisa iniciar um teste grátis ou ser convidado por um administrador existente.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-red-50/80 border-2 border-red-200 rounded-2xl p-6 md:p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <h3 className="text-xl font-bold text-red-900">
                Sofre com algum desses pontos no seu dia a dia?
              </h3>
            </div>
            <ul className="space-y-3">
              {painPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3 text-red-800">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm md:text-base">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6 mb-8 text-center">
            <p className="text-green-900 font-semibold text-base md:text-lg leading-relaxed">
              Se você respondeu <span className="text-green-700 font-bold">SIM</span> para algum desses, não deixe de testar o <span className="font-bold">AvaliaZap gratuitamente</span> e comece a transformar o feedback dos seus clientes em ações estratégicas para o seu negócio!
            </p>
          </div>

          <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
              O que está incluído no teste grátis:
            </h3>
            <ul className="space-y-3">
              {[
                'Pesquisas por WhatsApp ilimitadas',
                'Dashboard com métricas em tempo real',
                'Até 2 usuários',
                'Suporte por email',
                '7 dias completos de acesso - sem cartão de crédito'
              ].map((item, idx) => (
                <li key={idx} className="text-sm md:text-base text-blue-800 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {isSuccess ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Conta criada com sucesso!</h3>
              <p className="text-green-800 text-sm">Redirecionando para o dashboard...</p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-slate-700 font-medium">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="h-12 bg-white/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ex: joao@email.com"
                  className="h-12 bg-white/80"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 font-medium">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Ex: (11) 99999-9999"
                  className="h-12 bg-white/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-slate-700 font-medium">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Ex: Minha Empresa Ltda"
                  className="h-12 bg-white/80"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">Senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="h-12 bg-white/80 pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-slate-700 font-medium">Confirmar Senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="confirm_password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    placeholder="••••••••"
                    className="h-12 bg-white/80 pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-14 text-lg font-bold shadow-xl hover:shadow-2xl transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Iniciando seu teste...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6 mr-2" />
                  Iniciar Teste Grátis Agora
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-600">
              Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade
            </p>
          </form>
          )}
        </motion.div>
      </div>
    </ParticleEffectHero>
  );
}

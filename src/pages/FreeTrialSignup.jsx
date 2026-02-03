import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, Mail, Sparkles, X, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import ParticleEffectHero from '@/components/ui/particle-effect-for-hero';
import { useAuth } from '@/lib/AuthContext';
import PhoneInput from '@/components/sendsurvey/PhoneInput';

const TOTAL_STEPS = 9;

export default function FreeTrialSignup() {
  const { signUp } = useAuth();

  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activationState, setActivationState] = useState({ mode: 'idle', message: '' });
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    company_name: '',
    phone: '',
    job_title: '',
    team_size: '',
    sells_to: '',
    signup_goal: '',
    acquisition_source: '',
  });

  const urlParams = new URLSearchParams(window.location.search);
  const hasNoTenantError = urlParams.get('error') === 'no_tenant';

  const painPoints = useMemo(() => ([
    'Centralizar avaliações e feedbacks em um único lugar (sem planilhas e caos)',
    'Acompanhar a satisfação dos clientes em tempo real',
    'Saber quais clientes precisam de atenção imediata',
    'Ter dados e relatórios confiáveis do atendimento',
  ]), []);

  const jobTitleOptions = useMemo(() => ([
    { value: 'dono', label: 'Dono(a) / Sócio(a)' },
    { value: 'gestor', label: 'Gestor(a)' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'comercial', label: 'Comercial' },
    { value: 'suporte', label: 'Atendimento / Suporte' },
    { value: 'ti', label: 'TI' },
    { value: 'outro', label: 'Outro' },
  ]), []);

  const teamSizeOptions = useMemo(() => ([
    'Só eu',
    '2-5 pessoas',
    '6-15 pessoas',
    '16-50 pessoas',
    '51+ pessoas',
  ]), []);

  const sellsToOptions = useMemo(() => ([
    'Empresas',
    'Pessoas Físicas',
    'Instituições',
    'Órgãos Públicos',
  ]), []);

  const goalOptions = useMemo(() => ([
    'Coletar avaliações',
    'Acompanhar NPS',
    'Melhorar atendimento',
    'Outros',
  ]), []);

  const acquisitionOptions = useMemo(() => ([
    'Anúncio',
    'Site',
    'Redes sociais',
    'Indicação',
    'Outros',
  ]), []);

  const progressPercent = useMemo(() => {
    const clamped = Math.min(Math.max(step, 1), TOTAL_STEPS);
    return Math.round((clamped / TOTAL_STEPS) * 100);
  }, [step]);

  const goToLogin = () => {
    window.location.href = createPageUrl('Login');
  };

  const exitWizard = () => {
    window.location.href = '/';
  };

  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const validateCurrentStep = () => {
    if (step === 1) {
      if (!formData.full_name || !formData.email || !formData.password) return 'Preencha nome, e-mail e senha';
      if (!isValidEmail(formData.email)) return 'Informe um e-mail válido';
      if (formData.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
    }

    if (step === 3) {
      if (!formData.full_name || !formData.email) return 'Preencha nome e e-mail';
      if (!isValidEmail(formData.email)) return 'Informe um e-mail válido';
    }

    if (step === 4) {
      if (!formData.password || !formData.confirm_password) return 'Preencha senha e confirmação';
      if (formData.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres';
      if (formData.password !== formData.confirm_password) return 'As senhas não coincidem';
    }

    if (step === 5) {
      if (!formData.company_name) return 'Informe o nome da empresa';
      if (!formData.phone) return 'Informe o telefone';
      const digits = (formData.phone || '').replace(/\D/g, '');
      if (digits.length !== 10 && digits.length !== 11) return 'Informe um telefone válido';
    }

    if (step === 6) {
      if (!formData.job_title) return 'Selecione seu cargo';
      if (!formData.team_size) return 'Selecione o tamanho da equipe';
    }

    if (step === 7) {
      if (!formData.sells_to) return 'Selecione para quem você atende/vende';
      if (!formData.signup_goal) return 'Selecione seu objetivo';
    }

    if (step === 8) {
      if (!formData.acquisition_source) return 'Selecione onde você conheceu o AvaliaZap';
    }

    return null;
  };

  const handlePrev = () => setStep((s) => Math.max(1, s - 1));

  const finishSignup = async () => {
    setIsProcessing(true);
    setActivationState({ mode: 'idle', message: '' });

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
        setActivationState({ mode: 'email_required', message: '' });
        setStep(9);
        return;
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
          job_title: formData.job_title,
          team_size: formData.team_size,
          sells_to: formData.sells_to,
          signup_goal: formData.signup_goal,
          acquisition_source: formData.acquisition_source,
        }),
      });

      const onboardData = await onboardResponse.json().catch(() => null);
      if (!onboardResponse.ok) {
        throw new Error(onboardData?.message || onboardData?.error || 'Erro ao iniciar teste grátis');
      }

      await supabase.auth.refreshSession().catch(() => {});
      setActivationState({ mode: 'ready', message: '' });
      toast.success('Conta criada! Teste grátis iniciado.');
      setStep(9);
    } catch (err) {
      toast.error(err?.message || 'Erro ao processar cadastro');
      setActivationState({ mode: 'error', message: err?.message || 'Erro ao processar cadastro' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = async () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (step === 8) {
      await finishSignup();
      return;
    }

    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const Chip = ({ value, selected, onSelect }) => (
    <Button
      type="button"
      variant="outline"
      className={selected ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : ''}
      onClick={() => onSelect(value)}
    >
      {value}
    </Button>
  );

  const StepShell = ({ title, subtitle, children }) => (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm md:text-base text-slate-600">{subtitle}</p> : null}
        </div>
        <Button type="button" variant="ghost" onClick={exitWizard} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-600 to-emerald-600" style={{ width: `${progressPercent}%` }} />
      </div>
      <div>{children}</div>
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={handlePrev} disabled={step === 1 || isProcessing} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="text-xs text-slate-500">Passo {step} de {TOTAL_STEPS}</div>
        <Button
          type="button"
          onClick={handleNext}
          disabled={isProcessing || step === 9}
          className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          {step === 8 ? (
            <>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Finalizar
            </>
          ) : (
            <>
              Avançar
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">Teste grátis por 7 dias</div>
                <div className="text-lg font-bold text-slate-900">AvaliaZap</div>
              </div>
            </div>

            <div className="bg-red-50/80 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="font-bold text-red-900">Você se identifica com isso?</div>
              </div>
              <ul className="space-y-3">
                {painPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-red-800">
                    <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 font-bold text-blue-900 mb-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                O que está incluído:
              </div>
              <ul className="space-y-2">
                {[
                  'Pesquisas por WhatsApp ilimitadas',
                  'Dashboard com métricas em tempo real',
                  'Até 2 usuários',
                  '7 dias completos de acesso (sem cartão)',
                ].map((item) => (
                  <li key={item} className="text-sm text-blue-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Criar conta</h1>
                <p className="text-sm text-slate-600">Comece pelo básico. Leva menos de 1 minuto.</p>
              </div>
              <Button type="button" variant="ghost" onClick={exitWizard} className="gap-2">
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>

            {hasNoTenantError && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900">Você não possui cadastro no sistema</div>
                    <div className="text-amber-800 text-sm">Inicie um teste grátis ou aceite um convite.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData((s) => ({ ...s, full_name: e.target.value }))}
                  placeholder="Seu nome"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
                  placeholder="seu@email.com"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((s) => ({ ...s, password: e.target.value }))}
                    placeholder="••••••••"
                    className="h-12 pl-10"
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handleNext}
                disabled={isProcessing}
                className="w-full h-12 font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                Criar minha conta
              </Button>

              <div className="text-center text-sm text-slate-600">
                Já tem conta?{' '}
                <button type="button" className="text-slate-900 underline underline-offset-4" onClick={goToLogin}>
                  Ir para tela de login
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <StepShell
          title={`Olá${formData.full_name ? `, ${formData.full_name}` : ''}!`}
          subtitle="Antes de começar, vamos confirmar alguns dados rapidinho."
        >
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="grid gap-4">
              <div className="rounded-2xl border p-4">
                <div className="text-xs text-slate-500">Nome</div>
                <div className="text-lg font-semibold text-slate-900">{formData.full_name || '—'}</div>
              </div>
              <div className="rounded-2xl border p-4">
                <div className="text-xs text-slate-500">E-mail</div>
                <div className="text-lg font-semibold text-slate-900">{formData.email || '—'}</div>
              </div>
            </div>
          </div>
        </StepShell>
      );
    }

    if (step === 3) {
      return (
        <StepShell title="Seus dados" subtitle="Confirme nome e e-mail para continuar.">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData((s) => ({ ...s, full_name: e.target.value }))}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((s) => ({ ...s, email: e.target.value }))}
                className="h-12"
              />
            </div>
          </div>
        </StepShell>
      );
    }

    if (step === 4) {
      return (
        <StepShell title="Defina sua senha" subtitle="Use no mínimo 6 caracteres.">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((s) => ({ ...s, password: e.target.value }))}
                  className="h-12 pl-10"
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Repetir senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData((s) => ({ ...s, confirm_password: e.target.value }))}
                  className="h-12 pl-10"
                  minLength={6}
                />
              </div>
            </div>
          </div>
        </StepShell>
      );
    }

    if (step === 5) {
      return (
        <StepShell title="Sobre sua empresa" subtitle="Esses dados ajudam a configurar seu teste grátis.">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData((s) => ({ ...s, company_name: e.target.value }))}
                placeholder="Ex: Minha Empresa Ltda"
                className="h-12"
              />
            </div>
            <PhoneInput value={formData.phone} onChange={(val) => setFormData((s) => ({ ...s, phone: val }))} disabled={isProcessing} />
          </div>
        </StepShell>
      );
    }

    if (step === 6) {
      return (
        <StepShell title="Seu perfil" subtitle="Conte rapidinho sobre você e sua equipe.">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <Label>Qual o seu cargo?</Label>
              <Select value={formData.job_title} onValueChange={(value) => setFormData((s) => ({ ...s, job_title: value }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Qual o tamanho da sua equipe?</Label>
              <div className="flex flex-wrap gap-2">
                {teamSizeOptions.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    selected={formData.team_size === value}
                    onSelect={(v) => setFormData((s) => ({ ...s, team_size: v }))}
                  />
                ))}
              </div>
            </div>
          </div>
        </StepShell>
      );
    }

    if (step === 7) {
      return (
        <StepShell title="Seu público e objetivo" subtitle="Isso ajuda a personalizar sua experiência.">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-3">
              <Label>Para quem você atende/vende?</Label>
              <div className="flex flex-wrap gap-2">
                {sellsToOptions.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    selected={formData.sells_to === value}
                    onSelect={(v) => setFormData((s) => ({ ...s, sells_to: v }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Qual seu objetivo principal?</Label>
              <div className="flex flex-wrap gap-2">
                {goalOptions.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    selected={formData.signup_goal === value}
                    onSelect={(v) => setFormData((s) => ({ ...s, signup_goal: v }))}
                  />
                ))}
              </div>
            </div>
          </div>
        </StepShell>
      );
    }

    if (step === 8) {
      return (
        <StepShell title="Última pergunta" subtitle="Onde você conheceu o AvaliaZap?">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-3">
              <Label>Selecione uma opção</Label>
              <div className="flex flex-wrap gap-2">
                {acquisitionOptions.map((value) => (
                  <Chip
                    key={value}
                    value={value}
                    selected={formData.acquisition_source === value}
                    onSelect={(v) => setFormData((s) => ({ ...s, acquisition_source: v }))}
                  />
                ))}
              </div>
            </div>

            {activationState.mode === 'error' ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {activationState.message || 'Erro ao finalizar cadastro'}
              </div>
            ) : null}
          </div>
        </StepShell>
      );
    }

    if (step === 9) {
      const isReady = activationState.mode === 'ready';
      const needsEmail = activationState.mode === 'email_required';

      return (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
            <Mail className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              {isReady ? 'Tudo pronto!' : 'Ative sua conta'}
            </h1>
            <p className="text-slate-600">
              {isReady
                ? 'Seu teste grátis foi iniciado. Você já pode entrar no sistema.'
                : 'Enviamos um e-mail para confirmar seu cadastro. Verifique sua caixa de entrada e spam.'}
            </p>
            <div className="text-sm text-slate-800 font-medium">{formData.email}</div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={() => {
                if (isReady) {
                  window.location.href = createPageUrl('Dashboard');
                  return;
                }
                goToLogin();
              }}
              disabled={isProcessing}
            >
              Vamos lá
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={exitWizard}>
              Voltar ao início
            </Button>
            {needsEmail ? (
              <div className="text-xs text-slate-500">
                Se a confirmação por e-mail estiver habilitada no Supabase, o acesso só libera após ativar o e-mail.
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ParticleEffectHero>
      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl my-auto"
        >
          {step === 1 ? renderStep() : renderStep()}
        </motion.div>
      </div>
    </ParticleEffectHero>
  );
}

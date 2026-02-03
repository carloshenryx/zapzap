import { signIn, supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import TrialExpiredUpgradeModal from '@/components/plan/TrialExpiredUpgradeModal';
import { Check } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [expiredModal, setExpiredModal] = useState({ open: false, tenantId: null, expiresAt: null, reason: null });
    const [showPassword, setShowPassword] = useState(false);

    const handleSignIn = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            await signIn(email, password);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (token) {
                const res = await fetch('/api/auth?action=context', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });
                const payload = await res.json().catch(() => null);
                const access = payload?.access;
                if (access?.blocked && (access?.reason === 'trial_expired' || access?.reason === 'subscription_expired')) {
                    const tenantId = payload?.tenant?.id || payload?.tenant_id || null;
                    const expiresAt = payload?.trial?.expires_at || payload?.subscription?.expires_at || access?.expires_at || null;
                    setExpiredModal({ open: true, tenantId, expiresAt, reason: access?.reason });
                    return;
                }
                if (access?.blocked) {
                    alert('Conta bloqueada. Entre em contato com o suporte para regularizar o acesso.');
                    return;
                }
            }

            navigate('/Dashboard');
        } catch (error) {
            console.error('❌ Login error:', error);
            alert(error.message || 'Erro ao fazer login');
        }
    };

    const handleGoogleSignIn = () => {
        // TODO: Implementar Google OAuth
        alert("Google OAuth será implementado em breve!");
    };

    const handleResetPassword = () => {
        navigate('/ForgotPassword');
    };

    const handleCreateAccount = () => {
        navigate('/FreeTrialSignup');
    };

    return (
        <>
            <div className="min-h-[100dvh] w-[100dvw] flex items-center justify-center bg-[#0b0b14]">
                <div className="w-full max-w-6xl px-6 py-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                        <div className="text-white">
                            <div className="text-sm font-medium text-white/70 mb-6">Entrar</div>
                            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
                                Acesse o AvaliaZap e
                                <br />
                                continue coletando
                                <br />
                                avaliações.
                            </h1>

                            <ul className="mt-10 space-y-5 text-white/80">
                                {[
                                    'Não possui avaliações no Google, perdendo credibilidade.',
                                    'Não centraliza avaliações e feedbacks em um só lugar, gerando retrabalho.',
                                    'Não acompanha a satisfação do cliente com clareza e frequência.',
                                    'Perde oportunidades por não saber quem precisa de atenção no pós-venda.',
                                    'Fica sem dados confiáveis para melhorar atendimento e reputação.',
                                ].map((text) => (
                                    <li key={text} className="flex items-start gap-3">
                                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                                            <Check className="h-4 w-4 text-violet-300" />
                                        </span>
                                        <span className="leading-relaxed">{text}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-10 inline-flex rounded-xl bg-white/5 ring-1 ring-white/10 px-5 py-4 text-sm text-white/80">
                                Se ainda não tem conta, inicie seu <span className="mx-1 font-semibold text-white">teste grátis</span> e comece hoje.
                            </div>
                        </div>

                        <div className="flex justify-center lg:justify-end">
                            <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-2xl">
                                <div className="text-center">
                                    <div className="text-4xl font-extrabold tracking-tight text-slate-800">
                                        Avalia<span className="text-slate-500">Zap</span>
                                    </div>
                                </div>

                                <form className="mt-10 space-y-6" onSubmit={handleSignIn}>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-600">E-mail</label>
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-600">Senha</label>
                                        <div className="relative">
                                            <input
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700"
                                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full rounded-lg bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 transition-colors"
                                    >
                                        Entrar
                                    </button>

                                    <div className="text-center space-y-3 text-sm">
                                        <button
                                            type="button"
                                            onClick={handleResetPassword}
                                            className="text-slate-500 hover:text-slate-700"
                                        >
                                            Esqueci minha senha
                                        </button>
                                        <div className="text-slate-400">
                                            <button
                                                type="button"
                                                onClick={handleCreateAccount}
                                                className="text-slate-500 hover:text-slate-700"
                                            >
                                                Criar conta
                                            </button>
                                            <span className="mx-2">/</span>
                                            <button
                                                type="button"
                                                onClick={handleCreateAccount}
                                                className="text-slate-500 hover:text-slate-700"
                                            >
                                                Teste grátis
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <TrialExpiredUpgradeModal
                open={expiredModal.open}
                tenantId={expiredModal.tenantId}
                expiresAt={expiredModal.expiresAt}
                reason={expiredModal.reason}
                onOpenChange={(open) => setExpiredModal((s) => ({ ...s, open }))}
            />
        </>
    );
}

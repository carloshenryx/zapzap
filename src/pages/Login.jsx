import { SignInPage } from "@/components/ui/sign-in";
import { signIn, supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import TrialExpiredUpgradeModal from '@/components/plan/TrialExpiredUpgradeModal';

const testimonials = [
    {
        avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
        name: "Sarah Chen",
        handle: "@sarahdigital",
        text: "AvaliaZap transformou como coletamos feedback! Interface intuitiva e resultados incríveis."
    },
    {
        avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
        name: "Marcus Johnson",
        handle: "@marcustech",
        text: "Plataforma perfeita para pesquisas por WhatsApp. Design limpo e suporte excelente."
    },
    {
        avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
        name: "David Martinez",
        handle: "@davidcreates",
        text: "Testei várias ferramentas, mas AvaliaZap se destaca. Confiável e realmente útil para produtividade."
    },
];

export default function Login() {
    const navigate = useNavigate();
    const [expiredModal, setExpiredModal] = useState({ open: false, tenantId: null, expiresAt: null, reason: null });

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

            navigate('/dashboard');
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
        navigate('/forgot-password');
    };

    const handleCreateAccount = () => {
        navigate('/signup');
    };

    return (
        <>
            <SignInPage
                title={
                    <span>
                        Bem-vindo ao <span className="text-violet-500">AvaliaZap</span>
                    </span>
                }
                description="Entre com suas credenciais e comece a coletar feedbacks valiosos"
                heroImageSrc="https://i.postimg.cc/NMKqJB2m/maxresdefault-3ZJO9l0Hd1Y.jpg"
                testimonials={testimonials}
                onSignIn={handleSignIn}
                onResetPassword={handleResetPassword}
                onCreateAccount={handleCreateAccount}
            />
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

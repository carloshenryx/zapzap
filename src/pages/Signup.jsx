import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Building2, User, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, fetchAPI, fetchPublicAPI } from '@/lib/supabase';

export default function SignupPage() {
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        companyCode: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState({ open: false, title: '', description: '' });
    const [inviteToken, setInviteToken] = useState('');
    const [codeValidation, setCodeValidation] = useState({ status: 'idle', tenantName: '' });
    const [invitePreview, setInvitePreview] = useState({ status: 'idle', tenantName: '', inviteStatus: '' });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search || '');
        const invite = String(params.get('invite') || '').trim();
        if (invite) setInviteToken(invite);
    }, []);

    useEffect(() => {
        const run = async () => {
            if (!inviteToken) return;
            setInvitePreview({ status: 'loading', tenantName: '', inviteStatus: '' });
            try {
                const res = await fetchPublicAPI(`/tenant-invites?action=preview&token=${encodeURIComponent(inviteToken)}`, { method: 'GET' });
                const name = res?.tenant?.name || '';
                const inviteStatus = String(res?.invite?.status || '').trim();
                setInvitePreview({ status: 'loaded', tenantName: name, inviteStatus });
            } catch {
                setInvitePreview({ status: 'error', tenantName: '', inviteStatus: '' });
            }
        };
        void run();
    }, [inviteToken]);

    const normalizedCompanyCode = useMemo(() => {
        return String(formData.companyCode || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    }, [formData.companyCode]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const validateCode = async (value) => {
        const code = String(value || '').trim();
        if (!code) {
            setCodeValidation({ status: 'idle', tenantName: '' });
            return;
        }
        setCodeValidation({ status: 'loading', tenantName: '' });
        try {
            const normalized = code.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const res = await fetchPublicAPI(`/tenants?action=validate-code&code=${encodeURIComponent(normalized)}`, { method: 'GET' });
            if (res?.valid) {
                setCodeValidation({ status: 'valid', tenantName: res?.tenant?.name || '' });
            } else {
                setCodeValidation({ status: 'invalid', tenantName: '' });
            }
        } catch {
            setCodeValidation({ status: 'invalid', tenantName: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem');
            setIsLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            setIsLoading(false);
            return;
        }

        if (!inviteToken && normalizedCompanyCode && codeValidation.status === 'invalid') {
            setError('Código da empresa inválido');
            setIsLoading(false);
            return;
        }

        const result = await signUp(formData.email, formData.password, {
            full_name: formData.fullName,
        });

        if (result.success) {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (inviteToken) {
                    if (session?.access_token) {
                        await fetchAPI('/tenant-invites?action=accept', {
                            method: 'POST',
                            body: JSON.stringify({ token: inviteToken }),
                        });
                        await supabase.auth.refreshSession().catch(() => {});
                        window.location.href = '/dashboard';
                        return;
                    }

                    localStorage.setItem('pending_invite_token', inviteToken);
                    setSuccess({
                        open: true,
                        title: 'Conta criada com sucesso!',
                        description: 'Confirme seu e-mail e faça login para aceitar o convite automaticamente.',
                    });
                    setIsLoading(false);
                    return;
                }

                if (normalizedCompanyCode) {
                    if (session?.access_token) {
                        await fetchAPI('/tenants?action=request-join-by-code', {
                            method: 'POST',
                            body: JSON.stringify({ code: normalizedCompanyCode }),
                        });
                        setSuccess({
                            open: true,
                            title: 'Conta criada!',
                            description: 'Sua solicitação foi enviada. Um administrador precisa aprovar seu acesso.',
                        });
                        setIsLoading(false);
                        return;
                    }

                    localStorage.setItem('pending_company_code', normalizedCompanyCode);
                    setSuccess({
                        open: true,
                        title: 'Conta criada!',
                        description: 'Confirme seu e-mail e faça login. Em seguida, enviaremos sua solicitação de acesso.',
                    });
                    setIsLoading(false);
                    return;
                }

                setSuccess({
                    open: true,
                    title: 'Conta criada com sucesso!',
                    description: 'Confirme seu e-mail e faça login para continuar.',
                });
                setIsLoading(false);
            } catch (onboardError) {
                setError(onboardError?.message || 'Erro ao finalizar cadastro. Tente novamente.');
            }
        } else {
            setError(result.error || 'Erro ao criar conta. Tente novamente.');
        }

        setIsLoading(false);
    };

    if (success.open) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6 text-center">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{success.title}</h2>
                        <p className="text-gray-600 mb-4">{success.description}</p>
                        <Button onClick={() => navigate('/login')} className="w-full">
                            Ir para login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                            <span className="text-white text-2xl font-bold">AZ</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">Criar sua conta</CardTitle>
                    <CardDescription className="text-center">
                        Cadastre-se para acessar a plataforma
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Nome Completo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    placeholder="João Silva"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="companyCode">Código da Empresa (opcional)</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="companyCode"
                                    name="companyCode"
                                    type="text"
                                    placeholder="ex: avaliazap"
                                    value={formData.companyCode}
                                    onChange={handleChange}
                                    className="pl-10"
                                    disabled={isLoading || !!inviteToken}
                                    onBlur={() => validateCode(formData.companyCode)}
                                />
                            </div>
                            {!inviteToken && codeValidation.status === 'valid' ? (
                                <div className="text-xs text-green-700">Empresa encontrada: {codeValidation.tenantName || 'OK'}</div>
                            ) : null}
                            {!inviteToken && codeValidation.status === 'invalid' && normalizedCompanyCode ? (
                                <div className="text-xs text-red-600">Código inválido</div>
                            ) : null}
                            {!inviteToken && codeValidation.status === 'loading' ? (
                                <div className="text-xs text-slate-500">Validando...</div>
                            ) : null}
                            {inviteToken ? (
                                <div className="text-xs text-slate-600">
                                    {invitePreview.status === 'loading'
                                        ? 'Carregando convite...'
                                        : invitePreview.tenantName
                                            ? `Você foi convidado para ${invitePreview.tenantName}`
                                            : 'Cadastro via convite'}
                                </div>
                            ) : null}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                    disabled={isLoading}
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className="pl-10"
                                    disabled={isLoading}
                                    minLength={6}
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando conta...
                                </>
                            ) : (
                                'Criar Conta Gratuita'
                            )}
                        </Button>

                        <div className="text-center text-sm text-gray-600">
                            Já tem uma conta?{' '}
                            <Link
                                to="/login"
                                className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                            >
                                Fazer login
                            </Link>
                        </div>

                        <p className="text-xs text-center text-gray-500">
                            Ao criar uma conta, você concorda com nossos{' '}
                            <Link to="/terms" className="underline">Termos de Serviço</Link>
                            {' '}e{' '}
                            <Link to="/privacy" className="underline">Política de Privacidade</Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, isLoadingAuth } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        company_name: '',
        contact_phone: '',
        plan_type: 'pro'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Obter token de autenticação
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setError('Sessão expirada. Por favor, faça login novamente.');
                navigate('/login');
                return;
            }

            // Chamar endpoint de onboarding
            const response = await fetch('/api/tenants?action=onboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar empresa');
            }

            console.log('✅ Onboarding successful, reloading profile...');

            // Force profile reload to get new tenant_id
            // Wait a bit for database to sync, then reload auth state
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Full page reload to ensure AuthContext picks up new tenant_id
            window.location.href = '/dashboard';

        } catch (err) {
            console.error('Onboarding error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Bem-vindo ao AvaliaZap! 🎉
                    </h1>
                    <p className="text-gray-600">
                        Para começar, precisamos de algumas informações sobre sua empresa
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Nome da Empresa */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nome da Empresa *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            placeholder="Minha Empresa Ltda"
                            disabled={loading}
                        />
                    </div>

                    {/* Telefone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Telefone de Contato
                        </label>
                        <input
                            type="tel"
                            value={formData.contact_phone}
                            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            placeholder="(11) 98765-4321"
                            disabled={loading}
                        />
                    </div>

                    {/* Plano */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Plano Inicial
                        </label>
                        <select
                            value={formData.plan_type}
                            onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                            disabled={loading}
                        >
                            <option value="basic">Básico (Gratuito)</option>
                            <option value="plus">Plus (R$ 197/mês)</option>
                            <option value="pro">Pro (R$ 397/mês) - Recomendado</option>
                        </select>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Criando...' : 'Começar Agora'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                    Ao continuar, você concorda com nossos Termos de Serviço
                </p>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Star,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  TrendingUp,
  Target,
  Loader2
} from 'lucide-react';
import { createPageUrl } from '../utils';

export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState(null);

  const { data: plansFromDB = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['available-plans'],
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

  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = plansFromDB
    .filter(plan => plan.billing_cycle === billingCycle)
    .map(plan => ({
      id: plan.id,
      name: plan.name,
      price: billingCycle === 'annual' ? `R$ ${(plan.price * 12).toFixed(2)}` : `R$ ${plan.price}`,
      period: billingCycle === 'annual' ? '/ano' : '/mês',
      monthlyEquivalent: billingCycle === 'annual' ? `R$ ${plan.price}/mês` : null,
      features: (plan.features || []).slice(0, 7).map(f => f.name),
      cta: `Escolher ${plan.name}`,
      highlight: plan.name === 'Plus',
      badge: plan.name === 'Plus' ? 'Mais Popular' : null,
      color: plan.name === 'Basic' ? 'from-blue-500 to-cyan-500' :
        plan.name === 'Plus' ? 'from-purple-600 to-indigo-600' :
          'from-indigo-700 to-slate-800',
      billing_cycle: plan.billing_cycle
    }));

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    window.location.href = createPageUrl('Checkout') + `?plan=${plan.name}&billing_cycle=${plan.billing_cycle}`;
  };

  const steps = [
    {
      number: '1',
      title: 'Mapeamento',
      description: 'Entenda seu processo e configure as pesquisas de acordo com sua necessidade',
      icon: Target
    },
    {
      number: '2',
      title: 'Configuração',
      description: 'Personalize totalmente seus modelos de pesquisa e canais de envio',
      icon: Shield
    },
    {
      number: '3',
      title: 'Envio Automatizado',
      description: 'Dispare pesquisas automaticamente via WhatsApp, Email ou SMS',
      icon: Zap
    },
    {
      number: '4',
      title: 'Análise e Evolução',
      description: 'Receba insights em tempo real e tome decisões baseadas em dados',
      icon: TrendingUp
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Inspirado no Nectar */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 pt-32 pb-24 px-6">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-5xl mx-auto"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 text-slate-900 leading-tight">
              O ecossistema que acelera o crescimento da sua empresa através de{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                feedback inteligente
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Colete avaliações de clientes via WhatsApp automaticamente e tome{' '}
              <strong>decisões baseadas em dados reais</strong>
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                onClick={() => window.location.href = createPageUrl('FreeTrialSignup')}
                size="lg"
                className="bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-600 hover:from-orange-600 hover:via-yellow-600 hover:to-orange-700 text-white font-semibold text-lg px-12 py-7 h-auto rounded-xl shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 transform hover:scale-105 border-2 border-orange-300/40"
              >
                Teste Grátis por 7 Dias
              </Button>
              <Button
                onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })}
                size="lg"
                variant="outline"
                className="border-2 border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-lg px-12 py-7 h-auto rounded-xl"
              >
                Ver Planos
              </Button>
            </motion.div>

            {/* Hero Image Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-16 relative"
            >
              <div className="aspect-video bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <BarChart3 className="w-24 h-24 text-indigo-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-500 font-medium">Dashboard AvaliaZap</p>
                  </div>
                </div>
                {/* Floating Cards */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="absolute bottom-8 left-8 bg-white rounded-2xl shadow-xl p-4 max-w-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Avaliação Recebida</p>
                      <p className="text-xs text-slate-500">Cliente: João Silva</p>
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="absolute top-8 right-8 bg-white rounded-2xl shadow-xl p-4"
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="text-2xl font-bold text-slate-800">4.8</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Média geral</p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Automation Section */}
      <section className="py-24 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-white/[0.2] bg-[size:50px_50px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-3 mb-6 px-6 py-3 bg-gradient-to-r from-purple-500/30 to-pink-500/30 backdrop-blur-sm rounded-full border border-purple-400/30">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-lg font-semibold">Automações</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Sua nova{' '}
              <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                força-tarefa
              </span>
              <br />
              rodando dia e noite
            </h2>
            <Button
              variant="outline"
              className="mt-6 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm rounded-full px-8"
            >
              Saiba mais
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>

          {/* Automation Visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-video bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl backdrop-blur-xl border border-white/10 p-12 flex items-center justify-center">
              <div className="text-center">
                <Zap className="w-32 h-32 text-yellow-300 mx-auto mb-4" />
                <p className="text-2xl font-semibold text-white/90">Automação Inteligente</p>
                <p className="text-white/60 mt-2">Envio automático de pesquisas após cada atendimento</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Client Logos */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 items-center grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            {['Unimed', 'Cacau Show', 'Montreal', 'FGV', 'Aliare'].map((company, idx) => (
              <div key={idx} className="text-center">
                <div className="bg-slate-100 rounded-2xl p-8 flex items-center justify-center h-24">
                  <span className="text-slate-600 font-bold text-lg">{company}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Continue com as outras seções... */}
      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">
              Escolha Seu Plano
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Comece hoje e veja resultados em menos de 24 horas
            </p>

            {/* Billing Cycle Selector */}
            <div className="flex items-center justify-center gap-3 bg-slate-100 rounded-full p-1.5 w-fit mx-auto">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${billingCycle === 'monthly'
                    ? 'bg-white text-indigo-600 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-8 py-3 rounded-full font-semibold transition-all ${billingCycle === 'annual'
                    ? 'bg-white text-indigo-600 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Anual
                <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  Economize
                </span>
              </button>
            </div>
          </motion.div>

          {loadingPlans ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Carregando planos...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 ${plan.highlight
                      ? 'border-2 border-indigo-600 scale-105 md:scale-110 z-10'
                      : 'border border-slate-200'
                    }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-xl">
                      ⭐ {plan.badge}
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-slate-800 mb-6">{plan.name}</h3>
                    <div className="mb-6">
                      <span className="text-5xl md:text-6xl font-bold text-slate-900">{plan.price}</span>
                      <span className="text-slate-500 text-lg">{plan.period}</span>
                      {plan.monthlyEquivalent && (
                        <p className="text-sm text-slate-500 mt-2">
                          ({plan.monthlyEquivalent} × 12 meses)
                        </p>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full h-14 text-base font-semibold rounded-xl shadow-lg transition-all duration-300 ${plan.highlight
                        ? `bg-gradient-to-r ${plan.color} hover:shadow-2xl hover:scale-105`
                        : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                  >
                    {plan.cta}
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div>
              <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                AvaliaZap
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Proporcionando relacionamentos de valor
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-sm text-slate-500">
                ©2026 AvaliaZap | Termos & Privacidade
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS Animation for blobs */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

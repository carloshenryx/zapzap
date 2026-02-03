import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LogIn, ArrowRight } from 'lucide-react';
import ParticleEffectHero from '@/components/ui/particle-effect-for-hero';

export default function PreLogin() {
  const handleLogin = () => {
    window.location.href = '/Login';
  };

  return (
    <ParticleEffectHero>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full text-center space-y-8"
        >
          <div className="inline-block">
            <span className="py-1 px-3 border border-white/20 rounded-full text-xs font-mono text-white/60 tracking-widest uppercase bg-white/5 backdrop-blur-sm">
              Plataforma AvaliaZap
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 tracking-tighter">
            Bem-vindo
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 font-light leading-relaxed">
            Acesse sua conta e comece a coletar feedbacks valiosos dos seus clientes através de pesquisas inteligentes.
          </p>

          <div className="pt-8 pointer-events-auto">
            <Button
              onClick={handleLogin}
              className="group relative inline-flex items-center gap-3 px-8 py-6 bg-white text-black rounded-full font-bold tracking-wide overflow-hidden transition-transform hover:scale-105 active:scale-95 h-auto text-lg"
            >
              <LogIn className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Entrar na Plataforma</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out opacity-10"></div>
            </Button>
          </div>

          <p className="text-xs text-white/40 mt-6">
            Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade
          </p>
        </motion.div>
      </div>
    </ParticleEffectHero>
  );
}

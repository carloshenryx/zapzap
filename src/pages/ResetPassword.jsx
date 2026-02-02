import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';

function getAuthParamsFromUrl(href) {
  const url = new URL(String(href));
  const search = url.searchParams;
  const hash = String(url.hash || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);

  const access_token = hashParams.get('access_token') || search.get('access_token') || '';
  const refresh_token = hashParams.get('refresh_token') || search.get('refresh_token') || '';
  const type = hashParams.get('type') || search.get('type') || '';
  const code = search.get('code') || '';

  return { access_token, refresh_token, type, code };
}

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const params = useMemo(() => getAuthParamsFromUrl(window.location.href), []);

  useEffect(() => {
    const run = async () => {
      setError(null);
      try {
        if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (sessionError) throw sessionError;
        } else if (params.code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(params.code);
          if (codeError) throw codeError;
        }
      } catch (e) {
        setError(e?.message || 'Não foi possível validar o link de recuperação.');
      } finally {
        try {
          window.history.replaceState({}, '', '/reset-password');
        } catch {
          // ignore
        }
        setIsReady(true);
      }
    };

    run();
  }, [params.access_token, params.code, params.refresh_token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!password || password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch (e2) {
      setError(e2?.message || 'Erro ao redefinir a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Senha atualizada!</h2>
            <p className="text-gray-600">Redirecionando para o login...</p>
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
              <Lock className="text-white w-7 h-7" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Redefinir senha</CardTitle>
          <CardDescription className="text-center">
            Crie uma nova senha para acessar sua conta.
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
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}


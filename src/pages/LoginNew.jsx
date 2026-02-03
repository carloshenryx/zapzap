import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginNew() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            console.log('🔐 Starting login...', { email });

            // Get env vars directly
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            console.log('📝 Config:', {
                url: supabaseUrl ? 'OK' : 'MISSING',
                key: supabaseKey ? 'OK' : 'MISSING'
            });

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Missing Supabase configuration');
            }

            // Direct fetch to Supabase Auth API
            const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                },
                body: JSON.stringify({ email, password })
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Login failed:', errorData);
                throw new Error(errorData.error_description || errorData.msg || 'Login falhou');
            }

            const data = await response.json();
            console.log('✅ Login successful!', { hasToken: !!data.access_token });

            // Save tokens to localStorage
            localStorage.setItem('supabase.auth.token', JSON.stringify({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user: data.user,
                expires_at: data.expires_at
            }));

            console.log('💾 Token saved to localStorage');

            // Redirect to dashboard
            window.location.href = '/Dashboard';

        } catch (err) {
            console.error('❌ Exception:', err);
            setError(err.message || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
                    AvaliaZap Login (NEW)
                </h1>
                <p style={{ color: '#666', textAlign: 'center', marginBottom: '24px', fontSize: '14px' }}>
                    Teste da nova implementação
                </p>

                {error && (
                    <div style={{
                        padding: '12px',
                        background: '#fee',
                        border: '1px solid #fcc',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        color: '#c00'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: loading ? '#ccc' : '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? '⏳ Entrando...' : '🚀 Entrar'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#999' }}>
                    <p>Credenciais de teste:</p>
                    <p>ext.remi@hotmail.com / 85851010aA@</p>
                </div>
            </div>
        </div>
    );
}

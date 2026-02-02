import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/supabase';
import { AlertCircle, X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

/**
 * PlanLimitsBanner
 * Displays warning when plan limits are approaching or exceeded
 * Shows at 80% (warning) or 100% (danger)
 */
export default function PlanLimitsBanner() {
    const [dismissed, setDismissed] = useState(false);
    const [limits, setLimits] = useState(null);

    // Fetch plan limits
    const { data: limitsData, isLoading } = useQuery({
        queryKey: ['plan-limits'],
        queryFn: async () => {
            const response = await fetchAPI('/plans?action=validate-limits', {
                method: 'POST',
                body: JSON.stringify({ resource_type: 'messages' })
            });
            return response;
        },
        refetchInterval: 60000, // Refetch every minute
        staleTime: 30000
    });

    useEffect(() => {
        if (limitsData) {
            setLimits(limitsData);
        }
    }, [limitsData]);

    // Check if dismissed in session
    useEffect(() => {
        const dismissedKey = `limits-banner-dismissed-${limits?.percentage || 0}`;
        const wasDismissed = sessionStorage.getItem(dismissedKey);
        if (wasDismissed) {
            setDismissed(true);
        }
    }, [limits]);

    const handleDismiss = () => {
        const dismissedKey = `limits-banner-dismissed-${limits?.percentage || 0}`;
        sessionStorage.setItem(dismissedKey, 'true');
        setDismissed(true);
    };

    if (isLoading || !limits || dismissed) {
        return null;
    }

    const { percentage, current_usage, limit, allowed } = limits;

    // Only show if >= 80%
    if (percentage < 80) {
        return null;
    }

    const variant = percentage >= 100 ? 'destructive' : percentage >= 90 ? 'warning' : 'default';
    const bgColor = percentage >= 100 ? 'bg-red-50 border-red-200' :
        percentage >= 90 ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200';

    const textColor = percentage >= 100 ? 'text-red-900' :
        percentage >= 90 ? 'text-yellow-900' :
            'text-blue-900';

    const iconColor = percentage >= 100 ? 'text-red-600' :
        percentage >= 90 ? 'text-yellow-600' :
            'text-blue-600';

    return (
        <Alert className={`${bgColor} mb-4 relative`}>
            <AlertCircle className={`h-5 w-5 ${iconColor}`} />

            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </button>

            <AlertDescription className={textColor}>
                <div className="pr-8">
                    <div className="font-semibold mb-2">
                        {percentage >= 100 ? (
                            <>🚨 Limite de Mensagens Atingido</>
                        ) : percentage >= 90 ? (
                            <>⚠️ Quase no Limite de Mensagens</>
                        ) : (
                            <>📊 Uso Elevado de Mensagens</>
                        )}
                    </div>

                    <p className="text-sm mb-3">
                        Você utilizou <strong>{current_usage} de {limit}</strong> mensagens mensais
                        (<strong>{percentage}%</strong>).
                        {percentage >= 100 ? (
                            <> Não é possível enviar mais mensagens até o próximo ciclo.</>
                        ) : (
                            <> Restam apenas {limit - current_usage} mensagens.</>
                        )}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-3">
                        <Progress
                            value={Math.min(percentage, 100)}
                            className="h-2"
                            indicatorClassName={
                                percentage >= 100 ? 'bg-red-600' :
                                    percentage >= 90 ? 'bg-yellow-600' :
                                        'bg-blue-600'
                            }
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => window.location.href = '/UpgradePlan'}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Crown className="mr-2 h-4 w-4" />
                            Fazer Upgrade
                        </Button>

                        <a
                            href="/Admin"
                            className="text-sm underline hover:no-underline"
                        >
                            Ver Consumo Detalhado
                        </a>
                    </div>
                </div>
            </AlertDescription>
        </Alert>
    );
}

/**
 * Simplified version for inline use
 */
export function PlanLimitsIndicator({ resourceType = 'messages', compact = false }) {
    const { data: limits } = useQuery({
        queryKey: ['plan-limits', resourceType],
        queryFn: async () => {
            const response = await fetchAPI('/api/plans?action=validate-limits', {
                method: 'POST',
                body: JSON.stringify({ resource_type: resourceType })
            });
            return response;
        },
        staleTime: 30000
    });

    if (!limits) return null;

    const { percentage, current_usage, limit } = limits;

    if (compact) {
        return (
            <div className="text-sm text-gray-600">
                {current_usage} / {limit === Infinity ? '∞' : limit}
                {limit !== Infinity && ` (${percentage}%)`}
            </div>
        );
    }

    const barColor = percentage >= 100 ? 'bg-red-500' :
        percentage >= 90 ? 'bg-yellow-500' :
            percentage >= 80 ? 'bg-orange-500' :
                'bg-green-500';

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600">Uso Atual</span>
                <span className="font-medium">
                    {current_usage} / {limit === Infinity ? '∞' : limit}
                </span>
            </div>

            {limit !== Infinity && (
                <>
                    <Progress value={Math.min(percentage, 100)} className="h-2">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </Progress>

                    <div className="text-xs text-gray-500 text-right">
                        {percentage}% utilizado
                    </div>
                </>
            )}
        </div>
    );
}

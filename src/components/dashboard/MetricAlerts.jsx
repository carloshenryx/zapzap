import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, TrendingDown, TrendingUp, X, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const DEFAULT_ALERTS = [
  { id: 'nps_low', metric: 'NPS', condition: 'below', threshold: 30, enabled: true },
  { id: 'detractors_high', metric: 'Detratores', condition: 'above', threshold: 30, enabled: true },
  { id: 'avg_rating_low', metric: 'Avaliação Média', condition: 'below', threshold: 3.5, enabled: true }
];

export default function MetricAlerts({ nps, avgRating, detractorsPercent, promotersPercent }) {
  const [alerts, setAlerts] = useState(() => {
    const saved = localStorage.getItem('metric_alerts');
    return saved ? JSON.parse(saved) : DEFAULT_ALERTS;
  });
  const [showConfig, setShowConfig] = useState(false);
  const [newAlert, setNewAlert] = useState({
    metric: 'NPS',
    condition: 'below',
    threshold: 50
  });

  // Salvar no localStorage quando alterar
  const saveAlerts = (updatedAlerts) => {
    setAlerts(updatedAlerts);
    localStorage.setItem('metric_alerts', JSON.stringify(updatedAlerts));
  };

  // Verificar alertas ativos
  const activeAlerts = useMemo(() => {
    const triggered = [];
    
    alerts.forEach(alert => {
      if (!alert.enabled) return;

      let currentValue;
      let shouldTrigger = false;

      switch (alert.metric) {
        case 'NPS':
          currentValue = nps;
          break;
        case 'Avaliação Média':
          currentValue = avgRating;
          break;
        case 'Detratores':
          currentValue = detractorsPercent;
          break;
        case 'Promotores':
          currentValue = promotersPercent;
          break;
        default:
          return;
      }

      if (alert.condition === 'below') {
        shouldTrigger = currentValue < alert.threshold;
      } else if (alert.condition === 'above') {
        shouldTrigger = currentValue > alert.threshold;
      }

      if (shouldTrigger) {
        triggered.push({
          ...alert,
          currentValue,
          severity: Math.abs(currentValue - alert.threshold) > 10 ? 'high' : 'medium'
        });
      }
    });

    return triggered;
  }, [alerts, nps, avgRating, detractorsPercent, promotersPercent]);

  const handleAddAlert = () => {
    const alert = {
      id: `alert_${Date.now()}`,
      ...newAlert,
      enabled: true,
      threshold: parseFloat(newAlert.threshold)
    };
    saveAlerts([...alerts, alert]);
    setNewAlert({ metric: 'NPS', condition: 'below', threshold: 50 });
  };

  const handleToggleAlert = (id) => {
    const updated = alerts.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    saveAlerts(updated);
  };

  const handleDeleteAlert = (id) => {
    saveAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Alertas de Métricas</h3>
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {activeAlerts.length}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(true)}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </Button>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">Tudo está bem!</p>
            <p className="text-xs text-gray-500 mt-1">Nenhum alerta ativo no momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {activeAlerts.map((alert, idx) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.severity === 'high'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      alert.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {alert.metric} {alert.condition === 'below' ? 'abaixo' : 'acima'} do limite
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Valor atual: <strong>{alert.currentValue}</strong> | 
                        Limite: <strong>{alert.threshold}</strong>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {alert.condition === 'below' ? (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="text-xs font-medium text-gray-700">
                          Ação recomendada: Analisar e melhorar esta métrica
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Alertas</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add New Alert */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Adicionar Novo Alerta</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Métrica</Label>
                  <Select value={newAlert.metric} onValueChange={(v) => setNewAlert({...newAlert, metric: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NPS">NPS</SelectItem>
                      <SelectItem value="Avaliação Média">Avaliação Média</SelectItem>
                      <SelectItem value="Detratores">% Detratores</SelectItem>
                      <SelectItem value="Promotores">% Promotores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Condição</Label>
                  <Select value={newAlert.condition} onValueChange={(v) => setNewAlert({...newAlert, condition: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="below">Abaixo de</SelectItem>
                      <SelectItem value="above">Acima de</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Limite</Label>
                  <Input
                    type="number"
                    value={newAlert.threshold}
                    onChange={(e) => setNewAlert({...newAlert, threshold: e.target.value})}
                  />
                </div>
              </div>
              <Button onClick={handleAddAlert} className="w-full mt-3" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Alerta
              </Button>
            </div>

            {/* Existing Alerts */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Alertas Configurados</h4>
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={alert.enabled}
                        onChange={() => handleToggleAlert(alert.id)}
                        className="rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {alert.metric} {alert.condition === 'below' ? '<' : '>'} {alert.threshold}
                        </p>
                        <p className="text-xs text-gray-500">
                          {alert.enabled ? 'Ativo' : 'Desativado'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
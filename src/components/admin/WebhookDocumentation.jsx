import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function WebhookDocumentation({ webhookUrl, externalTriggerId, webhookKey }) {
  const [showDocs, setShowDocs] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const examplePayload = `{
  "tenant_id": "seu_tenant_id",
  "customer_phone": "5511999999999",
  "external_trigger_id": "${externalTriggerId}"
}`;

  const curlExample = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Key: ${webhookKey || 'SUA_CHAVE'}" \\
  -d '${examplePayload.replace(/\n/g, ' ')}'`;

  return (
    <Dialog open={showDocs} onOpenChange={setShowDocs}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ExternalLink className="w-3 h-3" />
          Ver Documentação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Documentação do Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Endpoint</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-xs overflow-auto">
                {webhookUrl}
              </code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Método</h4>
            <code className="block bg-slate-100 px-3 py-2 rounded text-xs">POST</code>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Headers</h4>
            <pre className="block bg-slate-100 px-3 py-2 rounded text-xs overflow-auto">{`Content-Type: application/json
X-Webhook-Key: ${webhookKey || 'SUA_CHAVE'}`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Corpo (JSON)</h4>
            <div className="relative">
              <pre className="bg-slate-900 text-white px-3 py-2 rounded text-xs overflow-auto">{examplePayload}</pre>
              <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => copyToClipboard(examplePayload)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Exemplo cURL</h4>
            <div className="relative">
              <pre className="bg-slate-900 text-white px-3 py-2 rounded text-xs overflow-auto">{curlExample}</pre>
              <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => copyToClipboard(curlExample)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-900">
              <strong>Importante:</strong> Substitua <code className="bg-blue-100 px-1 rounded">seu_tenant_id</code> pelo ID do seu tenant.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

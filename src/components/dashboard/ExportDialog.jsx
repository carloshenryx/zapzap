import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function ExportDialog({ open, onOpenChange, responses, templates }) {
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tenant } = useQuery({
    queryKey: ['current-tenant', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      const tenants = await base44.entities.Tenant.filter({ id: user.tenant_id });
      return tenants[0] || null;
    },
    enabled: !!user?.tenant_id,
  });
  const [exportFormat, setExportFormat] = useState('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    customerName: true,
    customerEmail: true,
    customerPhone: true,
    customerCpf: false,
    overallRating: true,
    serviceRating: false,
    qualityRating: false,
    wouldRecommend: true,
    comment: true,
    sentiment: true,
    source: true,
    createdDate: true,
    customAnswers: false
  });

  const toggleField = (field) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const exportToExcel = () => {
    // Cabeçalho com dados da empresa
    const headerData = [
      ['RELATÓRIO DE PESQUISAS DE SATISFAÇÃO'],
      [''],
      ['Empresa:', tenant?.company_name || tenant?.name || '-'],
      ['CNPJ:', tenant?.cnpj || '-'],
      ['Telefone:', tenant?.contact_phone || '-'],
      [''],
      ['Exportado por:', user?.full_name || user?.email || '-'],
      ['Data/Hora:', new Date().toLocaleString('pt-BR')],
      ['Sistema:', 'AvaliaZap - Sistema de Pesquisas de Satisfação'],
      ['']
    ];

    const data = responses.map(r => {
      const row = {};
      if (selectedFields.customerName) row['Nome do Cliente'] = r.customer_name || 'Anônimo';
      if (selectedFields.customerEmail) row['Email'] = r.customer_email || '-';
      if (selectedFields.customerPhone) row['Telefone'] = r.customer_phone || '-';
      if (selectedFields.customerCpf) row['CPF'] = r.customer_cpf || '-';
      if (selectedFields.overallRating) row['Avaliação Geral'] = r.overall_rating || '-';
      if (selectedFields.serviceRating) row['Avaliação Atendimento'] = r.service_rating || '-';
      if (selectedFields.qualityRating) row['Avaliação Qualidade'] = r.quality_rating || '-';
      if (selectedFields.wouldRecommend) row['Recomendaria'] = r.would_recommend ? 'Sim' : 'Não';
      if (selectedFields.comment) row['Comentário'] = r.comment || '-';
      if (selectedFields.sentiment) row['Sentimento'] = r.sentiment || '-';
      if (selectedFields.source) row['Origem'] = r.source || '-';
      if (selectedFields.createdDate) row['Data'] = new Date(r.created_at || r.created_date).toLocaleDateString('pt-BR');
      
      if (selectedFields.customAnswers && r.custom_answers) {
        Object.keys(r.custom_answers).forEach(key => {
          row[`Resposta: ${key}`] = r.custom_answers[key];
        });
      }
      
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.sheet_add_json(ws, data, { origin: -1, skipHeader: false });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respostas');

    // Estatísticas
    const stats = {
      'Total de Respostas': responses.length,
      'Avaliação Média': responses.filter(r => r.overall_rating).length > 0
        ? (responses.filter(r => r.overall_rating).reduce((sum, r) => sum + r.overall_rating, 0) / responses.filter(r => r.overall_rating).length).toFixed(1)
        : '-',
      'Taxa de Recomendação': `${Math.round((responses.filter(r => r.would_recommend).length / responses.length) * 100)}%`,
      'Data da Exportação': new Date().toLocaleString('pt-BR')
    };

    const statsHeaderData = [
      ['ESTATÍSTICAS GERAIS'],
      [''],
      ['Empresa:', tenant?.company_name || tenant?.name || '-'],
      [''],
    ];
    
    const statsData = Object.keys(stats).map(key => ({ Métrica: key, Valor: stats[key] }));
    const wsStats = XLSX.utils.aoa_to_sheet(statsHeaderData);
    XLSX.utils.sheet_add_json(wsStats, statsData, { origin: -1, skipHeader: false });
    XLSX.utils.book_append_sheet(wb, wsStats, 'Estatísticas');

    XLSX.writeFile(wb, `respostas_pesquisas_${new Date().getTime()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let pageNumber = 1;

    const addHeader = () => {
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('RELATÓRIO DE PESQUISAS DE SATISFAÇÃO', 105, 15, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Empresa: ${tenant?.company_name || tenant?.name || '-'}`, 20, 25);
      doc.text(`CNPJ: ${tenant?.cnpj || '-'}`, 20, 30);
      doc.text(`Telefone: ${tenant?.contact_phone || '-'}`, 20, 35);
      
      doc.line(20, 38, 190, 38);
    };

    const addFooter = () => {
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Exportado por: ${user?.full_name || user?.email || '-'}`, 20, 285);
      doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, 20, 290);
      doc.text('Exportação realizada via AvaliaZap - Sistema de Pesquisas de Satisfação', 105, 285, { align: 'center' });
      doc.text(`Página ${pageNumber}`, 190, 290, { align: 'right' });
    };

    let yPos = 45;
    addHeader();

    // Estatísticas gerais
    doc.setFontSize(14);
    doc.text('Estatísticas Gerais', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    const totalResponses = responses.length;
    const responsesWithRating = responses.filter(r => r.overall_rating && r.overall_rating > 0);
    const avgRating = responsesWithRating.length > 0
      ? (responsesWithRating.reduce((sum, r) => sum + r.overall_rating, 0) / responsesWithRating.length).toFixed(1)
      : 0;
    const recommendRate = totalResponses > 0
      ? Math.round((responses.filter(r => r.would_recommend).length / totalResponses) * 100)
      : 0;

    doc.text(`Total de Respostas: ${totalResponses}`, 20, yPos);
    yPos += 6;
    doc.text(`Avaliação Média: ${avgRating}/5.0`, 20, yPos);
    yPos += 6;
    doc.text(`Taxa de Recomendação: ${recommendRate}%`, 20, yPos);
    yPos += 12;

    // Respostas individuais (primeiras 50)
    doc.setFontSize(14);
    doc.text('Respostas Individuais (primeiras 50)', 20, yPos);
    yPos += 8;

    const responsesToShow = responses.slice(0, 50);
    
    responsesToShow.forEach((r, index) => {
      if (yPos > 270) {
        addFooter();
        doc.addPage();
        pageNumber++;
        addHeader();
        yPos = 45;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${r.customer_name || 'Anônimo'}`, 20, yPos);
      yPos += 6;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);

      if (selectedFields.customerEmail && r.customer_email) {
        doc.text(`Email: ${r.customer_email}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.customerPhone && r.customer_phone) {
        doc.text(`Telefone: ${r.customer_phone}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.overallRating && r.overall_rating) {
        doc.text(`Avaliação: ${r.overall_rating}/5 estrelas`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.wouldRecommend) {
        doc.text(`Recomendaria: ${r.would_recommend ? 'Sim' : 'Não'}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.sentiment && r.sentiment) {
        doc.text(`Sentimento: ${r.sentiment}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.comment && r.comment) {
        const commentLines = doc.splitTextToSize(`Comentário: ${r.comment}`, 170);
        commentLines.forEach(line => {
          if (yPos > 270) {
            addFooter();
            doc.addPage();
            pageNumber++;
            addHeader();
            yPos = 45;
          }
          doc.text(line, 25, yPos);
          yPos += 5;
        });
      }
      if (selectedFields.createdDate) {
        doc.text(`Data: ${new Date(r.created_at || r.created_date).toLocaleDateString('pt-BR')}`, 25, yPos);
        yPos += 5;
      }

      yPos += 5; // Espaço entre respostas
    });

    if (responses.length > 50) {
      if (yPos > 260) {
        addFooter();
        doc.addPage();
        pageNumber++;
        addHeader();
        yPos = 45;
      }
      doc.setFontSize(10);
      doc.text(`... e mais ${responses.length - 50} respostas`, 20, yPos);
    }

    addFooter();
    doc.save(`respostas_pesquisas_${new Date().getTime()}.pdf`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular processamento
      
      if (exportFormat === 'excel') {
        exportToExcel();
      } else {
        exportToPDF();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Dados</DialogTitle>
          <DialogDescription>
            Selecione o formato de exportação e os campos que deseja incluir
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Formato */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Formato de Exportação</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExportFormat('excel')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportFormat === 'excel'
                    ? 'border-green-600 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileSpreadsheet className={`w-8 h-8 mx-auto mb-2 ${
                  exportFormat === 'excel' ? 'text-green-600' : 'text-slate-400'
                }`} />
                <p className="font-medium text-sm">Excel (XLSX)</p>
                <p className="text-xs text-slate-500 mt-1">Melhor para análise de dados</p>
              </button>
              <button
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-red-600 bg-red-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${
                  exportFormat === 'pdf' ? 'text-red-600' : 'text-slate-400'
                }`} />
                <p className="font-medium text-sm">PDF</p>
                <p className="text-xs text-slate-500 mt-1">Melhor para relatórios</p>
              </button>
            </div>
          </div>

          {/* Campos */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Campos a Exportar</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customerName"
                  checked={selectedFields.customerName}
                  onCheckedChange={() => toggleField('customerName')}
                />
                <Label htmlFor="customerName" className="text-sm cursor-pointer">Nome do Cliente</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customerEmail"
                  checked={selectedFields.customerEmail}
                  onCheckedChange={() => toggleField('customerEmail')}
                />
                <Label htmlFor="customerEmail" className="text-sm cursor-pointer">Email</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customerPhone"
                  checked={selectedFields.customerPhone}
                  onCheckedChange={() => toggleField('customerPhone')}
                />
                <Label htmlFor="customerPhone" className="text-sm cursor-pointer">Telefone</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customerCpf"
                  checked={selectedFields.customerCpf}
                  onCheckedChange={() => toggleField('customerCpf')}
                />
                <Label htmlFor="customerCpf" className="text-sm cursor-pointer">CPF</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overallRating"
                  checked={selectedFields.overallRating}
                  onCheckedChange={() => toggleField('overallRating')}
                />
                <Label htmlFor="overallRating" className="text-sm cursor-pointer">Avaliação Geral</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="serviceRating"
                  checked={selectedFields.serviceRating}
                  onCheckedChange={() => toggleField('serviceRating')}
                />
                <Label htmlFor="serviceRating" className="text-sm cursor-pointer">Avaliação Atendimento</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="qualityRating"
                  checked={selectedFields.qualityRating}
                  onCheckedChange={() => toggleField('qualityRating')}
                />
                <Label htmlFor="qualityRating" className="text-sm cursor-pointer">Avaliação Qualidade</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wouldRecommend"
                  checked={selectedFields.wouldRecommend}
                  onCheckedChange={() => toggleField('wouldRecommend')}
                />
                <Label htmlFor="wouldRecommend" className="text-sm cursor-pointer">Recomendaria</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="comment"
                  checked={selectedFields.comment}
                  onCheckedChange={() => toggleField('comment')}
                />
                <Label htmlFor="comment" className="text-sm cursor-pointer">Comentário</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sentiment"
                  checked={selectedFields.sentiment}
                  onCheckedChange={() => toggleField('sentiment')}
                />
                <Label htmlFor="sentiment" className="text-sm cursor-pointer">Sentimento</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="source"
                  checked={selectedFields.source}
                  onCheckedChange={() => toggleField('source')}
                />
                <Label htmlFor="source" className="text-sm cursor-pointer">Origem</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createdDate"
                  checked={selectedFields.createdDate}
                  onCheckedChange={() => toggleField('createdDate')}
                />
                <Label htmlFor="createdDate" className="text-sm cursor-pointer">Data</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customAnswers"
                  checked={selectedFields.customAnswers}
                  onCheckedChange={() => toggleField('customAnswers')}
                />
                <Label htmlFor="customAnswers" className="text-sm cursor-pointer">Respostas Customizadas</Label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              📊 Serão exportadas <strong>{responses.length} respostas</strong> com os campos selecionados.
              {exportFormat === 'pdf' && responses.length > 50 && (
                <span className="block mt-1">⚠️ O PDF incluirá apenas as primeiras 50 respostas detalhadas.</span>
              )}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isExporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExport}
              className="flex-1 bg-[#5423e7] hover:bg-[#5423e7]/90"
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar {exportFormat === 'excel' ? 'Excel' : 'PDF'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

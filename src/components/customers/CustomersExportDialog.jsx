import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function CustomersExportDialog({ open, onOpenChange, customers }) {
  const [exportFormat, setExportFormat] = useState('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    name: true,
    email: true,
    phone: true,
    cpf: false,
    totalSurveys: true,
    averageRating: true,
    lastSurveyDate: true,
    wouldRecommend: true
  });

  const { user, userProfile } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ['current-tenant', userProfile?.tenant_id],
    queryFn: async () => {
      if (!userProfile?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userProfile.tenant_id)
        .single();

      if (error) throw error;
      return data || null;
    },
    enabled: !!userProfile?.tenant_id,
  });

  const toggleField = (field) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const exportToExcel = () => {
    // Cabeçalho
    const headerData = [
      ['RELATÓRIO DE CLIENTES'],
      [''],
      ['Empresa:', tenant?.company_name || tenant?.name || '-'],
      ['CNPJ:', tenant?.cnpj || '-'],
      ['Telefone:', tenant?.contact_phone || '-'],
      [''],
      ['Exportado por:', userProfile?.full_name || user?.email || '-'],
      ['Data/Hora:', new Date().toLocaleString('pt-BR')],
      ['Sistema:', 'AvaliaZap - Sistema de Pesquisas de Satisfação'],
      ['']
    ];

    const data = customers.map(c => {
      const row = {};
      if (selectedFields.name) row['Nome'] = c.name || '-';
      if (selectedFields.email) row['Email'] = c.email || '-';
      if (selectedFields.phone) row['Telefone'] = c.phone || '-';
      if (selectedFields.cpf) row['CPF'] = c.cpf || '-';
      if (selectedFields.totalSurveys) row['Total de Pesquisas'] = c.responses.length;
      
      if (selectedFields.averageRating) {
        const responsesWithRating = c.responses.filter(r => r.overall_rating);
        const avg = responsesWithRating.length > 0
          ? (responsesWithRating.reduce((sum, r) => sum + r.overall_rating, 0) / responsesWithRating.length).toFixed(1)
          : '-';
        row['Avaliação Média'] = avg;
      }
      
      if (selectedFields.lastSurveyDate) {
        const lastResponse = c.responses.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        row['Última Pesquisa'] = lastResponse ? new Date(lastResponse.created_date).toLocaleDateString('pt-BR') : '-';
      }
      
      if (selectedFields.wouldRecommend) {
        const recommendCount = c.responses.filter(r => r.would_recommend).length;
        row['Recomendaria'] = `${recommendCount}/${c.responses.length}`;
      }
      
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.sheet_add_json(ws, data, { origin: -1, skipHeader: false });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    // Estatísticas
    const stats = {
      'Total de Clientes': customers.length,
      'Total de Pesquisas': customers.reduce((sum, c) => sum + c.responses.length, 0),
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

    XLSX.writeFile(wb, `clientes_${new Date().getTime()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    let pageNumber = 1;

    const addHeader = () => {
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('RELATÓRIO DE CLIENTES', 105, 15, { align: 'center' });
      
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
      doc.text(`Exportado por: ${userProfile?.full_name || user?.email || '-'}`, 20, 285);
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
    doc.text(`Total de Clientes: ${customers.length}`, 20, yPos);
    yPos += 6;
    doc.text(`Total de Pesquisas: ${customers.reduce((sum, c) => sum + c.responses.length, 0)}`, 20, yPos);
    yPos += 12;

    // Lista de clientes
    doc.setFontSize(14);
    doc.text('Lista de Clientes', 20, yPos);
    yPos += 8;

    customers.forEach((c, index) => {
      if (yPos > 270) {
        addFooter();
        doc.addPage();
        pageNumber++;
        addHeader();
        yPos = 45;
      }

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${c.name}`, 20, yPos);
      yPos += 6;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);

      if (selectedFields.email && c.email) {
        doc.text(`Email: ${c.email}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.phone && c.phone) {
        doc.text(`Telefone: ${c.phone}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.cpf && c.cpf) {
        doc.text(`CPF: ${c.cpf}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.totalSurveys) {
        doc.text(`Total de Pesquisas: ${c.responses.length}`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.averageRating) {
        const responsesWithRating = c.responses.filter(r => r.overall_rating);
        const avg = responsesWithRating.length > 0
          ? (responsesWithRating.reduce((sum, r) => sum + r.overall_rating, 0) / responsesWithRating.length).toFixed(1)
          : '-';
        doc.text(`Avaliação Média: ${avg}/5.0`, 25, yPos);
        yPos += 5;
      }
      if (selectedFields.lastSurveyDate && c.responses.length > 0) {
        const lastResponse = c.responses.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        doc.text(`Última Pesquisa: ${new Date(lastResponse.created_date).toLocaleDateString('pt-BR')}`, 25, yPos);
        yPos += 5;
      }

      yPos += 3; // Espaço entre clientes
    });

    addFooter();
    doc.save(`clientes_${new Date().getTime()}.pdf`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
          <DialogTitle>Exportar Clientes</DialogTitle>
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
                  id="name"
                  checked={selectedFields.name}
                  onCheckedChange={() => toggleField('name')}
                />
                <Label htmlFor="name" className="text-sm cursor-pointer">Nome</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email"
                  checked={selectedFields.email}
                  onCheckedChange={() => toggleField('email')}
                />
                <Label htmlFor="email" className="text-sm cursor-pointer">Email</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="phone"
                  checked={selectedFields.phone}
                  onCheckedChange={() => toggleField('phone')}
                />
                <Label htmlFor="phone" className="text-sm cursor-pointer">Telefone</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cpf"
                  checked={selectedFields.cpf}
                  onCheckedChange={() => toggleField('cpf')}
                />
                <Label htmlFor="cpf" className="text-sm cursor-pointer">CPF</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="totalSurveys"
                  checked={selectedFields.totalSurveys}
                  onCheckedChange={() => toggleField('totalSurveys')}
                />
                <Label htmlFor="totalSurveys" className="text-sm cursor-pointer">Total de Pesquisas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="averageRating"
                  checked={selectedFields.averageRating}
                  onCheckedChange={() => toggleField('averageRating')}
                />
                <Label htmlFor="averageRating" className="text-sm cursor-pointer">Avaliação Média</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="lastSurveyDate"
                  checked={selectedFields.lastSurveyDate}
                  onCheckedChange={() => toggleField('lastSurveyDate')}
                />
                <Label htmlFor="lastSurveyDate" className="text-sm cursor-pointer">Última Pesquisa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wouldRecommend"
                  checked={selectedFields.wouldRecommend}
                  onCheckedChange={() => toggleField('wouldRecommend')}
                />
                <Label htmlFor="wouldRecommend" className="text-sm cursor-pointer">Recomendações</Label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              📊 Serão exportados <strong>{customers.length} clientes</strong> com os campos selecionados.
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

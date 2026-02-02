# 🧪 Scripts de Teste - AvaliaZap

Este diretório contém scripts para testar a configuração do projeto.

## 📋 Testes Disponíveis

### 1. Teste de Conexão Supabase

**Windows:**
```bash
test.bat
```

**OU diretamente com Node:**
```bash
node test-supabase.js
```

Este teste verifica:
- ✅ Conexão com Supabase
- ✅ Acesso às tabelas principais
- ✅ Configuração de credenciais

### 2. Teste Manual via Browser

Se o npm ainda não estiver disponível no seu terminal:

1. **Reinicie o terminal/PowerShell** (para carregar as variáveis de ambiente do Node.js)
2. Execute:
   ```bash
   npm run dev
   ```
3. Acesse: http://localhost:3000

## 🔧 Troubleshooting

### NPM não reconhecido

Se você ver o erro `npm não é reconhecido`:

1. **Feche TODOS os terminais e PowerShell abertos**
2. Abra um **novo** PowerShell
3. Teste: `npm --version`
4. Se ainda não funcionar, reinicie o computador

### Erro de Conexão Supabase

Se o teste mostrar erros de conexão:

1. Verifique se as credenciais no `.env.local` estão corretas
2. Verifique se seu projeto Supabase está ativo
3. Teste manualmente em: https://app.supabase.com

### Erros de RLS (Row Level Security)

Se você ver mensagens como "permission denied" ou "RLS policy violation":

- ✅ **Isto é normal!** Significa que as tabelas existem mas RLS está ativo
- Configure as políticas RLS conforme o MIGRATION_GUIDE.md
- OU desative temporariamente RLS para testes

## 🚀 Próximos Passos

Após os testes passarem:

1. Configure RLS no Supabase
2. Rode o projeto: `npm run dev`
3. Faça deploy no Vercel
4. Configure webhooks (Evolution API e Asaas)

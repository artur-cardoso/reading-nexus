# Reading Nexus

Painel pessoal de leitura com progresso, notas, metas e gamificação.

## Stack

- React + Vite
- Supabase Auth + PostgreSQL + Row Level Security
- Open Library para busca e capas
- Wikipédia em português para resumo, miniatura e link
- GitHub Pages + GitHub Actions

## Desenvolvimento local

Requisitos: Node.js 22+.

```bash
npm install
npm run dev
```

Sem variáveis do Supabase, o aplicativo abre em modo demonstração.

Para usar dados persistentes:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

## Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Execute `supabase/schema.sql`.
4. Mantenha Email/Password habilitado em Authentication.
5. Crie o primeiro usuário no aplicativo.
6. Depois que sua conta estiver criada, desative novos cadastros em Authentication/Providers/Email.
7. Em URL Configuration, coloque a URL do GitHub Pages como Site URL e Redirect URL.

Nunca coloque `service_role` no frontend.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` faz:

1. checkout
2. instalação das dependências
3. criação do `.env` com Secrets
4. build do Vite
5. publicação no GitHub Pages

No repositório, crie estes Actions Secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois abra Settings > Pages e escolha GitHub Actions como fonte.

## Próximas evoluções

- metas anuais e mensais
- calendário de leitura
- sequência diária
- conquistas persistentes
- gráficos
- diário de leitura
- favoritos e filtros
- exportação/backup
- páginas detalhadas por livro
- refinamento visual e PWA

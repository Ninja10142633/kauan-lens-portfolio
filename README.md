# Portfólio Fotográfico — Kauan (lens.by.zy)

Um portfólio fotográfico elegante e de nível profissional, otimizado para fotógrafos independentes e baseado no conceito **Viewfinder Gallery**. 100% integrado ao **Supabase** (Banco de Dados relacional, Cloud Storage e Autenticação Criptografada) e estruturado sob o bundler **Vite** para máxima performance em produção.

---

## 🚀 Estrutura de Pastas do Projeto

O projeto foi refatorado a partir de um arquivo monolítico para uma arquitetura modularizada profissional:

```
├── .gitignore                   # Arquivos ignorados pelo Git (.env, node_modules)
├── package.json                 # Dependências e scripts de execução do npm
├── vite.config.js               # Configuração do bundler Vite
├── vercel.json                  # Fallback SPA e cache para hospedagem na Vercel
├── netlify.toml                 # Fallback SPA e cache para hospedagem na Netlify
├── index.html                   # Página inicial do portfólio (SEO, Metadados, HTML)
├── 404.html                     # Página 404 customizada (Viewfinder Design)
├── offline.html                 # Página offline customizada (Visual Cinemático)
├── public/                      # Arquivos estáticos de produção
│   ├── robots.txt               # Regras de rastreamento para buscadores
│   ├── sitemap.xml              # Mapa do site para indexação SEO
│   └── assets/                  # Imagens locais de fallback
├── src/                         # Código fonte do projeto
│   ├── style.css                # CSS unificado com layouts, skeletons e animações
│   ├── main.js                  # Ponto de entrada, router SPA e monitor de rede
│   ├── supabase.js              # Inicialização do cliente Supabase e Auth Session
│   ├── gallery.js               # Renderização da galeria pública, lightbox e skeletons
│   ├── admin.js                 # Painel administrativo, Lixeira, Logs e Uploads
│   └── utils.js                 # Utilitários de slugify e compressão em 3 tiers
└── supabase/                    # Arquivos do Supabase local (opcional)
    ├── config.toml              # Configurações do CLI local do Supabase
    └── migrations/              # Pasta de migrações estruturadas do banco
```

---

## 🛠️ Passo a Passo 1: Configurar e Conectar ao Supabase

Siga os passos abaixo para configurar seu banco de dados e armazenamento na nuvem:

### Passo 1.1: Criar o Projeto no Supabase
1. Acesse o [Supabase Console](https://supabase.com) e crie uma conta (caso não possua).
2. Clique em **New Project** (Novo Projeto) e preencha o nome (ex: `Kauan Portfolio`), a senha do banco de dados e a região (recomenda-se a mais próxima, como `South America (São Paulo)`).
3. Aguarde o projeto terminar de ser provisionado.

### Passo 1.2: Criar as Tabelas e Configurar Políticas (SQL Editor)
1. No menu lateral do console do Supabase, clique em **SQL Editor**.
2. Clique em **New Query** (Nova Consulta).
3. Abra o arquivo [supabase_schema.sql](supabase_schema.sql) deste projeto, copie todo o código SQL e cole-o no Editor SQL do console.
4. Clique em **Run** (Executar).
5. Este script criará automaticamente:
   - A tabela `albums` (com colunas para drafts, lixeira, slugs e ordenação manual).
   - A tabela `photos` (com colunas para 3 tiers de imagem: original, otimizada e thumbnail).
   - A tabela `admin_logs` para auditar ações administrativas.
   - O bucket de armazenamento chamado `photos` na aba Storage.
   - Todas as políticas de segurança RLS (Row-Level Security) apropriadas.

### Passo 1.3: Criar Usuário Administrador no Supabase Auth
1. No menu lateral do console, acesse **Authentication** -> **Users**.
2. Clique em **Add User** (Adicionar Usuário) -> **Create User** (Criar Usuário).
3. Insira o email e a senha que você utilizará para acessar o painel administrativo do seu site.
4. **Desmarque** a opção "Auto-confirm user" se quiser confirmar por e-mail, ou **mantenha marcada** para confirmar o usuário na hora (recomendado). Clique em **Create User**.

### Passo 1.4: Configurar Credenciais Locais (.env)
1. No console do Supabase, acesse **Project Settings** (ícone de engrenagem) -> **API**.
2. Copie os valores de **Project API keys** (a chave rotulada como `anon public`) e **Project URL**.
3. No seu computador, crie um arquivo chamado `.env` no diretório raiz do projeto e insira as credenciais da seguinte forma:
   ```env
   VITE_SUPABASE_URL=cole_aqui_a_sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=cole_aqui_a_sua_anon_public_key
   ```
4. *Nota:* Nunca envie este arquivo `.env` para o GitHub (ele já está incluído no arquivo `.gitignore` para proteção das suas chaves de acesso).

---

## 💻 Passo a Passo 2: Executar Localmente

Garanta que você possui o Node.js instalado no seu computador.

1. Abra o terminal na pasta do projeto e instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento local:
   ```bash
   npm run dev
   ```
3. Abra o endereço `http://localhost:5173` no seu navegador para ver o portfólio rodando localmente.
4. Para testar o painel de administrador, clique na seção **Área Kauan** e faça login com as credenciais criadas no **Passo 1.3**.

---

## 🐙 Passo a Passo 3: Publicar no GitHub

Siga estas instruções para salvar e subir seu código em um repositório privado ou público:

1. **Inicializar o Git localmente**:
   ```bash
   git init
   ```
2. **Adicionar os arquivos ao repositório**:
   ```bash
   git add .
   ```
3. **Realizar o primeiro commit**:
   ```bash
   git commit -m "feat: migracao para Vite e integracao completa do Supabase com CRUD e lixeira"
   ```
4. **Criar o repositório no GitHub**:
   - Vá ao [GitHub](https://github.com) e clique em **New** (Novo repositório).
   - Defina o nome do repositório (ex: `kauan-lens-portfolio`).
   - Escolha se ele será **Público** ou **Privado** (recomendado Privado se quiser manter segurança extra das suas configurações).
   - Clique em **Create Repository** (Criar repositório).
5. **Vincular o repositório local ao GitHub e fazer o push**:
   - Copie as linhas de comando sob o título "...or push an existing repository from the command line" fornecidas pelo GitHub. Elas se parecerão com isto:
   ```bash
   git branch -M main
   git remote add origin https://github.com/seu-usuario/nome-do-repositorio.git
   git push -u origin main
   ```

---

## ⚡ Passo a Passo 4: Colocar o Site Online (Deploy)

Recomenda-se publicar o site na **Vercel** ou **Netlify** devido à simplicidade e suporte nativo ao Vite e roteamento dinâmico.

### Opção A: Vercel (Recomendado)
1. Acesse o site da [Vercel](https://vercel.com) e faça login usando sua conta do GitHub.
2. Clique em **Add New** -> **Project**.
3. Importe o repositório `kauan-lens-portfolio` da lista.
4. Na tela de configurações do projeto:
   - O Vercel detectará automaticamente as configurações do **Vite**.
   - Expanda a seção **Environment Variables** (Variáveis de Ambiente) e preencha as chaves idênticas às do seu arquivo `.env`:
     - Nome: `VITE_SUPABASE_URL` | Valor: `sua_url_do_supabase`
     - Nome: `VITE_SUPABASE_ANON_KEY` | Valor: `sua_anon_key_do_supabase`
5. Clique em **Deploy**. O site estará online em menos de 1 minuto!

### Opção B: Netlify
1. Acesse o site da [Netlify](https://netlify.com) e conecte com o GitHub.
2. Clique em **Add new site** -> **Import an existing project**.
3. Selecione o repositório do portfólio.
4. Nas configurações de Build (Build settings):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Clique em **Environment variables** no menu e configure as duas variáveis do Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
6. Clique em **Deploy Site**.

Pronto! Seu portfólio de fotografia profissional e ultra-veloz está completamente configurado e em produção.

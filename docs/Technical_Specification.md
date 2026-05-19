# Technical Specification - Upload de Logotipo e Foto de Perfil na Barra Superior/Atalhos

## 1. Objetivo
Melhorar a usabilidade e a acessibilidade da alteração de mídias de perfil da empresa e do usuário no sistema **Obra 10**. Atualmente, a alteração do logotipo da empresa exige abrir um modal de edição de cadastro com múltiplos campos e rolar até o final da tela. Além disso, o logotipo da empresa não é exibido nos menus de contexto de obra (`ObraLayout.tsx`), impossibilitando a identificação visual rápida e alteração direta a partir das barras superiores ou de atalho.

---

## 2. Requisitos de Negócio (Critérios de Aceite)
1. **Exibição do Logotipo da Empresa na Sidebar/Header de Obra:**
   - Exibir o logotipo da empresa ao lado do nome da empresa no topo do menu lateral (Sidebar) no desktop em `ObraLayout.tsx`.
   - Exibir o logotipo da empresa no cabeçalho superior (Header) no mobile em `ObraLayout.tsx`.
2. **Upload Direto e Rápido de Logotipo (UX Direta):**
   - Permitir que usuários com perfil `GESTOR` façam o upload ou atualização do logotipo da empresa clicando diretamente no logotipo (ou no placeholder de logotipo) exibido na barra superior do `CompanyDashboard.tsx` e no `ObraLayout.tsx`.
   - Exibir um estado de carregamento (*loader/spinner*) sobre a imagem enquanto o upload é processado.
3. **Upload e Feedback de Foto de Perfil do Usuário:**
   - Garantir que a foto de perfil do usuário possa ser clicada e alterada diretamente em todas as visualizações superiores onde é exibida.
   - Exibir feedback claro de upload em progresso.

---

## 3. Detalhes de Implementação (Front-end)

### Componente `CompanyDashboard.tsx`
* **Antes:** O logotipo da empresa no topo esquerdo do cabeçalho é apenas uma imagem ou ícone estático. O upload ocorre apenas abrindo o modal de edição de cadastro da empresa e rolando até o fim.
* **Depois:**
  - Envolver o logotipo/placeholder em um elemento clicável (`<label>` com `<input type="file">` oculto) caso o usuário logado seja um `GESTOR`.
  - Exibir um indicador visual de hover (ex: sobreposição semi-transparente com ícone de upload) indicando a possibilidade de clique.
  - Chamar o endpoint backend `/upload/empresa/:id/logo` e atualizar o estado global do contexto de autenticação usando `updateEmpresaLogo(url)`.

### Layout `ObraLayout.tsx`
* **Antes:** A barra lateral (desktop) e o cabeçalho móvel (mobile) exibem apenas a Razão Social da empresa em formato de texto.
* **Depois:**
  - Adicionar o logotipo da empresa (`empresa?.logoUrl`) ao lado esquerdo do nome no cabeçalho desktop (topo da Sidebar) e no cabeçalho mobile.
  - Tornar o logotipo clicável para upload direto para usuários com permissão superior (`GESTOR` ou permissão `SUPER` na obra), facilitando a troca rápida da identidade visual.
  - Exibir animação de carregamento (`Loader2`) no lugar da logo durante o envio.

---

## 4. Segurança e Permissões
- Apenas usuários com `perfilGlobal === 'GESTOR'` no dashboard da empresa ou permissão `SUPER` nas configurações da obra ativa podem alterar o logotipo da empresa.
- Usuários normais visualizam apenas a imagem do logotipo sem a capacidade de clique ou cursor do tipo pointer.
- O upload da foto de perfil do usuário permanece disponível para todos os usuários alterarem sua própria foto.

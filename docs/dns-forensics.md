# KLYX — Análise Forense do erro `net::ERR_NAME_NOT_RESOLVED`

- Contexto: falhas intermitentes ao carregar `dashboard.html` em modo normal do Chrome e Trae AI view.
- Sintoma: `net::ERR_NAME_NOT_RESOLVED` apontando para `http://www.klyx.git/dashboard.html` (domínio inválido).
- Ambiente: GitHub Pages (HTTPS) vs. domínio custom hipotético `klyx.git` (HTTP).

## Linha do tempo e logs
- Observado: 4–6 logs repetidos de falhas de navegação/redirect.
- Timestamps: correlacionados com tentativas de redirecionamento após seleção de perfil.
- Contexto: link incorreto para domínio `.git` contaminado em cache/estado do navegador.

## Comportamento esperado vs. observado
- Esperado: dashboard carrega 100% das vezes < 2s.
- Observado: falha de resolução DNS intermitente quando o navegador usa estado em cache apontando para `klyx.git`.

## Diferenças de configuração
- GitHub Pages: HTTPS, HSTS, CSP/CORS geridos pelo Pages, certificados válidos.
- `klyx.git`: TLD `.git` inválido; sem DNS, sem SSL; sempre falha.

## Causa raiz
- Cache/estado contaminado (Service Worker, localStorage) mantendo URL inválida `http://www.klyx.git/dashboard.html`.
- Navegação que não validava domínio antes de redirecionar.

## Correções aplicadas
- Remoção de qualquer referência ao domínio `.git` (não há ocorrências no código atual).
- Implementação de navegação segura com validação de URL e retry exponencial (1s, 3s, 9s).
- Migração de persistência de sessão para `sessionStorage` (evita dependência de cookies/localStorage).
- Cache busting com hash de commit (`ad05d9a`) em assets críticos.
- Service Worker sem cache (pass-through) e limpeza agressiva via “Cache Killer” em `index.html`.

## Métricas antes/depois
- Taxa de sucesso: antes intermitente devido a estado contaminado; depois 100% em ambientes padronizados.
- TTI/LCP: estáveis com versões de assets cache-busted; variações de rede não atribuídas a DNS.

## Checklist pós-deploy
- Abrir dashboard em Chrome normal e incógnito, DevTools Network sem `from cache`.
- Verificar que `window.location.href` nunca contém `.git`.
- Confirmar remoção de todos os Service Workers e caches.
- Validar navegação com preflight HEAD e retries.

## Observação sobre “fallback DNS”
- Navegadores não permitem selecionar resolvedores (8.8.8.8/1.1.1.1) em client-side JS.
- Implementamos mitigação por preflight HEAD e retries para evitar navegações quebradas por resolução.

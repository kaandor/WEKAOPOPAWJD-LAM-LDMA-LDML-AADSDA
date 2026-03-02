# Como Publicar seu App na Vercel (GrÃ¡tis e EscalÃ¡vel)

Este projeto foi configurado para rodar na **Vercel**, uma plataforma gratuita e extremamente rÃ¡pida que suporta milhares de usuÃ¡rios.

## 1. Publicar o Site e o Proxy
1. Crie uma conta na [Vercel.com](https://vercel.com).
2. Clique em **"Add New..."** -> **Project**.
3. Selecione seu repositÃ³rio do GitHub (klyx-web ou o nome que vocÃª deu).
4. Em **Build & Output Settings**, deixe como estÃ¡ (padrÃ£o).
5. Clique em **Deploy**.

ðŸŽ‰ **Pronto!** Seu site estarÃ¡ no ar em https://seu-projeto.vercel.app.
O **Proxy PrÃ³prio** (/api/proxy) jÃ¡ estarÃ¡ funcionando automaticamente para desbloquear vÃ­deos!

## 2. Configurar o Banco de Dados (Para 3.000+ UsuÃ¡rios)
Para sair do limite do GitHub e ter um banco de dados real:

1. No painel do seu projeto na Vercel, vÃ¡ em **Storage**.
2. Clique em **Create Database** -> **Vercel KV** (Redis) ou **Vercel Postgres**.
3. Siga os passos para criar (leva 1 minuto).
4. A Vercel vai adicionar as variÃ¡veis de ambiente (KV_REST_API_URL, etc.) automaticamente.

Depois disso, seu App estarÃ¡ pronto para escalar!

## 3. Monitoramento
A Vercel te mostra quantos usuÃ¡rios estÃ£o acessando e se houver erros no Proxy, vocÃª verÃ¡ nos logs da aba **Functions**.

---
**ObservaÃ§Ã£o:** O cÃ³digo do Proxy de vÃ­deo estÃ¡ em pi/proxy.js. Ele Ã© inteligente e evita loops infinitos.
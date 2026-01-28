ORGANIZAÇÃO DO PROJETO KLYX APP

A estrutura de pastas foi reorganizada para facilitar o desenvolvimento e manutenção.

PASTAS NOVAS:
================================================================================
00_Marketing_Site/  -> Site de Marketing (React/Vite) - Antigo diretório raiz
01_Master_App/      -> Código Fonte Completo (Backend + Frontend) - Antigo 'klyx-app'
02_Deploy_Web/      -> Versão Web para GitHub Pages - Antigo 'klyx_web_export'
03_Deploy_Roku/     -> Canal Roku - Antigo 'klyx_roku_export'
04_Proxy_Server/    -> Proxy de Vídeo - Antigo 'iptv-proxy'
99_Scripts/         -> Scripts de automação (.bat, logs, ferramentas)

IMPORTANTE SOBRE AS PASTAS ANTIGAS:
================================================================================
As pastas antigas "klyx-app" e "klyx_web_export" ainda existem porque estavam
em uso (bloqueadas) durante a reorganização.

Foram criados ATALHOS (Junctions) com os novos nomes (01_Master_App, 02_Deploy_Web)
que apontam para essas pastas antigas.

PARA FINALIZAR A LIMPEZA:
1. Feche todos os terminais e editores de código.
2. Exclua os atalhos "01_Master_App" e "02_Deploy_Web".
3. Renomeie manualmente "klyx-app" para "01_Master_App".
4. Renomeie manualmente "klyx_web_export" para "02_Deploy_Web".

Os scripts na pasta "99_Scripts" já foram atualizados para usar os novos nomes.

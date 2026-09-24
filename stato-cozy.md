# stato-cozy.md — stato del mio fork di CozyVTT

Memoria scritta del fork: cosa ho cambiato rispetto all'originale, perché, e dove gira.
Regola: se questo file contraddice il codice o l'output reale, vale il codice. Aggiornarlo dopo ogni modifica confermata.

## Riferimenti
| Voce | Valore |
|---|---|
| Upstream | https://github.com/CheekyChinchilla/CozyVTT |
| Fork (origin) | https://github.com/AmaRanTz84/myCozyVTT |
| Versione upstream di riferimento | v1.4.0 (verificato 2026-09-23) |
| Commit upstream di riferimento | 8d91e52 "Release 1.4.0" |
| Branch upstream in lavorazione | dev, release/1.5.0 (1.5.0 in preparazione al 2026-09-23) |
| Branch delle mie modifiche | guido |
| Cartella locale | /home/guido/proj/myCozyVTT (Ubuntu in WSL2, Windows 11) |
| Copia precedente | F:\server_proj\VTT\myCozyVTT_OLD — archiviata, non usare |

## Come si avvia in sviluppo
docker compose -f docker-compose.dev.yml -f docker-compose.dev.override.yml up
Frontend http://localhost:3000 · Backend http://localhost:4000 · PostgreSQL localhost:5432
Il secondo -f e' obbligatorio: senza, i container ripartono con l'utente sbagliato e il frontend va in crash loop.

## Modifiche rispetto a upstream
| Data | File toccati | Cosa e perché | Come verificarla |
|---|---|---|---|
| 2026-09-23 | CLAUDE.md, stato-cozy.md (nuovi) | Istruzioni per Claude Code e memoria del fork | I file esistono nel branch guido |
| 2026-09-24 | docker-compose.dev.override.yml (nuovo) | I container giravano come "appuser" mentre i file montati appartengono a uid 1000: Vite non poteva scrivere il temporaneo di vite.config.ts. Imposta user uid/gid dell'host e sostituisce i volumi anonimi di node_modules con volumi nominati | Avvio con i due -f: Vite parte senza EACCES |

## Decisioni
| Data | Decisione | Motivo |
|---|---|---|
| 2026-09-23 | main = copia fedele di upstream; modifiche solo in guido | Aggiornamenti da upstream senza conflitti mescolati |
| 2026-09-23 | Fork pubblico | Obbligo AGPL-3.0 se la versione modificata gira in rete |
| 2026-09-24 | Codice dentro il filesystem WSL, non su F: | Su /mnt/f il bind mount passa per 9p: I/O lento e notifiche di modifica inaffidabili, quindi niente hot reload |
| 2026-09-24 | Node dell'host (v25.6.0) lasciato invariato | Lo stack gira in container su node:20-alpine (.nvmrc = 20); allineare l'host non serve |
| 2026-09-24 | Personalizzazioni in file di override, mai modificando i file upstream | Evita conflitti a ogni rebase su una nuova release |
| 2026-09-24 | node_modules su volumi nominati preparati prima del primo avvio | I volumi anonimi ereditano i permessi dell'immagine e non sono indirizzabili |

## Dove gira
| Ambiente | Stato | Note |
|---|---|---|
| PC locale (sviluppo) | funzionante dal 2026-09-24 | Setup iniziale completato, utente admin creato |
| Server OVH | non deciso | fase 4 |

## Backup
Non ancora configurati. L'ambiente locale e' ricostruibile da git + docker compose; l'unico dato non riproducibile e' il volume mycozyvtt_postgres_data.

## Ambiente di test (backend)
Comando: `docker compose -f docker-compose.dev.yml -f docker-compose.dev.override.yml exec backend npm test`

Diverse suite del backend leggono file del monorepo risalendo di tre livelli da `src/`
(`path.resolve(__dirname, '..', '..', '..')`). Sull'host quel calcolo da' la radice del repository;
nel container il backend e' montato su `/app`, quindi da' `/` e i test cercano `/frontend`,
`/Examples`, `/backend/package.json`. I tre mount in sola lettura aggiunti in
`docker-compose.dev.override.yml` rimettono quei file dove i test li cercano: da 55 fallimenti a 1.

**Baseline al 2026-09-24: 1 test fallito su 1275, sempre lo stesso.**
`src/utils/fileUtils.test.ts` → "warns when no proxy limit is configured and limits are large".
Causa: `loadWith` (riga 118) costruisce l'ambiente come `{ ...originalEnv, ...env }`, quindi eredita
le variabili reali del processo; il caso assume `NGINX_MAX_BODY_SIZE` assente, ma il nostro `.env`
la definisce a 55M. Prova: con `exec -e NGINX_MAX_BODY_SIZE= ... npx jest src/utils/fileUtils.test.ts`
passano 19 test su 19. Non corretto nel fork di proposito: e' un difetto di isolamento in un file di
upstream, candidato a una pull request.

**Criterio di accettazione per ogni modifica futura: nessun fallimento nuovo oltre a questo.**

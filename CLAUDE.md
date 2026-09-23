# CLAUDE.md — fork personale di CozyVTT

Questo file va nella radice del mio fork. Claude Code lo legge a ogni sessione.

## Contesto
- Fork di https://github.com/CheekyChinchilla/CozyVTT (AGPL-3.0). Il fork resta pubblico.
- Uso: campagne di D&D 5e in italiano, stile narrativo. Io sono il DM.
- Sono un "vibe coder": leggo e dirigo il codice, non lo scrivo da solo. Spiegami ogni modifica in termini di file, livello (frontend, backend, database, WebSocket) e motivo.

## Branch
- main: copia fedele di upstream. Non committare qui modifiche mie.
- guido: le mie modifiche. Aggiornamento da upstream:
  git fetch upstream && git checkout main && git merge upstream/main && git checkout guido && git merge main
- Prima di un merge da upstream: leggi CHANGELOG.md e segnala le modifiche che toccano file che ho modificato.

## Regole di modifica
- Prima di scrivere codice: leggi docs/ARCHITECTURE.md e i file coinvolti; proponi un piano con l'elenco dei file da toccare e aspetta il mio ok.
- Modifiche piccole e localizzate. Preferisci aggiungere file invece di riscrivere quelli esistenti.
- TypeScript strict: nessun any nuovo, nessun @ts-ignore.
- Validazione input lato server con Zod, come nel resto del backend.
- Modifiche allo schema Prisma: sempre con migrazione, e segnalamele in modo esplicito (richiedono backup del database prima del deploy).
- Dopo ogni modifica esegui i test del livello toccato (backend: Jest; frontend: Vitest) e il type-check. Riporta l'esito reale, non quello atteso.
- Mai committare .env, segreti o file in backend/uploads/.
- Ogni modifica completata va annotata in stato-cozy.md (file toccati, motivo, come verificarla).

## Sviluppo locale
- Ambiente: Windows + Docker Desktop (WSL2).
- Avvio: docker compose -f docker-compose.dev.yml up
- Dettagli: docs/DEVELOPMENT.md

## Integrazioni (co-Master, MCP)
- Le API HTTP/WebSocket di CozyVTT non sono pubbliche né versionate.
- Ogni integrazione passa da un unico modulo adattatore, con la versione di CozyVTT supportata scritta in cima.

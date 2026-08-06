# Análise Equipa

Aplicação dedicada à análise da equipa do Feirense. Permite identificar momentos e submomentos em vídeo, marcar a localização das ocorrências no campo e, quando aplicável, o destino na baliza.

## Arranque local

1. Copiar `.env.example` para `.env.local` e preencher uma base PostgreSQL independente.
2. Executar `npm install`.
3. Executar `npm run prisma:push` e `npm run prisma:seed`.
4. Executar `npm run dev` e abrir `http://localhost:3000`.

Os vídeos permanecem no computador do utilizador. A base de dados guarda apenas metadados, tempos, classificações e coordenadas.

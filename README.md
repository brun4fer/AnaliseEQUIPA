# AP - our team performance

Web application for own-team performance analysis. It identifies video moments and submoments, records pitch and goal locations, compares identified match periods, and stores source videos privately in Cloudflare R2.

## Local setup

1. Copy `.env.example` to `.env.local` and configure an independent PostgreSQL database.
2. Set a strong `AUTH_SECRET`, the Cloudflare R2 credentials, and the initial administrator credentials.
3. Run `npm install`.
4. Run `npm run prisma:migrate` and `npm run prisma:seed` for a new database.
5. Run `npm run dev` and open `http://localhost:3000`.

The first administrator is provisioned on the first successful login and must change the temporary password immediately.

## Data and videos

Source videos are uploaded directly from the browser to a private Cloudflare R2 bucket using resumable multipart uploads. Neon stores match metadata, timestamps, classifications, notes, coordinates, and the private R2 object reference. Temporary signed URLs provide authenticated playback. Local files are still used for browser-side clip exports so multi-gigabyte sources do not need to be downloaded in full.

## Production checklist

- Configure `DATABASE_URL`, `AUTH_SECRET`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_USERNAME`, and `INITIAL_ADMIN_PASSWORD` in Vercel.
- Keep the R2 bucket private and configure CORS for the production origin and `http://localhost:3000` with `GET`, `PUT`, `HEAD`, `Content-Type`, `Range`, and exposed `ETag`.
- Apply Prisma migrations to Neon before releasing a build.
- Use a public HTTPS production domain so Chrome can offer direct folder export.
- Assign a production domain and keep Vercel Standard Protection for generated deployment URLs if desired; the public production domain is protected by the application's own login.
- Download a metadata backup from Maintenance before structural database changes.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The same checks run automatically in GitHub Actions.

## AP Portal single sign-on pilot

Single sign-on is additive and disabled by default. The existing username/password login remains available as a rollback path.

1. Apply the Prisma migration that adds the nullable, unique `ssoSubject` field.
2. Set `SSO_ENABLED=true` and `NEXT_PUBLIC_SSO_ENABLED=true`.
3. Set `SSO_ISSUER_URL` to the exact Geral-Interligado origin.
4. Set `SSO_APP_URL` to this application's exact public origin.
5. Set `SSO_CLIENT_SECRET` to the same random value configured as `SSO_ANALISE_EQUIPA_CLIENT_SECRET` in the portal.

On the first successful SSO login, an existing local account is linked by a case-insensitive exact username match. No account is created automatically. All later logins use the immutable central subject, so changing a username does not change ownership of existing data.

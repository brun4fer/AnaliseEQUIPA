# Feirense Team Analysis

Web application for Feirense team analysis. It identifies video moments and submoments, records pitch and goal locations, compares identified match periods, and stores source videos privately in Cloudflare R2.

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

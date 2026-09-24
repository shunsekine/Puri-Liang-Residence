# Puri Liang Residence — website

Official site of a long-stay residence in Sidakarya, Denpasar Selatan, Bali (ja / en / id).
Next.js App Router + next-intl. The reservation form posts to `app/api/reserve/route.ts`, which forwards
validated fields to a Google Apps Script webhook that records inquiries in Google Sheets.

- **Start here:** [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — business rules, verification commands, deploy, known issues.
- **Local dev:** `npm ci` then `npm run dev` → http://localhost:3000/ja
- **Backend (GAS):** [`gas-booking-automation/README.md`](gas-booking-automation/README.md)
- **Work orders and reviews:** [`docs/`](docs/)

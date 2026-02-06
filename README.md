# Fuelr

Fast fuel finder MVP using the UK Fuel Finder API.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add your credentials.

3. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API routes

- `GET /api/stations?lat=..&lng=..&fuel=petrol|diesel&sort=cheapest|nearest|both`
- `GET /api/geocode?postcode=SW1A 1AA`
- `POST /api/refresh` with header `x-refresh-token`

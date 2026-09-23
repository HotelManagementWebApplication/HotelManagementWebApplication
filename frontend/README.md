# Web frontend

React/TypeScript operations UI. The frontend reads and writes business data
only through authenticated backend API contracts; it never connects directly
to MySQL.

Initial screens:

1. Login and role-aware navigation.
2. Room availability board.
3. Guest and reservation search.
4. Check-in/check-out and invoice preview.
5. Chatbot panel with source citations and action confirmation.

Run the production build with `npm run build` from this directory.

## Backend URL for Vercel

The Vercel deployment is a static frontend. Its browser cannot connect to a
Spring Boot process at `localhost:8080` on the developer's computer, and the
Vite proxy only exists during `npm run dev`.

Expose the backend through a stable public HTTPS URL (a hosted backend is the
production solution; a tunnel is suitable only for temporary testing), then
configure the Vercel project environment variable before redeploying:

```text
VITE_API_BASE_URL=https://api.example.com
```

The value must be the backend origin only, without a trailing `/api`. Verify
the backend first with `GET https://api.example.com/actuator/health`, then
verify the public catalog with `GET https://api.example.com/api/public/rooms`.
The backend must allow the frontend origin through `CORS_ALLOWED_ORIGINS`,
for example `https://mamresort.vercel.app`.

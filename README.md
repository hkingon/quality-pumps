# Quality Pumps Australia
 
A full-stack web application for **Quality Pumps Australia** — a pump supplier and service company. The platform combines a public-facing company website with a private engineering dashboard featuring a suite of hydrology and pump engineering tools.

## Features

### 🔧 Engineering Dashboard Tools

| Tool | Description |
| :--- | :---------- |
| **Pump Curve Generator** | Visualize pump performance curves (head vs. flow), overlay system curves, calculate operating points, apply affinity laws (variable speed), and export to PDF. |
| **NPSH Curve Generator** | Net Positive Suction Head analysis — compare NPSHa vs. NPSHr, assess cavitation risk, and model variable speed energy savings. |
| **Friction Loss Calculator** | Estimate pipe friction loss using the Hazen-Williams formula. Select pipe types from the library, input flow/length, and calculate total dynamic head. |
| **Stormwater Pump Station Design** | Wet-well sizing and duty pump selection per **AS/NZS 3500.3 Section 9**. Rainfall data for major Australian cities included. |
| **Hyetograph & Detention Routing** | Advanced rainfall-runoff modeling with IFD data from the Australian Bureau of Meteorology, time of concentration, hydrograph creation, and detention storage routing. |
| **Pump Curve Digitizer** | Upload pump curve images/PDFs and extract curve data using **Anthropic Claude AI** vision analysis. Export results to Excel. *(Admin only)* |

### 📚 Library Management

| Feature | Description |
| :------ | :---------- |
| **Pump Library** | Full CRUD for pump records — brand, model, kW, RPM, stages, impeller, curve data. CSV import/export. |
| **Pipe Library** | Manage pipe types and sizes (PVC, PE, Copper, etc.) with nominal size, internal diameter, and Hazen-Williams C factor. Global + user-specific entries. |

### 🏢 Company Website

Public landing page with product showcase, categories, blog, and contact information.

### 🔐 Authentication & Administration

- **Supabase Auth** — sign-up, sign-in, password reset
- **Admin Console** — user management, usage statistics, private pump/pipe oversight

## Tech Stack

### Frontend
| Technology | Purpose |
| :--------- | :------ |
| [Next.js 15](https://nextjs.org/) (App Router) | Framework (React 19, Turbopack) |
| [TypeScript](https://www.typescriptlang.org/) | Language |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |
| [shadcn/ui](https://ui.shadcn.com/) (Radix Primitives) | UI components |
| [Framer Motion](https://www.framer.com/motion/) | Animations |
| [Recharts](https://recharts.org/) / [Chart.js](https://www.chartjs.org/) | Charting |
| [TanStack Table](https://tanstack.com/table) | Data tables |
| [react-hook-form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Form validation |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management |
| [nuqs](https://nuqs.47ng.com/) | Search params state management |
| [kbar](https://kbar.vercel.app/) | Command palette |
| [jspdf](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) | PDF export |
| [xlsx (SheetJS)](https://sheetjs.com/) | Excel export |
| [Papaparse](https://www.papaparse.com/) | CSV parsing |

### Backend / Infrastructure
| Technology | Purpose |
| :--------- | :------ |
| [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) | Backend endpoints |
| [Supabase](https://supabase.com/) | Database (PostgreSQL), Authentication, Storage |
| [Anthropic Claude](https://www.anthropic.com/) | AI vision API for pump curve extraction |
| [pnpm](https://pnpm.io/) | Package manager |
| [Husky](https://typicode.github.io/husky/) | Pre-commit hooks |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) | Code quality |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- [pnpm](https://pnpm.io/installation)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/quality-pumps.git
cd quality-pumps

# Install dependencies
pnpm install

# Set up environment variables
cp env.example.txt .env.local
```

### Environment Variables

Fill in your `.env.local` with the required values:

| Variable | Description |
| :------- | :---------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key *(legacy)* |
| `CLERK_SECRET_KEY` | Clerk secret key *(legacy)* |
| `ANTHROPIC_API_KEY` | Anthropic API key for pump curve digitizer |

### Run the development server

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Seed admin user

```bash
pnpm run seed:admin
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (sign-in, sign-up, etc.)
│   ├── dashboard/          # Dashboard routes (all engineering tools)
│   ├── api/                # API route handlers
│   └── page.tsx            # Landing page
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui primitives
│   └── layout/             # Layout components (sidebar, header)
├── features/               # Feature-based modules
│   ├── pumps/              # Pump library CRUD
│   ├── pipes/              # Pipe library CRUD
│   ├── pump-curve/         # Pump curve generator
│   ├── npsh-curve/         # NPSH curve analyzer
│   ├── friction-loss-calc/ # Friction loss calculator
│   ├── rainwater-runoff/   # Stormwater & detention routing tools
│   ├── pump-curve-digitizer/ # AI curve extraction
│   ├── admin/              # Admin console
│   └── auth/               # Auth UI components
├── lib/                    # Utilities and configurations
│   ├── supabase/           # Supabase client (server & browser)
│   └── contexts/           # React contexts (auth, etc.)
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── data/                   # Static data (rainfall IFD data, etc.)
├── config/                 # App configuration
├── constants/              # Constants and mock data
└── types/                  # TypeScript type definitions
```

## License

[MIT](LICENSE)

# CLAUDE.md


## Project Overview

**claude-api-pjt** is a smart refrigerator management system that helps users track contents, expiration dates, and suggest recipes based on available ingredients. The system integrates hardware sensors with a backend API and web/mobile frontend.

## Common Commands

### Development Setup
```bash
npm install          # Install dependencies
npm run dev          # Start development server(s)
npm run build        # Build for production
```

### Testing
```bash
npm test             # Run all tests
npm test -- --watch # Run tests in watch mode
npm test -- <file>  # Run specific test file
```

### Linting & Code Quality
```bash
npm run lint         # Run linter
npm run lint:fix     # Fix linting issues
npm run format       # Format code
```

### Database
```bash
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data
npm run db:reset     # Reset database (dev only)
```

## Architecture Overview

The project is structured as a **full-stack monorepo** with the following main layers:

### Backend (`/server` or `/api`)
- **Node.js/Express** API server
- RESTful endpoints for fridge inventory management
- Database integration (supabase)

### Frontend (`/client` or `/web`)
- Web dashboard for users to manage fridge contents
- Real-time inventory tracking UI
- Recipe suggestion interface
- Responsive design for desktop and tablet

### Hardware Integration (`/hardware` or `/firmware`)
- Sensor communication (temperature, door sensors, etc.)
- MQTT or HTTP client for data transmission
- Configuration for different fridge models

### Database
- Schema for storing: users, fridge contents, expiration dates, recipes
- Migrations for schema updates

## Key Workflows

**Adding a new inventory item:**
1. User inputs item via web UI
2. Frontend POSTs to `/api/inventory`
3. Backend validates and stores in database
4. Frontend receives confirmation and updates local state

**Sensor data flow:**
1. Hardware device sends sensor readings (temperature, door open/close)
2. Backend receives data at `/api/sensors`
3. Alerts triggered if temperature drops below threshold
4. Frontend displays real-time sensor status

## Environment Setup

### OpenRouter API Configuration
1. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development:
   ```bash
   npm run dev
   ```

**Important**: `.env` is in `.gitignore` and should never be committed.

## Development Notes

- **Environment variables**: Configuration lives in `.env` (not committed) and is validated at startup via `config.js`
- **API Keys**: Never log or expose API keys; use `config.validateEnv()` to ensure keys are present
- **Database**: Use migrations for all schema changes; avoid manual SQL
- **API changes**: Update both backend and frontend when API contract changes
- **Testing**: Test API endpoints with realistic sensor data payloads

# Immich Mobile Web

A lightweight, mobile-first web client for [Immich](https://immich.app/) — the self-hosted photo and video backup solution.

Built with Preact and Vite, this app provides a fast, responsive interface for browsing your photo library, albums, and people.

## Features

- **Timeline View** — Browse your photos chronologically
- **Albums** — View and navigate your photo albums
- **People** — Browse photos organized by recognized faces
- **API Key Authentication** — Secure access to your Immich server

## Prerequisites

- Node.js 20+
- An Immich server instance
- An Immich API key (generate one from your Immich settings)

## Development

### Environment Setup

Create a `.env` file in the project root:

```env
IMMICH_API_URL=http://your-immich-server:2283
```

### Running the Dev Server

```bash
npm install
npm run dev
```

The app will be available at http://localhost:5173/

### Other Commands

- `npm run build` — Build for production, emitting to `dist/`
- `npm run preview` — Preview the production build locally
- `npm run lint` — Run Biome linter
- `npm run format` — Format code with Biome
- `npm run check` — Run Biome checks and apply fixes

## Docker Compose

### Environment Setup

Create a `.env` file in the project root:

```env
PORT=3000
IMMICH_API_URL=http://your-immich-server:2283
```

### Running with Docker Compose

```bash
docker compose up -d
```

The app will be available at http://localhost:3000/ (or whatever port you configured).

### Stopping the Container

```bash
docker compose down
```

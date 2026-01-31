# Visualizator

<img src="https://uptime.mapasmn.com/api/badge/8/status?style=flat-square" /> <img src="https://uptime.mapasmn.com/api/badge/8/uptime?style=flat-square" /> <img src="https://uptime.mapasmn.com/api/badge/8/ping?style=flat-square" />

Visualizator is a web application built with Angular for visualizing interactive maps with support for multiple layers, tile providers, and satellite imagery. It features a Dockerized development environment with hot-reload capabilities.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.1.

## Development server

To start a local development server in a Dockerized environment with hot-reload, run:

```bash
make up
```

This command builds and starts the application in a Docker container, providing an isolated environment with automatic reloading whenever you modify any of the source files. Once the server is running, open your browser and navigate to `http://localhost:4200/`.

## Docker Operations

The project uses Makefile commands for Docker-based operations:

- `make up`: Start the development environment in Docker with hot-reload.
- `make down`: Stop and clean up the development containers.
- `make prod`: Build and run the production version in Docker.

## Environment Setup

To configure environment variables, copy the example file:

```bash
cp .env.example .env
```

Edit the `.env` file to set your desired configuration values.

## Documentation System

This project includes an integrated documentation viewer located at `/docs`. It uses `ngx-markdown` to render Markdown files from the `public/docs` directory.

### How to Add New Documents

1.  **Create the Markdown File**:
    Add your `.md` file to the `public/docs/` directory.
    Example: `public/docs/my-new-feature.md`

2.  **Register the Topic**:
    Open `src/app/pages/docs/docs.component.ts` and add a new entry to the `topics` array:

    ```typescript
    topics = [
      { id: 'intro', title: 'Introduction' },
      { id: 'my-new-feature', title: 'My New Feature' }, // ID must match filename
    ];
    ```

    The `id` corresponds to the filename without the extension. The `title` is what appears in the sidebar navigation.

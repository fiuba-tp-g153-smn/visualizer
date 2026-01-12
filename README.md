# Visualizator++++++

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

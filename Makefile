# Makefile for Docker operations

IMAGE_NAME = visualizer
CONTAINER_NAME = visualizer-container
DEV_CONTAINER_NAME = visualizer-dev-container

.PHONY: build stop clean up down dev

up:
	docker compose -f docker-compose-dev.yml up --build

down:
	docker compose down
	docker compose -f docker-compose-dev.yml down --remove-orphans

prod:
	docker compose up --build

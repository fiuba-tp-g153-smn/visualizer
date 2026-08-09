# Makefile for Docker operations

IMAGE_NAME = visualizer
CONTAINER_NAME = visualizer-container
DEV_CONTAINER_NAME = visualizer-dev-container

# Docs toolchain. Pinned: the site is built by this image and by the `docs`
# stage of the app Dockerfile, and both must produce the same output.
DOCS_IMAGE = squidfunk/mkdocs-material:9.7.7
# --user keeps the bind-mounted output owned by the caller instead of root.
# NO_MKDOCS_2_WARNING silences Material's informational MkDocs 2.0 advisory;
# the pinned image is on mkdocs 1.6, so it does not apply to us.
DOCS_RUN = docker run --rm --user "$$(id -u):$$(id -g)" \
	-e NO_MKDOCS_2_WARNING=1 -v "$$PWD":/docs $(DOCS_IMAGE)

.PHONY: build stop clean up down dev prod docs docs-serve

# Build the documentation into public/docs-site (gitignored). Angular copies
# public/ verbatim, so this is all that is needed for `npm start` to serve
# /docs. --strict fails the build on a broken link.
docs:
	$(DOCS_RUN) build --strict

# Live-reloading docs preview on http://localhost:8000 for while you write.
docs-serve:
	docker run --rm -it --user "$$(id -u):$$(id -g)" -v "$$PWD":/docs \
		-p 8000:8000 $(DOCS_IMAGE)

up:
	DOCS_UID=$$(id -u) DOCS_GID=$$(id -g) \
		docker compose -f docker-compose-dev.yml up --build

down:
	docker compose down --remove-orphans
	docker compose -f docker-compose-dev.yml down --remove-orphans

prod:
	docker compose up --build

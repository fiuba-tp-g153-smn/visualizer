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

.PHONY: build stop clean up down dev prod docs docs-serve diagrams

# Build the documentation into public/docs-site (gitignored). Angular copies
# public/ verbatim, so this is all that is needed for `npm start` to serve
# /docs. --strict fails the build on a broken link.
docs:
	$(DOCS_RUN) build --strict

# Architecture diagrams. The SVGs under docs/imgs/ are committed artefacts, so
# `docs` deliberately does NOT depend on this target: d2 is not installed in CI
# nor in the Dockerfile `docs` stage, and adding a Go toolchain to a docs build
# buys nothing. Re-run this by hand after editing a .d2 source.
# Output lands under docs/imgs/ so hooks/media_cache_busting.py stamps it and
# nginx can keep serving that tree as immutable.
DIAGRAMS_SRC := $(wildcard diagrams/*.d2)
DIAGRAMS_OUT := $(patsubst diagrams/%.d2,docs/imgs/diagrams/%.svg,$(filter-out diagrams/_%.d2,$(DIAGRAMS_SRC)))

diagrams: $(DIAGRAMS_OUT)

docs/imgs/diagrams/%.svg: diagrams/%.d2 diagrams/_style.d2
	@mkdir -p $(@D)
	d2 --layout elk --pad 20 $< $@

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

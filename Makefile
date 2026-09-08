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

.PHONY: build stop clean up down dev prod docs docs-serve docs-check docs-media diagrams

# Build the documentation into public/docs-site (gitignored). Angular copies
# public/ verbatim, so this is all that is needed for `npm start` to serve
# /docs. --strict fails the build on a broken link.
docs:
	$(DOCS_RUN) build --strict

# The checks `mkdocs build --strict` cannot do. --strict only validates
# Markdown-syntax links: a page missing from nav, a broken in-page #anchor and
# a broken raw-HTML src= (the <video> clips) all build green.
#   docs-nav-check.py  reads mkdocs.yml + docs/: every page in nav exactly once,
#                      depth <= 3, and the chapter number identical in the nav
#                      label, the frontmatter title and the H1, with no gaps.
#   docs-check.py      serves public/ on a local http.server, walks every
#                      href/src/poster from /docs-site/, and fails on any
#                      non-200, any URL that escapes the mount, any #fragment
#                      with no matching id, and any page the crawl never reached.
docs-check: docs
	python3 scripts/docs-nav-check.py mkdocs.yml
	python3 scripts/docs-check.py public /docs-site

# Architecture diagrams. Each diagrams/<name>.diagram.yaml is hand-placed
# source; the compiled docs/imgs/diagrams/<name>.svg (embedded in pages) and
# <name>.png (2x raster for the report) are committed artefacts, so `docs`
# deliberately does NOT depend on this target and CI never runs it. The
# toolchain is the `diagram` skill's own scripts (~/.claude/skills/diagram),
# which are plain Python with an optional PyYAML dependency. Re-run by hand
# after editing a source; the build must leave no diff under docs/imgs/diagrams.
# Output lands under docs/imgs/ so hooks/media_cache_busting.py stamps it and
# nginx can keep serving that tree as immutable.
DIAGRAM_TOOLS ?= $(HOME)/.claude/skills/diagram/scripts
DIAGRAMS_SRC := $(wildcard diagrams/*.diagram.yaml)
DIAGRAMS_OUT := $(patsubst diagrams/%.diagram.yaml,docs/imgs/diagrams/%.svg,$(DIAGRAMS_SRC))

diagrams: $(DIAGRAMS_OUT)

docs/imgs/diagrams/%.svg: diagrams/%.diagram.yaml
	@mkdir -p $(@D)
	python3 $(DIAGRAM_TOOLS)/compile.py $< $@
	python3 $(DIAGRAM_TOOLS)/check_svg.py $@
	bash $(DIAGRAM_TOOLS)/export_png.sh $@ $(@:.svg=.png)

# Re-capture the manual's screenshots and clips. Needs a browser and a reachable
# data-service, so it is committed output, never a build step. Run by hand.
# See scripts/docs-media/README.md for the backends a run points at.
docs-media:
	npx tsx scripts/docs-media/capture.ts

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

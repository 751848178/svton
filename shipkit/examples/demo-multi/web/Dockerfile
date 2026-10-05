# Multi-stage example: `--target prod` (from ship.yaml) selects the final stage.
FROM httpd:alpine AS dev
WORKDIR /usr/local/apache2/htdocs
COPY index.html .

FROM httpd:alpine AS prod
WORKDIR /usr/local/apache2/htdocs
COPY index.html .
COPY built-marker.txt .
EXPOSE 80

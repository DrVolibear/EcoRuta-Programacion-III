#!/usr/bin/env bash
# Convierte docs/MANUAL_DE_USUARIO.md en .docx (Times New Roman 12, A4) y .pdf. Requiere pandoc, python-docx y LibreOffice.
# Uso: construir_manual.sh <carpeta-del-proyecto> <carpeta-de-trabajo>
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "${1:?carpeta del proyecto}" && pwd)"; TMP="${2:-/tmp/build}"
mkdir -p "$TMP"; cd "$TMP"
python3 "$AQUI/construir_manual.py" "$RAIZ" "$TMP"

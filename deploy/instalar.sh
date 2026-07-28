#!/usr/bin/env bash
# Instala (o reinstala) miniPDF v2 como servicio de usuario de systemd, para
# que quede arriba al cerrar la sesión y se levante solo al reiniciar el equipo.
#
#   bash deploy/instalar.sh
#
# No requiere sudo: usa systemd --user, que ya tiene `linger` habilitado para
# este usuario (eso es lo que permite que el servicio corra sin sesión abierta).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIDAD="$HOME/.config/systemd/user/minipdf.service"

echo "==> Compilando el frontend"
cd "$RAIZ/frontend"
npm run build

echo "==> Instalando la unidad de systemd"
mkdir -p "$(dirname "$UNIDAD")"
cp "$RAIZ/deploy/minipdf.service" "$UNIDAD"

systemctl --user daemon-reload
systemctl --user enable minipdf.service
systemctl --user restart minipdf.service

echo "==> Esperando a que responda"
for _ in $(seq 1 20); do
  if curl -sf --max-time 2 http://127.0.0.1:8000/api/health > /dev/null; then
    IP="$(hostname -I | awk '{print $1}')"
    echo
    echo "miniPDF v2 arriba en:"
    echo "   http://${IP}:8000     (esta es la dirección para los compañeros)"
    echo "   http://localhost:8000"
    echo
    echo "Comandos útiles:"
    echo "   systemctl --user status minipdf     # cómo va"
    echo "   systemctl --user restart minipdf    # reiniciar"
    echo "   tail -f $RAIZ/deploy/minipdf.log    # registro"
    exit 0
  fi
  sleep 1
done

echo "El servicio no respondió a tiempo. Revisa:" >&2
echo "   systemctl --user status minipdf" >&2
echo "   tail -50 $RAIZ/deploy/minipdf.log" >&2
exit 1

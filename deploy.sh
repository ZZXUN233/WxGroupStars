#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

API_PORT="${API_PORT:-3000}"
STATIC_DIR="${STATIC_DIR:-/var/www/group-stars}"

if command -v docker >/dev/null 2>&1; then
  DOCKER=(docker)
elif command -v wsl.exe >/dev/null 2>&1; then
  DOCKER=(wsl.exe docker)
else
  printf '未找到 docker 或 wsl.exe，请在已安装 Docker 的 WSL 中运行。\n' >&2
  exit 1
fi

compose() {
  "${DOCKER[@]}" compose -f docker-compose.yml "$@"
}

usage() {
  printf '用法: %s {build|start|stop|restart|status|logs|frontend|install-frontend|health}\n' "$0"
}

case "${1:-}" in
  build)
    compose build group-stars-api
    ;;
  start)
    compose up -d group-stars-api
    ;;
  stop)
    compose down
    ;;
  restart)
    compose up -d --force-recreate group-stars-api
    ;;
  status)
    compose ps
    ;;
  logs)
    compose logs -f --tail=100 group-stars-api
    ;;
  frontend|frontend-h5)
    (cd frontend && npm run build:h5)
    mkdir -p "${STATIC_DIR}"
    cp -R frontend/dist/. "${STATIC_DIR}/"
    ;;
  frontend-weapp)
    (cd frontend && npm run build:weapp)
    printf '微信小程序产物已生成：frontend/dist，请使用微信开发者工具导入并上传。\n'
    ;;
  install-frontend)
    (cd frontend && npm ci)
    ;;
  health)
    curl --fail --silent --show-error "http://127.0.0.1:${API_PORT}/health"
    printf '\n'
    ;;
  *)
    usage
    exit 1
    ;;
esac
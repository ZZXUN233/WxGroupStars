#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-group-stars-api}"
REGISTRY="${REGISTRY:-zzxun.cn:5000}"
TAG="${1:-latest}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

if command -v docker >/dev/null 2>&1; then
  DOCKER=(docker)
elif command -v wsl.exe >/dev/null 2>&1; then
  DOCKER=(wsl.exe docker)
else
  printf '未找到 docker 或 wsl.exe，请在已安装 Docker 的 WSL 中运行。\n' >&2
  exit 1
fi

LOCAL_IMAGE="${IMAGE_NAME}:${TAG}"
REMOTE_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

printf '构建镜像 %s...\n' "${LOCAL_IMAGE}"
"${DOCKER[@]}" build -f backend/Dockerfile -t "${LOCAL_IMAGE}" backend

printf '标记镜像 %s...\n' "${REMOTE_IMAGE}"
"${DOCKER[@]}" tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE}"

printf '推送镜像 %s...\n' "${REMOTE_IMAGE}"
"${DOCKER[@]}" push "${REMOTE_IMAGE}"

printf '\n推送完成：%s\n' "${REMOTE_IMAGE}"
printf '远程服务器执行：docker pull %s\n' "${REMOTE_IMAGE}"
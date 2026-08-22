# 群星闪耀部署

## 构建与启动

1. 在服务器准备 `backend/.env`（可从 `backend/.env.example` 复制），不要把密钥提交到 Git。
2. 拉取远程私有镜像并启动 API：

```bash
docker login zzxun.cn:5000
docker compose pull group-stars-api
docker compose up -d group-stars-api
```

Compose 使用远程镜像 `zzxun.cn:5000/group-stars-api:latest`。服务器必须准备 `backend/.env`，其中数据库配置是必需项：

```env
DATABASE_URL="mysql://root:数据库密码@mysql-host:3306/wgs"
PORT=3000
```

API 宿主机端口默认为 `3007`，容器内部端口为 `3000`，与 Nginx 的 `127.0.0.1:3007` 反代配置一致；如需修改，可设置 `API_PORT`。

如果 MySQL 运行在同一台服务器，且 MySQL 监听宿主机 3306，可直接使用 `host.docker.internal`；Compose 已将其映射到 Docker 宿主机网关。数据库在独立服务器时，则将其替换为数据库服务器地址。

3. 构建 H5 并发布到 Nginx 静态目录。H5 与微信小程序是两个独立产物：

```bash
./deploy.sh install-frontend
./deploy.sh frontend-h5
```

H5 产物位于 `frontend/dist`，脚本会复制到 `/var/www/group-stars`。构建微信小程序：

```bash
./deploy.sh frontend-weapp
./deploy.sh pull
./deploy.sh start
```

微信小程序构建也会输出到 `frontend/dist`，请用微信开发者工具打开 `frontend` 项目并上传。当前小程序 API 地址为 `https://gs.zzxun.cn`，接口直接使用根路径（例如 `/auth/login`）；前端构建可用 `TARO_APP_BASE_URL` 覆盖 API 地址。

## Nginx

将 [nginx/group-stars.conf](nginx/group-stars.conf) 复制到 `/etc/nginx/sites-enabled/group-stars.conf`，按实际域名修改 `server_name` 和证书路径，然后执行：

```bash
nginx -t && nginx -s reload
```

当前配置仅部署微信小程序 API：`https://gs.zzxun.cn` 根路径直接反代到远程宿主机 `127.0.0.1:3007`，再转发到容器 `3000`。已移除 `/group-stars` 前缀；H5 入口暂不纳入此配置。

## 常用命令

```bash
./deploy_update.sh              # WSL Docker 构建并推送 latest 镜像
./deploy_update.sh v1.0.0       # 构建并推送指定版本
./deploy.sh frontend-h5
./deploy.sh frontend-weapp
./deploy.sh build
./deploy.sh start
./deploy.sh status
./deploy.sh logs
./deploy.sh health
./deploy.sh restart
./deploy.sh stop
```
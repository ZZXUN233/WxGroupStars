# 群星闪耀部署

## 构建与启动

1. 在服务器准备 `backend/.env`（可从 `backend/.env.example` 复制），不要把密钥提交到 Git。
2. 构建并启动 API：

```bash
docker compose build group-stars-api
docker compose up -d group-stars-api
```

3. 构建 H5 并发布到 Nginx 静态目录。H5 与微信小程序是两个独立产物：

```bash
./deploy.sh install-frontend
./deploy.sh frontend-h5
```

H5 产物位于 `frontend/dist`，脚本会复制到 `/var/www/group-stars`。构建微信小程序：

```bash
./deploy.sh frontend-weapp
```

微信小程序构建也会输出到 `frontend/dist`，请用微信开发者工具打开 `frontend` 项目并上传，不要将该目录作为 Nginx 站点。前端生产构建可用 `TARO_APP_BASE_URL=https://api.example.com/group-stars npm run build:h5` 覆盖 API 地址；默认值在 [http.ts](frontend/src/api/http.ts) 中配置。

## Nginx

将 [nginx/group-stars.conf](nginx/group-stars.conf) 复制到 `/etc/nginx/sites-enabled/group-stars.conf`，按实际域名修改 `server_name` 和证书路径，然后执行：

```bash
nginx -t && nginx -s reload
```

配置默认使用 `https://gs.zzxun.cn` 托管 H5，并使用 `https://api.zzxun.cn` 作为独立 API 子域名。API 子域名直接反代到容器，应用自身仍保留 `/group-stars` 全局前缀，因此前端地址为 `https://api.zzxun.cn/group-stars`；没有在 H5 站点下做路径代理。

## 常用命令

```bash
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
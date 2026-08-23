# Despliegue con Nginx + PM2

Esta carpeta contiene la configuración de referencia para exponer Theos
detrás de Nginx en un VPS, con el proceso Node administrado por PM2
(`ecosystem.config.cjs` en la raíz del repo).

## Archivos

- `nginx.conf` → `/etc/nginx/nginx.conf` (config principal, genérica)
- `theos.conf` → `/etc/nginx/sites-available/theos.conf` (server block del sitio)

## Pasos

```bash
# 1. Código y dependencias en el servidor
sudo mkdir -p /var/www/theos
sudo git clone <repo> /var/www/theos
cd /var/www/theos
cp .env.example .env   # y edita .env con tus API keys reales
npm install --omit=dev

# 2. Arranca el proceso Node con PM2
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# 3. Instala la config de Nginx
sudo cp deploy/nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp deploy/nginx/theos.conf /etc/nginx/sites-available/theos.conf
sudo ln -s /etc/nginx/sites-available/theos.conf /etc/nginx/sites-enabled/theos.conf
sudo rm -f /etc/nginx/sites-enabled/default   # si existe, para evitar choques de puerto/host

# 4. Edita theos.conf y reemplaza "theos.example.com" por tu dominio real,
#    luego obtén el certificado TLS
sudo certbot --nginx -d theos.example.com

# 5. Valida y recarga
sudo nginx -t
sudo systemctl reload nginx
```

## Por qué esta forma

- **Reverse proxy, no `root` estático**: `server.js` ya sirve `public/`
  con `express.static` y aplica sus propias cabeceras de seguridad
  (CSP, `X-Frame-Options`, etc.). Nginx solo reenvía todo el tráfico a
  `127.0.0.1:3000`; duplicar el servido de estáticos en Nginx añadiría
  una segunda fuente de verdad para las cabeceras de seguridad.
- **`proxy_buffering off` en `/api/chat`**: ese endpoint devuelve la
  respuesta del modelo de IA en streaming (SSE). Si Nginx almacena en
  búfer la respuesta antes de enviarla al cliente, el efecto de
  "escritura en vivo" se rompe y las respuestas largas pueden agotar
  el timeout por defecto.
- **`TRUST_PROXY=1` en `.env`**: con Nginx delante, Express debe
  confiar en la cabecera `X-Forwarded-For` que añade `proxy_set_header`
  para que el rate limiting (`RATE_LIMIT_MAX` en `server.js`) se aplique
  por IP real del cliente y no por la IP de Nginx.
- **Redirección HTTP → HTTPS + ACME challenge**: necesario para
  renovar certificados de Let's Encrypt vía `certbot --nginx` sin
  tumbar el sitio.

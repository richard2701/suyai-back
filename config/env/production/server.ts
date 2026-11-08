module.exports = ({ env }) => ({
  // Public API URL behind the Cloudflare proxy (https://api.transfersuyai.cl). The onrender.com
  // subdomain is disabled, so redirects such as "/" -> "/admin" must not use it. Falls back to
  // Render's own URL while PUBLIC_URL is not set.
  url: env("PUBLIC_URL", env("RENDER_EXTERNAL_URL")),
  proxy: { koa: true },
});

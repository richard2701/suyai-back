export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Trust X-Forwarded-* from Render's proxy so ctx.ip is the real client IP (per-IP rate limits).
  proxy: { koa: true },
  app: {
    keys: env.array('APP_KEYS'),
  },
});

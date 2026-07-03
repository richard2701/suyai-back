/**
 * feature-flag-token router
 *
 * All routes use `auth: false` so the Users & Permissions plugin does not gate
 * them. `validate` is genuinely public; `generate`, `find` and `update` are
 * gated inside the controller by an admin-JWT check.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/feature-flag-tokens/generate',
      handler: 'feature-flag-token.generate',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/feature-flag-tokens/validate',
      handler: 'feature-flag-token.validate',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/feature-flag-tokens',
      handler: 'feature-flag-token.find',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/feature-flag-tokens/:id',
      handler: 'feature-flag-token.update',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};

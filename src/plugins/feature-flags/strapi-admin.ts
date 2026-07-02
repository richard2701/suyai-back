/**
 * Feature Flags plugin — admin entry point.
 * Adds a "Feature Flags" link to the admin sidebar that renders the token
 * management page.
 */
import { Lightning } from '@strapi/icons';

const PLUGIN_ID = 'feature-flags';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: Lightning,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Feature Flags',
      },
      Component: () => import('./admin/src/pages/FeatureFlagsPage'),
      permissions: [],
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      name: 'Feature Flags',
    });
  },
  bootstrap() {},
};

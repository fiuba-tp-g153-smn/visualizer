import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Visualizer',
  tagline: 'Documentación del Sistema de Visualización Meteorológica',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },

  url: 'https://visualizer.example.com',
  baseUrl: '/',

  organizationName: 'fiuba-tp-g153-smn',
  projectName: 'visualizer',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  clientModules: ['./src/clientModules/notifyParent.ts'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      hideOnScroll: false,
      items: [],
    },
    footer: {
      style: 'light',
      copyright: `© ${new Date().getFullYear()} Visualizer - FIUBA`,
    },
    prism: {
      theme: prismThemes.github,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

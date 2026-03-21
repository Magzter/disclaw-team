import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/docs',
  integrations: [
    starlight({
      title: 'disclaw-team',
      description: 'Deploy multi-bot AI teams to Discord',
      logo: {
        light: './src/assets/logo.svg',
        dark: './src/assets/logo.svg',
      },
      customCss: ['./src/styles/custom.css'],
      social: {
        github: 'https://github.com/Magzter/disclaw-team',
      },
      components: {
        Head: './src/components/Head.astro',
      },
      sidebar: [
        {
          label: 'Introduction',
          link: '',
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'Discord Setup', link: 'getting-started/discord-setup' },
            { label: 'Prerequisites', link: 'getting-started/prerequisites' },
            { label: 'Installation', link: 'getting-started/installation' },
            { label: 'Quick Start', link: 'getting-started/quick-start' },
            { label: 'Your First Team', link: 'getting-started/your-first-team' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', link: 'cli/overview' },
            { label: 'init', link: 'cli/init' },
            { label: 'start', link: 'cli/start' },
            { label: 'stop', link: 'cli/stop' },
            { label: 'attach', link: 'cli/attach' },
            { label: 'status', link: 'cli/status' },
            { label: 'assign', link: 'cli/assign' },
            { label: 'roles', link: 'cli/roles' },
            { label: 'switch', link: 'cli/switch' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'bots.yaml', link: 'config/bots-yaml' },
            { label: 'assignment.yaml', link: 'config/assignment-yaml' },
            { label: 'Role Files', link: 'config/role-files' },
            { label: 'schedules.yaml', link: 'config/schedules-yaml' },
            { label: 'team.yaml (Legacy)', link: 'config/team-yaml' },
            { label: 'Environment Variables', link: 'config/env-vars' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'How It Works', link: 'concepts/how-it-works' },
            { label: 'Roles & Role Types', link: 'concepts/roles' },
            { label: 'Teams & Presets', link: 'concepts/teams' },
            { label: 'Protocol', link: 'concepts/protocol' },
            { label: 'Safe Mode', link: 'concepts/safe-mode' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Creating Custom Roles', link: 'guides/custom-roles' },
            { label: 'Using Team Presets', link: 'guides/team-presets' },
            { label: 'Switching Teams', link: 'guides/switching-teams' },
            { label: 'Scheduling Tasks', link: 'guides/scheduling' },
            { label: 'Using the Web Dashboard', link: 'guides/web-dashboard' },
            { label: 'Claude Code Plugin', link: 'guides/claude-plugin' },
          ],
        },
        {
          label: 'Troubleshooting',
          link: 'troubleshooting',
        },
      ],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
    }),
  ],
});

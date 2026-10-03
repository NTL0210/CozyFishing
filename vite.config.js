import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages:
  // - Local dev: uses '/'
  // - CI (GitHub Actions): GITHUB_REPOSITORY is auto-set to 'owner/repo'
  //   so we extract the repo name for the Pages base URL.
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
});

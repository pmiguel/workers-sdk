# Workers Playground Pages Project

This package contains the client side assets used in the Workers Playground available in the Cloudflare Dashboard at [https://workers.cloudflare.com/playground].

## Developing locally

> This is intended for internal Cloudflare developers. Currently, it's not possible to contribute to this package as an external contributor

- Ensure the rest of the team are aware you're working on the Workers Playground, as there's only one instance of the testing `playground-preview-worker`.

- Run `pnpm run dev` in the root of this package. That will start the local Vite server for the playground frontend, with API calls hitting the testing `playground-preview-worker`.

- To test changes to the playground preview worker, run `pnpm run deploy:testing` in `packages/playground-preview-worker` to deploy it to the test environment.

## Building

1. Run `pnpm -F workers-playground build`

This generates the files into the `dist` directory that can then be deployed to Cloudflare Pages.

## Deployment

Deployments are managed by the Github Action defined at .github/workflows/deploy-pages-projects.yaml.

This action runs on:

- every push to `main`. This will deploy the project to production, which can then be accessed via [https://workers-playground.pages.dev/].
- any PR that has the `preview:workers-playground` label. This will deploy a preview, which can then be accessed via [https://<SHA>.workers-playground.pages.dev/].

# Ember Restaurant

## Deploy the website and Node API

This project serves the website and JSON Server API from one Node.js web service. GitHub stores the source; it does not run the API. The included Render Blueprint is configured for the `development` branch.

1. Push the project and `render.yaml` to the GitHub `development` branch.
2. Create a free account at [render.com](https://render.com/), choose **New → Blueprint**, and connect this repository and the `development` branch.
3. When prompted, set `STAFF_USERNAME` and `STAFF_PASSWORD`.
4. Wait for the build and deploy to finish, then open the service URL Render provides. The menu, images, and `/api/menu-items` should all be served from that same URL. Share that public URL with your teacher.

The free instance may sleep when idle, so its first request afterward can take about a minute. It has no persistent disk: order changes are available while its instance is running, but may be lost after a restart or redeploy. The app and API are kept on one host so checkout, tracking, and staff requests use the same origin.

## Local checks

- `npm run dev` starts the site and API locally.
- `npm run build` creates the production site assets.
- `npm test` runs the test suite.
- `npm run test:coverage` checks JavaScript coverage (minimum 50%).

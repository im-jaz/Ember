import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            include: ['./app.js', './cart.js', './format.js', './validation.js', './api.js'],
            thresholds: {
                branches: 50,
                functions: 50,
                lines: 50,
                statements: 50,
            },
        },
    },
});

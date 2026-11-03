import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            include: ['site/assets/js/cart.js', 'site/assets/js/format.js', 'site/assets/js/validation.js'],
            thresholds: {
                branches: 50,
                functions: 50,
                lines: 50,
                statements: 50,
            },
        },
    },
});

import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/lib/cart.ts",
    "src/lib/payment.ts",
    "src/lib/money.ts",
    "src/lib/categories.tsx",
  ],
  coverageReporters: ["text", "text-summary", "html"],
};

export default createJestConfig(customConfig);

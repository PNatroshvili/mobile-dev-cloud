import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

const asConfigArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "default" in value) {
    return asConfigArray(value.default);
  }
  return [value];
};

export default defineConfig([
  ...asConfigArray(nextVitals),
  ...asConfigArray(nextTs),
  globalIgnores([".next/**", "node_modules/**"]),
]);

import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import hooksPlugin from "eslint-plugin-react-hooks";
import refreshPlugin from "eslint-plugin-react-refresh";

export default [
  { files: ["**/*.{js,mjs,cjs,jsx}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  {
    ...pluginReactConfig,
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    plugins: {
        'react-hooks': hooksPlugin,
        'react-refresh': refreshPlugin,
    },
    rules: {
        ...hooksPlugin.configs.recommended.rules,
        'react-refresh/only-export-components': 'warn',
    }
  }
];
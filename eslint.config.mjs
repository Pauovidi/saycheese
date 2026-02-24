import nextVitals from "eslint-config-next/core-web-vitals"

export default [
  ...nextVitals,
  {
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

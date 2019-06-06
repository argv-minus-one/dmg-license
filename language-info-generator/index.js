require("ts-node").register({project: require.resolve("./tsconfig.json")});
module.exports = require("./language-info-generator.ts");

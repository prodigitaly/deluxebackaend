const stripeKey =
  process.env.NODE_ENV === "production"
    ? "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"
    : "sk_test_51MGvznGi7bwABort1GkoMw0gP2OhxTaDTPgl0H49MNOxE2MSGB4PaQPbxhMBO7haNC3CfVnIEQlr1VxxXTNCl64f000JIV2KNx";

module.exports = require("stripe")(stripeKey);

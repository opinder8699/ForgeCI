const crypto = require("crypto");

function verifyGithubSignature(rawBody, signature) {
  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        process.env.GITHUB_WEBHOOK_SECRET
      )
      .update(rawBody)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

module.exports = verifyGithubSignature;
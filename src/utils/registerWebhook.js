const axios = require("axios");
const extractRepoInfo = require("./extractRepoInfo");

async function registerWebhook(
  repoUrl,
  accessToken
) {
  const { owner, repo } =
    extractRepoInfo(repoUrl);

  const response = await axios.post(
    `https://api.github.com/repos/${owner}/${repo}/hooks`,
    {
      name: "web",
      active: true,
      events: ["push"],
      config: {
        url: process.env.WEBHOOK_URL,
        content_type: "json",
        secret: process.env.GITHUB_WEBHOOK_SECRET,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return response.data.id;
}

module.exports = registerWebhook;
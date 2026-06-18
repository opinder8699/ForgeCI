const axios = require("axios");
const extractRepoInfo = require("./extractRepoInfo");

async function deleteWebhook(
  repoUrl,
  accessToken,
  webhookId
) {
  const { owner, repo } =
    extractRepoInfo(repoUrl);

  await axios.delete(
    `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );
}

module.exports = deleteWebhook;
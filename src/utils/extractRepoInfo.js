function extractRepoInfo(repoUrl) {
  const url = new URL(repoUrl);

  const pathParts = url.pathname
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);

  return {
    owner: pathParts[0],
    repo: pathParts[1],
  };
}
module.exports = extractRepoInfo;
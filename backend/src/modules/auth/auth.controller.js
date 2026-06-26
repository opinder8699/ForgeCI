const axios = require("axios");
const jwt = require("jsonwebtoken");
const prisma = require("../../lib/prisma");
const { encrypt } = require("../../utils/encryption");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const githubLogin = async (req, res) => {
  const githubUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&scope=user:email%20repo%20admin:repo_hook`;

  res.redirect(githubUrl);
};

const githubCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/?error=missing_code`);
    }

    // Exchange code for GitHub access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.redirect(`${FRONTEND_URL}/?error=oauth_failed`);
    }

    const encryptedToken = encrypt(accessToken);

    // Fetch GitHub user profile
    const githubUserResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = githubUserResponse.data;

    // Fetch primary email (not always in the profile)
    const emailResponse = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const primaryEmail = emailResponse.data.find((e) => e.primary);

    if (!primaryEmail) {
      return res.redirect(`${FRONTEND_URL}/?error=no_email`);
    }

    // Upsert user in DB
    const user = await prisma.user.upsert({
      where: { email: primaryEmail.email },
      update: {
        githubAccessToken: encryptedToken,
        githubUsername: githubUser.login,
        username: githubUser.login,
      },
      create: {
        username: githubUser.login,
        email: primaryEmail.email,
        githubUsername: githubUser.login,
        githubAccessToken: encryptedToken,
      },
    });

    // Sign a JWT and set it as an httpOnly cookie
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect browser back into the React app — AuthContext will call /me and pick up the session
    return res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("GitHub OAuth error:", error.response?.data || error.message);
    return res.redirect(`${FRONTEND_URL}/?error=server_error`);
  }
};

const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      username: true,
      email: true,
      githubUsername: true,
    },
  });
  return res.json({ user });
}; 

const logout = async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  });
  return res.json({ message: "Logged out" });
};

module.exports = { githubLogin, githubCallback, me, logout };

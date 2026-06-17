const axios = require("axios");
const jwt = require("jsonwebtoken");
const prisma = require("../../lib/prisma");
const { encrypt } = require("../../utils/encryption");

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
      return res.status(400).json({
        message: "Authorization code missing",
      });
    }

    // token exchange

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,

        client_secret: process.env.GITHUB_CLIENT_SECRET,

        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const accessToken = tokenResponse.data.access_token;

    const encryptedToken = encrypt(accessToken);

    // github user

    const githubUserResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const githubUser = githubUserResponse.data;

    // email

    const emailResponse = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const primaryEmail = emailResponse.data.find((email) => email.primary);

    if (!primaryEmail) {
      return res.status(400).json({
        message: "No primary email found",
      });
    }

    const user = await prisma.user.upsert({
      where: {
        email: primaryEmail.email,
      },

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

    const token = jwt.sign(
      {
        userId: user.id,

        email: user.email,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      },
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      githubUsername: user.githubUsername,
    };
    return res.json({
      user: safeUser,
    });
  } catch (error) {
    console.error(error.response?.data || error.message || error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
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
    sameSite: "strict",
  });

  return res.json({
    message: "Logged out",
  });
};

module.exports = {
  githubLogin,
  githubCallback,
  me,
  logout,
};

import jwt from 'jsonwebtoken';

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m', // Short-lived for security (refresh token handles persistence)
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d', // Extended from 7d to 30d for persistent login
  });
};

export { generateAccessToken, generateRefreshToken };

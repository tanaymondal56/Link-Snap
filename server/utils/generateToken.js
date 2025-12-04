import jwt from 'jsonwebtoken';

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '1h', // Extended from 15m to 1h for better UX
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d', // Extended from 7d to 30d for persistent login
  });
};

export { generateAccessToken, generateRefreshToken };

import jwt from 'jsonwebtoken';

const generateAccessToken = (userId, role = 'user') => {
  if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not defined');
  return jwt.sign({ id: userId, role, type: role === 'master_admin' ? 'master' : 'user' }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m', 
  });
};

const generateRefreshToken = (userId, role = 'user') => {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not defined');
  return jwt.sign({ id: userId, role, type: role === 'master_admin' ? 'master' : 'user' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });
};

export { generateAccessToken, generateRefreshToken };

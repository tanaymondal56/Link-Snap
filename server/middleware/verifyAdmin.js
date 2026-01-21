// eslint-disable-next-line no-unused-vars -- Kept for potential future use in role lookup
import User from '../models/User.js';
import logger from '../utils/logger.js';

export const verifyAdmin = async (req, res, next) => {
    try {
        // Separate authentication check from authorization check
        if (!req.user) {
            logger.warn('Admin access attempt without authentication');
            return res.status(401).json({ message: 'Authentication required.' });
        }
        
        if (req.user.role !== 'admin') {
            logger.warn(`Unauthorized admin access attempt by user: ${req.user._id}`);
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }
        
        next();
    } catch (error) {
        logger.error(`Error in verifyAdmin middleware: ${error.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

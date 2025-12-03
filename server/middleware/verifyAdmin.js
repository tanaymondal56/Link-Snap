import User from '../models/User.js';

export const verifyAdmin = async (req, res, next) => {
    try {
        // req.user is already populated by verifyToken middleware
        const user = await User.findById(req.user._id || req.user.id);

        console.log(`[VerifyAdmin] User: ${user?.email}, Role: ${user?.role}, WhitelistedIP: ${req.isWhitelistedIP}`);

        // Allow ONLY if user is admin
        // Note: IP whitelist is handled by previous middleware, but we must not bypass role check
        if (user && user.role === 'admin') {
            next();
        } else {
            // Return 404 to hide the existence of admin routes
            res.status(404).json({ message: 'Not Found' });
        }
    } catch (error) {
        // Return 404 to hide the existence of admin routes
        res.status(404).json({ message: 'Not Found' });
    }
};

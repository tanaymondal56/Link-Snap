// eslint-disable-next-line no-unused-vars -- Kept for potential future use in role lookup
import User from '../models/User.js';

export const verifyAdmin = async (req, res, next) => {
    try {
        // req.user is already populated by verifyToken middleware (which handles both User and MasterAdmin)
        const user = req.user;

        console.log(`[VerifyAdmin] User: ${user?.email}, Role: ${user?.role}, WhitelistedIP: ${req.isWhitelistedIP}`);

        // Allow if user is admin or master_admin
        if (user && (user.role === 'admin' || user.role === 'master_admin')) {
            next();
        } else {
            // Return 404 to hide the existence of admin routes
            res.status(404).json({ message: 'Not Found' });
        }
    } catch {
        // Return 404 to hide the existence of admin routes
        res.status(404).json({ message: 'Not Found' });
    }
};

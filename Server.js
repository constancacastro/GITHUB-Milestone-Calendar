import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { newEnforcer } from 'casbin';
import router from './Routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'your-secret-key';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Casbin enforcer
async function initEnforcer() {
    return await newEnforcer(
        join(__dirname, 'casbin.conf'),
        join(__dirname, 'policy.csv')
    );
}

// List of paths that don't require authentication
const publicPaths = [
    '/',
    '/auth/google',
    '/auth/google/callback',
    '/static'
];

const isPublicPath = (path) => {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    return publicPaths.some(publicPath => {
        const normalizedPublicPath = publicPath.endsWith('/') ? publicPath.slice(0, -1) : publicPath;
        return normalizedPath === normalizedPublicPath || 
               normalizedPath.startsWith(normalizedPublicPath + '/');
    }) || normalizedPath.startsWith('/static/');
};

// Authentication middleware
const authMiddleware = (req, res, next) => {
    if (isPublicPath(req.path)) {
        return next();
    }

    // Check for authenticated session
    if (!req.session.userInfo) {
        console.log('Authentication required for path:', req.path);
        return res.status(401).json({ 
            error: 'Authentication required',
            details: 'Please log in to access this resource'
        });
    }

    // Ensure role is assigned
    if (!req.session.role) {
        req.session.role = 'free';
    }

    next();
};

// Initialize server with authorization
initEnforcer().then(enforcer => {

    app.use(express.static('public'));
    app.use(authMiddleware);

    // Authorization middleware
    app.use(async (req, res, next) => {
        // Skip authorization for public paths
        if (isPublicPath(req.path)) {
            return next();
        }

        try {
            const role = req.session.role || '*';
            const path = req.path.substring(1);
            const action = req.method.toLowerCase();

            const allowed = await enforcer.enforce(role, path, action);

            // Log authorization attempt
            console.log('Authorization check:', {
                role,
                resource: path,
                action,
                allowed,
                fullPath: req.path
            });

            if (!allowed) {
                return res.status(403).json({
                    error: 'Access denied',
                    details: {
                        role,
                        resource: path,
                        action,
                        path: req.path
                    }
                });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({
                error: 'Authorization check failed',
                details: error.message
            });
        }
    });

    app.use('/', router);

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    });
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Public paths:`, publicPaths);
    });
}).catch(error => {
    console.error('Failed to initialize Casbin enforcer:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    process.exit(1);
});
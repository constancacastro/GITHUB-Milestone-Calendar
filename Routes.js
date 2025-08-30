import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { googleAuth, googleCallback } from './OAuth.js';
import { githubAuth, githubCallback } from './GitHubAuth.js';
import { getMilestones } from './GitHub.js';
import { createCalendarEvent } from './Calendar.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Google Auth routes
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleCallback);

// GitHub Auth routes
router.get('/auth/github', githubAuth);
router.get('/auth/github/callback', githubCallback);

// Dashboard route
router.get('/dashboard', (req, res) => {
    if (!req.session.userInfo) {
        return res.redirect('/');
    }
    res.sendFile(join(__dirname, 'public', 'dashboard.html'));
});

// API route for user data
router.get('/api/user', (req, res) => {
    if (!req.session.userInfo) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({
        user: req.session.userInfo,
        role: req.session.role,
        githubAuthenticated: !!req.session.githubToken
    });
});

router.get('/github/test', async (req, res) => {
    const githubToken = req.session.githubToken;
    
    if (!githubToken) {
        return res.status(401).json({ error: 'No GitHub token found' });
    }

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/json',
                'User-Agent': 'GitHub-Milestone-Calendar'
            }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        res.json({ status: 'ok' });
    } catch (error) {
        req.session.githubToken = null;
        req.session.githubUser = null;
        res.status(401).json({ error: 'Invalid GitHub token' });
    }
});

router.get('/github/:repoOwner/:repoName/milestones', getMilestones);
router.post('/calendar/event', (req, res, next) => {
    // Log the current role and request for debugging
    console.log('Calendar request from user:', {
        role: req.session.role,
        email: req.session.userInfo?.email
    });

    // Check if user has premium or admin role
    if (req.session.role === 'free') {
        return res.status(403).json({
            error: 'Access denied',
            details: 'Calendar event creation requires a premium or admin account',
            currentRole: req.session.role
        });
    }

    return createCalendarEvent(req, res);
});
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Test route for github auth
router.get('/github/test-auth', async (req, res) => {
    const token = req.session.githubToken;
    if (!token) {
        return res.status(401).json({ error: 'No GitHub token found' });
    }
    
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitHub-Milestone-Calendar'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }
        
        const data = await response.json();
        res.json({ 
            authenticated: true, 
            username: data.login 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'GitHub authentication test failed',
            details: error.message 
        });
    }
});

export default router;
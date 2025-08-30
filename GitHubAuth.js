import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

export const githubAuth = (req, res) => {
    // Clear any existing GitHub data from session
    delete req.session.githubToken;
    delete req.session.githubUser;
    
    const state = Math.random().toString(36).substring(7);
    req.session.githubState = state;

    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: 'repo',
        state: state,
        allow_signup: 'true',
        prompt: 'consent' // Force consent screen
    });
    
    // Force new authorization by clearing session and redirecting
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

export const githubCallback = async (req, res) => {
    const { code, state } = req.query;
    
    if (!code || state !== req.session.githubState) {
        return res.redirect('/dashboard?error=Invalid authorization response');
    }
    
    try {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error || !tokenData.access_token) {
            throw new Error(tokenData.error_description || 'Failed to get access token');
        }

        // Verify token by making a test API call
        const testResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${tokenData.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'GitHub-Milestone-Calendar'
            }
        });

        if (!testResponse.ok) {
            throw new Error('Invalid GitHub token');
        }

        const userData = await testResponse.json();
        
        // Store verified token and user data
        req.session.githubToken = tokenData.access_token;
        req.session.githubUser = userData;
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('GitHub Authentication error:', error);
        res.redirect('/dashboard?error=' + encodeURIComponent(error.message));
    }
};

export default {
    githubAuth,
    githubCallback
};
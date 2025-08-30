import fetch from 'node-fetch';
import { stringify } from 'querystring';
import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

export const googleAuth = (req, res) => {
    const params = stringify({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email https://www.googleapis.com/auth/calendar',
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent'
    });
    
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

export const googleCallback = async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        console.error('No authorization code received');
        return res.redirect('/?error=no_code');
    }
    
    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: stringify({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            throw new Error(error.error_description || 'Failed to exchange code for tokens');
        }

        const tokens = await tokenResponse.json();
        
        // Get user info
        const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Accept': 'application/json'
            }
        });

        if (!userInfoResponse.ok) {
            throw new Error('Failed to get user info');
        }

        const userInfo = await userInfoResponse.json();

        // Store tokens and user info in session
        req.session.tokens = tokens;
        req.session.userInfo = userInfo;
        req.session.role = userInfo.email.endsWith('@admin.com') ? 'admin' : 
                          userInfo.email.endsWith('@gmail.com') ? 'premium' : 'free';

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Google authentication error:', error);
        res.redirect('/?error=auth_failed');
    }
};

export const refreshGoogleToken = async (refreshToken) => {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        return await response.json();
    } catch (error) {
        console.error('Token refresh error:', error);
        throw error;
    }
};

export default {
    googleAuth,
    googleCallback,
    refreshGoogleToken
};
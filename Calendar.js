import fetch from 'node-fetch';

export async function createCalendarEvent(req, res) {
    // Check for valid session and tokens
    if (!req.session?.tokens?.access_token) {
        console.error('No Google access token found in session');
        return res.status(401).json({
            error: 'Google authentication required',
            details: 'Please authenticate with Google to add calendar events',
            action: 'REAUTH_GOOGLE'
        });
    }

    const { milestone } = req.body;
    
    if (!milestone || !milestone.due_on) {
        return res.status(400).json({
            error: 'Invalid milestone data',
            details: 'Milestone must have a due date'
        });
    }

    try {
        const dueDate = new Date(milestone.due_on);
        const endDate = new Date(dueDate.getTime() + (60 * 60 * 1000)); // Add 1 hour

        const event = {
            summary: milestone.title,
            description: milestone.description || 'GitHub Milestone',
            start: {
                dateTime: dueDate.toISOString(),
                timeZone: 'UTC'
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'UTC'
            }
        };

        console.log('Creating calendar event:', {
            event,
            hasToken: !!req.session?.tokens?.access_token
        });

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${req.session.tokens.access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Google Calendar API error:', errorData);

            if (response.status === 401) {
                return res.status(401).json({
                    error: 'Google authentication expired',
                    details: 'Please re-authenticate with Google',
                    action: 'REAUTH_GOOGLE'
                });
            }

            throw new Error(errorData.error?.message || 'Failed to create calendar event');
        }

        const createdEvent = await response.json();
        res.json({
            success: true,
            message: 'Event created successfully',
            event: createdEvent,
            eventLink: createdEvent.htmlLink
        });

    } catch (error) {
        console.error('Calendar event creation error:', error);
        res.status(500).json({
            error: 'Failed to create calendar event',
            details: error.message
        });
    }
}

export default { createCalendarEvent };
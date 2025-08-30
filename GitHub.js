import fetch from 'node-fetch';

export async function getMilestones(req, res) {
    const repoOwner = (req.params.repoOwner || '').trim();
    const repoName = (req.params.repoName || '').trim();
    const githubToken = req.session.githubToken;

    if (!githubToken) {
        return res.status(401).json({
            error: 'GitHub authentication required',
            details: 'Please authenticate with GitHub to access repositories'
        });
    }

    try {
        // First, verify repository access
        const repoResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'GitHub-Milestone-Calendar'
            }
        });

        if (!repoResponse.ok) {
            if (repoResponse.status === 404) {
                return res.status(404).json({
                    error: 'Repository not found or no access',
                    details: 'Please verify the repository name and ensure you have access to it'
                });
            }
            throw new Error(`GitHub API returned ${repoResponse.status}: ${repoResponse.statusText}`);
        }

        const repoData = await repoResponse.json();
        if (repoData.private) {
            console.log('Accessing private repository:', repoData.full_name);
        }

        // Now fetch milestones
        const milestonesResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/milestones`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'GitHub-Milestone-Calendar'
            }
        });

        if (!milestonesResponse.ok) {
            throw new Error(`GitHub API returned ${milestonesResponse.status}: ${milestonesResponse.statusText}`);
        }

        const milestones = await milestonesResponse.json();

        if (!Array.isArray(milestones)) {
            throw new Error('Invalid response format from GitHub API');
        }

        // Process and format the milestone data
        const processedMilestones = milestones.map(milestone => ({
            ...milestone,
            due_on: milestone.due_on,
            formatted_due_date: milestone.due_on 
                ? new Date(milestone.due_on).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'No due date set',
            has_due_date: !!milestone.due_on,
            repository_private: repoData.private
        }));

        console.log(`Successfully fetched ${processedMilestones.length} milestones from ${repoData.private ? 'private' : 'public'} repository`);

        res.json({
            success: true,
            milestones: processedMilestones,
            repository: {
                owner: repoOwner,
                name: repoName,
                private: repoData.private
            }
        });

    } catch (error) {
        console.error('Failed to fetch milestones:', {
            error: error.message,
            stack: error.stack
        });

        res.status(error.status || 500).json({
            success: false,
            error: 'Failed to fetch milestones',
            details: error.message,
            repository: {
                owner: repoOwner,
                name: repoName
            }
        });
    }
}

export default getMilestones;
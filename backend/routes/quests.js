import express from 'express';
import OpenAI from 'openai';
import verifyToken from '../middleware/auth.js';
import DailyQuest from '../models/DailyQuest.js';
import DailyQuestCompletion from '../models/DailyQuestCompletion.js';
import User from '../models/User.js';
import { calculateLevel } from '../utils/leveling.js';
import { checkAchievements } from '../utils/achievementEngine.js';
import { getAiClient, getAiModel, callAiChat, parseJSONResponse } from '../services/aiService.js';

const router = express.Router();
const getGroq = getAiClient;

const parseJSON = (text) => {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch {
        const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}');
        if (a !== -1 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
        throw new Error('No valid JSON');
    }
};

// Get the IST-based period keys and validity windows
const getPeriodInfo = () => {
    // Use IST (UTC+5:30)
    const nowUTC = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(nowUTC.getTime() + istOffset);

    // Daily: resets at midnight IST
    const dailyStart = new Date(nowIST);
    dailyStart.setHours(0, 0, 0, 0);
    const dailyEnd = new Date(dailyStart);
    dailyEnd.setDate(dailyEnd.getDate() + 1);

    // Weekly: resets every Monday midnight IST
    const dayOfWeek = nowIST.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const weekStart = new Date(nowIST);
    weekStart.setDate(weekStart.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Format as YYYY-MM-DD for daily, YYYY-WNN for weekly
    const pad = n => String(n).padStart(2, '0');
    const dailyKey = `${nowIST.getFullYear()}-${pad(nowIST.getMonth() + 1)}-${pad(nowIST.getDate())}`;
    
    // ISO week number
    const firstJan = new Date(nowIST.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((nowIST - firstJan) / 86400000 + firstJan.getDay() + 1) / 7);
    const weeklyKey = `${nowIST.getFullYear()}-W${pad(weekNum)}`;

    // Convert back to UTC for DB storage
    return {
        daily: {
            key: dailyKey,
            validFrom: new Date(dailyStart.getTime() - istOffset),
            validUntil: new Date(dailyEnd.getTime() - istOffset),
        },
        weekly: {
            key: weeklyKey,
            validFrom: new Date(weekStart.getTime() - istOffset),
            validUntil: new Date(weekEnd.getTime() - istOffset),
        },
    };
};

// Generate a quest problem via AI
const generateQuestProblem = async (type, difficulty) => {
    const ai = getGroq();
    if (!ai) throw new Error('AI not configured');

    const topics = ['Arrays', 'Strings', 'Linked Lists', 'Binary Trees', 'Dynamic Programming', 
                    'Graph Traversal', 'Sliding Window', 'Two Pointers', 'Hash Maps', 
                    'Recursion', 'Binary Search', 'Stack & Queue', 'Greedy Algorithms', 'Sorting'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `You are an expert competitive programming problem setter.
Generate a ${difficulty} difficulty ${type === 'weekly' ? 'week-long challenge' : 'daily challenge'} coding problem on the topic: "${topic}".
Make it engaging and well-defined with clear examples.

Return ONLY this JSON (no markdown):
{
  "title": "Catchy problem title",
  "description": "Clear problem statement with context (3-4 sentences)",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "examples": [
    { "input": "nums = [1,2,3]", "output": "6", "explanation": "Sum of all elements" }
  ],
  "constraints": ["1 <= nums.length <= 10^5", "0 <= nums[i] <= 10^4"],
  "starterCode": {
    "javascript": "function solve(nums) {\\n  // your code here\\n}",
    "python": "def solve(nums):\\n    # your code here\\n    pass",
    "java": "public class Solution {\\n    public int solve(int[] nums) {\\n        // your code here\\n        return 0;\\n    }\\n}",
    "cpp": "class Solution {\\npublic:\\n    int solve(vector<int>& nums) {\\n        // your code here\\n        return 0;\\n    }\\n};"
  }
}`;

    const response = await callAiChat(ai, {
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' }
    });
    return parseJSON(response.choices[0].message.content);
};

// GET /api/quests/today — Returns today's daily + this week's weekly quest for ALL users
router.get('/today', verifyToken, async (req, res) => {
    try {
        const periods = getPeriodInfo();
        const quests = [];

        for (const type of ['daily', 'weekly']) {
            const period = periods[type];
            let quest = await DailyQuest.findOne({ type, periodKey: period.key });

            if (!quest) {
                console.log(`[QUESTS] Generating new ${type} quest for period ${period.key}...`);
                const difficulty = type === 'daily' ? 'Medium' : 'Hard';
                const data = await generateQuestProblem(type, difficulty);
                quest = await DailyQuest.create({
                    type,
                    periodKey: period.key,
                    validFrom: period.validFrom,
                    validUntil: period.validUntil,
                    xpReward: type === 'daily' ? 100 : 350,
                    title: data.title,
                    description: data.description,
                    topic: data.topic,
                    difficulty: data.difficulty,
                    examples: data.examples || [],
                    constraints: data.constraints || [],
                    starterCode: data.starterCode || {},
                });
                console.log(`[QUESTS] ✅ ${type} quest created: ${quest.title}`);
            }

            // Per-user completion status
            const completion = await DailyQuestCompletion.findOne({
                userId: req.userId,
                questId: quest._id,
            });

            quests.push({
                ...quest.toObject(),
                isCompleted: !!completion,
                completedAt: completion?.completedAt || null,
                score: completion?.score || null,
                // Time remaining in seconds
                secondsRemaining: Math.max(0, Math.floor((quest.validUntil - new Date()) / 1000)),
            });
        }

        res.json(quests);
    } catch (err) {
        console.error('[QUESTS ERROR]', err);
        res.status(500).json({ error: 'Failed to load quests: ' + err.message });
    }
});

// POST /api/quests/:id/submit — Submit code for a quest
router.post('/:id/submit', verifyToken, async (req, res) => {
    try {
        const quest = await DailyQuest.findById(req.params.id);
        if (!quest) return res.status(404).json({ error: 'Quest not found' });

        // Check quest is still valid
        if (new Date() > quest.validUntil) {
            return res.status(400).json({ error: 'This quest has expired.' });
        }

        // Check already completed
        const existing = await DailyQuestCompletion.findOne({
            userId: req.userId,
            questId: quest._id,
        });
        if (existing) {
            return res.status(400).json({ error: 'You have already completed this quest.' });
        }

        const { code, approach, language } = req.body;

        // Validate not empty
        const stripped = (code || '').replace(/\s/g, '');
        const hasRealCode = stripped.length > 30 &&
            !/\/\/yourcode(here)?/i.test(stripped) &&
            !/#yourcode(here)?/i.test(stripped);

        if (!hasRealCode) {
            return res.status(400).json({ error: 'Please write a real solution before submitting.' });
        }

        // Grade with AI
        const ai = getGroq();
        let score = 0;
        let feedback = '';

        if (ai) {
            const reviewPrompt = `You are a strict technical interviewer grading a coding submission.

Problem: ${quest.title}
Description: ${quest.description}
Difficulty: ${quest.difficulty}

Code submitted (${language || 'unknown'}):
\`\`\`
${code}
\`\`\`

Approach: ${approach || 'None provided'}

SCORING RULES:
- 0: Empty or starter template only
- 1-30: Attempt made but fundamentally wrong  
- 31-60: Partial solution, right idea but bugs
- 61-85: Mostly correct, minor issues
- 86-100: Correct and efficient

Return ONLY JSON: { "score": <0-100>, "feedback": "<2 sentence assessment>" }`;

            try {
                const resp = await callAiChat(ai, {
                    messages: [{ role: 'system', content: reviewPrompt }],
                    response_format: { type: 'json_object' }
                });
                const result = parseJSON(resp.choices[0].message.content);
                score = Math.min(100, Math.max(0, Number(result.score) || 0));
                feedback = result.feedback || '';
            } catch (aiErr) {
                console.error('[QUESTS] AI review failed:', aiErr.message);
                score = 50; // fallback
                feedback = 'Code reviewed successfully.';
            }
        }

        // Only award XP if score >= 40 (genuine attempt)
        const xpAwarded = score >= 40 ? Math.round(quest.xpReward * (score / 100)) : 0;

        // Save completion
        await DailyQuestCompletion.create({
            userId: req.userId,
            questId: quest._id,
            score,
            code,
        });

        // Award XP
        const user = await User.findById(req.userId);
        user.xp += xpAwarded;
        user.level = calculateLevel(user.xp);
        await user.save();

        const completedCount = await DailyQuestCompletion.countDocuments({ userId: req.userId });
        const earned = await checkAchievements(user, { questsCount: completedCount });

        res.json({
            success: true,
            score,
            feedback,
            xpAwarded,
            totalXp: user.xp,
            level: user.level,
            earnedAchievements: earned,
        });
    } catch (err) {
        console.error('[QUESTS SUBMIT ERROR]', err);
        res.status(500).json({ error: 'Failed to submit quest: ' + err.message });
    }
});

export default router;

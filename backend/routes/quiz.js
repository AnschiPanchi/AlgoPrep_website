import express from 'express';
import verifyToken from '../middleware/auth.js';
import User from '../models/User.js';
import Question from '../models/Question.js';
import JobMatch from '../models/JobMatch.js';
import Quest from '../models/Quest.js';
import QuestCompletion from '../models/QuestCompletion.js';
import { calculateLevel } from '../utils/leveling.js';
import { checkAchievements } from '../utils/achievementEngine.js';
import { getAiClient, getAiModel, callAiChat, parseJSONResponse } from '../services/aiService.js';

const router = express.Router();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const buildFallbackQuestion = (topic, difficulty) => {
    const safeTopic = topic || 'Problem Solving';
    const a = Math.floor(Math.random() * 30) + 5;
    const b = Math.floor(Math.random() * 20) + 2;
    const correct = a + b;
    const distractors = [correct - 1, correct + 1, correct + 2].map(String);
    const options = [String(correct), ...distractors].sort(() => Math.random() - 0.5);
    return {
        text: `[${safeTopic}] What is ${a} + ${b}?`,
        options,
        correctOption: options.indexOf(String(correct)),
        explanation: `Adding ${a} and ${b} gives ${correct}.`,
        topic: safeTopic,
        difficulty_level: clamp(Number(difficulty) || 5, 1, 10)
    };
};

const normalizeGeneratedQuestion = (raw, fallbackTopic, fallbackDifficulty) => {
    const fallback = buildFallbackQuestion(fallbackTopic, fallbackDifficulty);
    const options = Array.isArray(raw?.options)
        ? raw.options.map(opt => String(opt).trim()).filter(Boolean)
        : [];

    const normalizedOptions = options.length >= 4 ? options.slice(0, 4) : fallback.options;
    const normalizedCorrect = Number.isInteger(raw?.correctOption) && raw.correctOption >= 0 && raw.correctOption < normalizedOptions.length
        ? raw.correctOption
        : 0;

    return {
        text: String(raw?.text || fallback.text).trim(),
        options: normalizedOptions,
        correctOption: normalizedCorrect,
        explanation: String(raw?.explanation || fallback.explanation).trim(),
        topic: String(raw?.topic || fallback.topic).trim(),
        difficulty_level: clamp(Number(raw?.difficulty_level || fallback.difficulty_level), 1, 10),
        generatedByAI: true,
        status: 'approved'
    };
};

// Seed initial questions if needed (temp route)
router.post('/seed', async (req, res) => {
    try {
        const count = await Question.countDocuments();
        if (count > 0) return res.json({ message: 'Already seeded' });

        const dummyQuestions = [
            { text: 'What is the time complexity of binary search?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'], correctOption: 2, difficulty_level: 2, topic: 'Algorithms' },
            { text: 'Which data structure uses LIFO?', options: ['Queue', 'Stack', 'Tree', 'Graph'], correctOption: 1, difficulty_level: 1, topic: 'Data Structures' },
            { text: 'What is the worst-case time complexity of QuickSort?', options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'], correctOption: 1, difficulty_level: 4, topic: 'Algorithms' },
            { text: 'In dynamic programming, what is memoization?', options: ['Top-down caching', 'Bottom-up tabulation', 'Greedy choice', 'Divide and conquer'], correctOption: 0, difficulty_level: 6, topic: 'DP' },
            { text: 'Which algorithm is used to find the shortest path in a weighted graph with negative cycles?', options: ['Dijkstra', 'Bellman-Ford', 'Floyd-Warshall', 'A*'], correctOption: 1, difficulty_level: 8, topic: 'Graphs' }
        ];
        await Question.insertMany(dummyQuestions);
        res.json({ message: 'Seeded questions' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to seed' });
    }
});

// GET /api/quiz/next
// Get the next adapted question or a specific one if questionId is provided
router.get('/next', verifyToken, async (req, res) => {
    try {
        const { questionId } = req.query;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (questionId) {
            const specificQ = await Question.findById(questionId);
            if (!specificQ) return res.status(404).json({ error: 'Question not found' });
            return res.json(specificQ);
        }

        const now = new Date();
        // 1. Check Spaced Repetition (Failed / Due questions)
        const dueHistory = user.quizHistory.filter(q => q.nextTest && q.nextTest <= now && q.questionId);
        if (dueHistory.length > 0) {
            const randomDue = dueHistory[Math.floor(Math.random() * dueHistory.length)];
            const dueQuestion = await Question.findOne({ _id: randomDue.questionId, status: 'approved', generatedByAI: true });
            if (dueQuestion) return res.json(dueQuestion);
        }

        // 2. Generate a fresh AI question based on skills and missing/weak areas
        const ai = getAiClient();
        if (!ai) return res.status(503).json({ error: 'AI API key not configured on server.' });

        const jobMatches = await JobMatch.find({ userId: req.userId }).select('missingSkills');
        const missingSkills = [...new Set(jobMatches.flatMap(m => m.missingSkills || []))];
        const weakTopics = (user.weakTopics || []).filter(Boolean);
        const userSkills = (user.skills || []).filter(Boolean);

        const priorityTopics = [...new Set([...weakTopics, ...missingSkills])];
        const supportTopics = [...new Set(userSkills)];
        const topicPool = priorityTopics.length > 0 ? priorityTopics : (supportTopics.length > 0 ? supportTopics : ['Problem Solving']);
        const chosenTopic = pickRandom(topicPool);
        const targetDifficulty = clamp(user.abilityScore + (Math.random() > 0.5 ? 1 : 0), 1, 10);

        const prompt = `You are generating ONE multiple-choice technical quiz question for interview prep.

User profile:
- Stronger skills: ${supportTopics.join(', ') || 'Not specified'}
- Missing/weak skills (priority): ${priorityTopics.join(', ') || 'Not specified'}
- Focus topic for this question: ${chosenTopic}
- Target difficulty level (1-10): ${targetDifficulty}

Rules:
1. The question MUST be directly related to the focus topic.
2. Keep it practical and interview-relevant.
3. Provide exactly 4 options.
4. Exactly one option must be correct.
5. Return valid JSON only (no markdown).

Return schema:
{
  "text": "Question text",
  "options": ["A", "B", "C", "D"],
  "correctOption": 0,
  "explanation": "Brief explanation",
  "topic": "${chosenTopic}",
  "difficulty_level": ${targetDifficulty}
}`;

        const response = await callAiChat(ai, {
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: 'json_object' }
        });
        const aiData = parseJSONResponse(response.choices[0].message.content);

        const generatedQuestion = normalizeGeneratedQuestion(aiData, chosenTopic, targetDifficulty);
        const savedQuestion = await Question.create(generatedQuestion);
        res.json(savedQuestion);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get next question' });
    }
});

// POST /api/quiz/submit
// Submit answer, update SM-2, ability score, and streak
router.post('/submit', verifyToken, async (req, res) => {
    const { questionId, selectedOption } = req.body;
    try {
        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const user = await User.findById(req.userId);
        const isCorrect = question.correctOption === selectedOption;

        // SM-2 Logic & Ability Score updates
        const historyIndex = user.quizHistory.findIndex(h => h.questionId.toString() === questionId);
        let historyObj;

        if (historyIndex >= 0) {
            historyObj = user.quizHistory[historyIndex];
        } else {
            historyObj = { questionId, interval: 0, easinessFactor: 2.5, repetitions: 0 };
            user.quizHistory.push(historyObj);
        }

        if (isCorrect) {
            user.currentStreak += 1;
            // Increase ability if 3 correct in a row
            if (user.currentStreak % 3 === 0 && user.abilityScore < 10) {
                user.abilityScore += 1;
            }

            // SM-2 updates
            if (historyObj.repetitions === 0) historyObj.interval = 1;
            else if (historyObj.repetitions === 1) historyObj.interval = 6;
            else historyObj.interval = Math.round(historyObj.interval * historyObj.easinessFactor);

            historyObj.repetitions += 1;
            // Next test pushed far into the future (spaced rep)
            historyObj.nextTest = new Date(Date.now() + historyObj.interval * 24 * 60 * 60 * 1000);
        } else {
            user.currentStreak = 0;
            // User requested: "re-introduce questions the user failed 2 days later"
            historyObj.repetitions = 0;
            historyObj.interval = 2; 
            historyObj.nextTest = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days later
        }

        historyObj.lastTested = new Date();
        
        // Award XP on correct answer
        let xpGained = 0;
        if (isCorrect) {
            xpGained = question.difficulty_level * 5;
            user.xp += xpGained;
            user.level = calculateLevel(user.xp);
        }

        await user.save();

        // Check for achievements (General / Quests)
        const earned = await checkAchievements(user, { 
            questsCount: user.quizHistory.filter(h => h.repetitions > 0).length 
        });

        res.json({ 
            isCorrect, 
            correctOption: question.correctOption, 
            explanation: question.explanation, 
            abilityScore: user.abilityScore,
            xpGained,
            totalXp: user.xp,
            level: user.level,
            earnedAchievements: earned
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit answer' });
    }
});

// GET /api/quiz/current-quests
// Get uniform daily/weekly quests for all users
router.get('/current-quests', verifyToken, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch quests for today (or create if none exist)
        let quests = await Quest.find({ availableAt: today }).populate('problemId');
        
        if (quests.length === 0) {
            // Seed a few quests from the OFFICIAL Question pool for the day (creatorId: null)
            const sampleQuestions = await Question.aggregate([
                { $match: { creatorId: { $exists: false } } }, // In case creatorId is missing or null
                { $sample: { size: 4 } }
            ]);
            
            // Re-seed if no result from above (just in case)
            if (sampleQuestions.length === 0) {
                const anySample = await Question.aggregate([{ $sample: { size: 4 } }]);
                sampleQuestions.push(...anySample);
            }
            for (let i = 0; i < sampleQuestions.length; i++) {
                const q = new Quest({
                    title: `Challenge: ${sampleQuestions[i].topic}`,
                    description: `Solve this ${sampleQuestions[i].topic} problem to earn XP!`,
                    type: i === 3 ? 'weekly' : 'daily',
                    difficulty: sampleQuestions[i].difficulty_level <= 3 ? 'Easy' : sampleQuestions[i].difficulty_level <= 6 ? 'Medium' : 'Hard',
                    problemId: sampleQuestions[i]._id,
                    xpReward: i === 3 ? 200 : 50,
                    availableAt: today
                });
                await q.save();
            }
            quests = await Quest.find({ availableAt: today }).populate('problemId');
        }

        // Check completion status for the user
        const user = await User.findById(req.userId);
        const completions = await QuestCompletion.find({ userId: req.userId, questId: { $in: quests.map(q => q._id) } });
        const completionMap = completions.reduce((acc, c) => ({ ...acc, [c.questId]: true }), {});

        // Check if the user has solved the problem associated with each quest
        const formatted = quests.filter(q => q.problemId).map(q => {
            const isSolved = user.quizHistory.some(h => 
                h.questionId.toString() === q.problemId._id.toString() && h.repetitions > 0
            );
            return {
                ...q.toObject(),
                isCompleted: !!completionMap[q._id],
                isSolved
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch quests' });
    }
});

// POST /api/quiz/quest/:id/complete
// Award XP for completing a system quest
router.post('/quest/:id/complete', verifyToken, async (req, res) => {
    try {
        const quest = await Quest.findById(req.params.id);
        if (!quest) return res.status(404).json({ error: 'Quest not found' });

        const alreadyCompleted = await QuestCompletion.findOne({ userId: req.userId, questId: quest._id });
        if (alreadyCompleted) return res.status(400).json({ error: 'Quest reward already claimed' });

        const user = await User.findById(req.userId);
        
        // CRITICAL: Verify the problem was actually solved correctly
        const solvedRecord = user.quizHistory.find(h => 
            h.questionId.toString() === quest.problemId.toString() && h.repetitions > 0
        );

        if (!solvedRecord) {
            return res.status(403).json({ error: 'You must solve the challenge question correctly before claiming the reward!' });
        }

        const completion = new QuestCompletion({
            userId: req.userId,
            questId: quest._id,
            xpAwarded: quest.xpReward
        });

        user.xp += quest.xpReward;
        user.level = calculateLevel(user.xp);

        await Promise.all([completion.save(), user.save()]);

        // Check achievements after quest completion
        const completedQuestsCount = await QuestCompletion.countDocuments({ userId: req.userId });
        const earned = await checkAchievements(user, { questsCount: completedQuestsCount });

        res.json({ success: true, xpGained: quest.xpReward, totalXp: user.xp, level: user.level, earnedAchievements: earned });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to complete quest' });
    }
});

export default router;

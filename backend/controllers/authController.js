import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Helper to calculate & update login streak
const updateStreak = async (user) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newStreak = user.currentStreak || 0;
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;

    if (lastLogin) {
        const lastDay = new Date(lastLogin);
        lastDay.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - lastDay) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            newStreak += 1;
        } else if (diffDays > 1) {
            newStreak = 1;
        }
    } else {
        newStreak = 1;
    }

    user.currentStreak = newStreak;
    user.lastLogin = new Date();
    await user.save();
    return newStreak;
};

export const register = async (req, res) => {
    const { username, password, email, captchaAnswer, captchaQuestion } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Username, email, and password required' });
    }

    // Math captcha validation
    try {
        const parts = captchaQuestion.split(' ');
        const num1 = parseInt(parts[0]);
        const op = parts[1];
        const num2 = parseInt(parts[2]);
        let expected;
        if (op === '+') expected = num1 + num2;
        else if (op === '-') expected = num1 - num2;
        
        if (parseInt(captchaAnswer) !== expected) {
            return res.status(400).json({ error: 'Incorrect captcha answer' });
        }
    } catch (err) {
        return res.status(400).json({ error: 'Invalid captcha' });
    }

    try {
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(409).json({ error: 'User already exists' });

        const user = new User({ username, email, password, isVerified: true, currentStreak: 1, lastLogin: new Date() });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, _id: user._id, username: user.username, email: user.email, xp: user.xp, level: user.level } });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ $or: [{ username }, { email: username }] });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const newStreak = await updateStreak(user);
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, _id: user._id, username: user.username, email: user.email, currentStreak: newStreak } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Settings, CheckCircle2, Loader2, SlidersHorizontal } from 'lucide-react';

const CATEGORIES = {
    'DATA STRUCTURES & ALGORITHMS': ['Arrays', 'Strings', 'Linked Lists', 'Stacks', 'Queues', 'Trees', 'Graphs', 'Dynamic Programming', 'Greedy Algorithms', 'Sliding Window', 'Two Pointers'],
    'WEB DEVELOPMENT': ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Express.js', 'REST APIs', 'Authentication', 'State Management'],
    'DATABASES': ['SQL queries', 'MongoDB', 'Database design', 'Indexing', 'Transactions'],
    'BLOCKCHAIN': ['Blockchain fundamentals', 'Smart contracts', 'Solidity basics', 'Token contracts', 'Web3 interaction'],
    'SYSTEM DESIGN': ['Scalability concepts', 'Load balancing', 'Microservices', 'Database scaling', 'Caching strategies', 'API architecture'],
    'DEVOPS': ['Docker basics', 'CI/CD pipelines', 'Deployment strategies']
};

const InterviewSetup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    
    const [selectedTopics, setSelectedTopics] = useState([]);

    const [formData, setFormData] = useState({
        difficulty: 'Medium',
        duration: 30
    });

    const [solvedQuestions, setSolvedQuestions] = useState([]);

    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/performance/trends`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const titles = res.data.map(attempt => attempt.question).filter(Boolean);
                setSolvedQuestions([...new Set(titles)]);
            } catch (error) {
                console.error("Failed to fetch past attempts:", error);
            }
        };
        fetchTrends();
    }, []);

    const difficulties = [
        { level: 'Easy', color: 'var(--success)' },
        { level: 'Medium', color: 'var(--warning)' },
        { level: 'Hard', color: 'var(--danger)' }
    ];

    const durations = [15, 30, 45, 60];

    const toggleTopic = (topic) => {
        if (selectedTopics.includes(topic)) {
            setSelectedTopics(selectedTopics.filter(t => t !== topic));
        } else {
            setSelectedTopics([...selectedTopics, topic]);
        }
    };

    const handleStart = async (e) => {
        e.preventDefault();
        
        if (selectedTopics.length === 0) {
            return alert("Please select at least one topic.");
        }

        setLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/ai/generate-question`, {
                topics: selectedTopics,
                difficulty: formData.difficulty,
                solvedQuestions: solvedQuestions
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            navigate('/interview', {
                state: {
                    question: response.data,
                    setup: formData
                }
            });
        } catch (error) {
            console.error("Failed to generate question:", error);
            const errorMsg = error.response?.data?.error || "Failed to contact the AI. Ensure the backend is running and the API key is valid.";
            alert(errorMsg);
            setLoading(false);
        }
    };

    return (
        <div className="slide-up flex-center" style={{ minHeight: '60vh', padding: '2rem 0' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '750px', padding: '2.5rem' }}>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '1rem' }}>
                        <Settings size={32} />
                    </div>
                    <h2>Start New Practice Interview</h2>
                    <p className="text-muted">Choose your interview topics and settings.</p>
                </div>

                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--blue-dim)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem', color: 'var(--blue-light)' }}>
                        <SlidersHorizontal size={20} /> Topic Selection
                    </h3>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-sub)', lineHeight: 1.4 }}>
                        Manually select specific categories and frameworks you want to practice.
                    </p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {Object.entries(CATEGORIES).map(([cat, tops]) => (
                            <div key={cat}>
                                <h5 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '0.75rem' }}>{cat}</h5>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {tops.map(t => (
                                        <div
                                            key={t}
                                            onClick={() => toggleTopic(t)}
                                            style={{
                                                padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer',
                                                background: selectedTopics.includes(t) ? 'var(--blue-light)' : 'var(--bg-dark)',
                                                color: selectedTopics.includes(t) ? '#fff' : 'var(--text-sub)',
                                                border: `1px solid ${selectedTopics.includes(t) ? 'var(--blue-light)' : 'rgba(255,255,255,0.1)'}`
                                            }}
                                        >
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleStart}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Difficulty Level</label>
                        <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            {difficulties.map(({ level, color }) => (
                                <div
                                    key={level}
                                    onClick={() => setFormData({ ...formData, difficulty: level })}
                                    style={{
                                        padding: '0.75rem', textAlign: 'center', borderRadius: 'var(--radius-md)',
                                        border: `1px solid ${formData.difficulty === level ? color : 'rgba(255,255,255,0.1)'}`,
                                        backgroundColor: formData.difficulty === level ? `${color}20` : 'rgba(15, 23, 42, 0.6)',
                                        color: formData.difficulty === level ? color : 'var(--text-main)',
                                        cursor: 'pointer', transition: 'var(--transition)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                    }}
                                >
                                    {formData.difficulty === level && <CheckCircle2 size={16} />}
                                    {level}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Time Limit (Minutes)</label>
                        <div className="flex-responsive" style={{ display: 'flex', gap: '1rem' }}>
                            {durations.map(duration => (
                                <div
                                    key={duration}
                                    onClick={() => setFormData({ ...formData, duration })}
                                    style={{
                                        flex: 1, padding: '0.75rem', textAlign: 'center', borderRadius: 'var(--radius-md)',
                                        border: `1px solid ${formData.duration === duration ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                        backgroundColor: formData.duration === duration ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                                        cursor: 'pointer', transition: 'var(--transition)'
                                    }}
                                >
                                    {duration}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '2rem' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                <span className="animate-pulse">Generating Custom Interview...</span>
                            </>
                        ) : (
                            'Start Interview'
                        )}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default InterviewSetup;

import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Sparkles, Brain, Code, UserCircle, Briefcase, Loader2, Target } from 'lucide-react';

const AiMentor = () => {
    const { user, token } = useContext(AuthContext);
    const [advice, setAdvice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generateAdvice = async () => {
        const userId = user?._id || user?.id;
        const authToken = token || localStorage.getItem('token');
        if (!userId || !authToken) {
            setError('Please log in again to generate mentor feedback.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/ai/mentor/${userId}`,
                {
                    headers: { Authorization: `Bearer ${authToken}` },
                    timeout: 30000
                }
            );
            setAdvice(res.data);
        } catch (err) {
            const timeoutError = err?.code === 'ECONNABORTED';
            setError(timeoutError ? 'AI Mentor took too long to respond. Please try again.' : (err.response?.data?.error || 'Failed to generate mentor feedback. Please try again later.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>
            <div className="slide-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
                
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ display: 'inline-flex', padding: '1rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(219,39,119,0.1))', borderRadius: '20px', color: 'var(--violet-light)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-glow-v)' }}>
                        <Brain size={36} />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>AI <span className="text-gradient">Mentor</span> <span className="badge badge-violet" style={{ fontSize: '0.9rem', verticalAlign: 'middle' }}>PREMIUM</span></h2>
                    <p style={{ color: 'var(--text-muted)' }}>Get personalized career guidance based on your mock interviews, resume, and real-time job market data.</p>
                </div>

                {!advice && !loading && (
                    <div className="flex-center" style={{ marginTop: '2rem' }}>
                        <button className="btn btn-primary" onClick={generateAdvice} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                            <Sparkles size={20} /> Generate My Career Roadmap
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '4rem' }}>
                        <Loader2 className="animate-spin" size={40} color="var(--violet-light)" />
                        <span style={{ color: 'var(--text-muted)' }}>Analyzing your profile and matching data...</span>
                    </div>
                )}

                {error && (
                    <div className="error-banner" style={{ textAlign: 'center' }}>{error}</div>
                )}

                {/* Dashboard Output */}
                {advice && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                        
                        {/* Career Advice Overview */}
                        <div className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--violet-light)' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--violet-light)' }}>
                                <Target size={20} /> Overall Verdict
                            </h3>
                            <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: 'var(--text-main)' }}>
                                {advice.careerAdvice}
                            </p>
                        </div>

                        {/* Two Column Grid */}
                        <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            
                            {/* Skills */}
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--success)' }}>
                                    <Code size={18} /> Next Skills to Learn
                                </h4>
                                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {advice.nextSkills?.map((skill, i) => (
                                        <li key={i}>{skill}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Projects */}
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--blue-light)' }}>
                                    <Briefcase size={18} /> Project Ideas
                                </h4>
                                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {advice.projectIdeas?.map((proj, i) => (
                                        <li key={i}>{proj}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Portfolio Tips */}
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--warning)' }}>
                                    <UserCircle size={18} /> Portfolio & Resume Tips
                                </h4>
                                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {advice.portfolioTips?.map((tip, i) => (
                                        <li key={i}>{tip}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* LinkedIn Content */}
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#0A66C2' }}>
                                    <Sparkles size={18} /> Content Creation (LinkedIn)
                                </h4>
                                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-sub)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {advice.linkedinPostIdeas?.map((post, i) => (
                                        <li key={i}>{post}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiMentor;

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Sparkles, Map, Lightbulb, Hexagon, Linkedin, Brain, ArrowRight, RotateCw } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import ParticleNetwork from '../components/ParticleNetwork';

const AiMentorPro = () => {
    const { user, loading: authLoading } = useContext(AuthContext);
    const userId = user?._id || user?.id;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    const [data, setData] = useState(() => {
        if (!userId) return null;
        try {
            const cached = sessionStorage.getItem(`ai_mentor_pro_${userId}`);
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchInsights = async (force = false) => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/ai/mentor-pro/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000
            });
            setData(res.data);
            try {
                sessionStorage.setItem(`ai_mentor_pro_${userId}`, JSON.stringify(res.data));
            } catch {}
        } catch (err) {
            const timeoutError = err?.code === 'ECONNABORTED';
            setError(timeoutError ? "AI Mentor PRO took too long to respond. Please try again." : (err.response?.data?.error || "Failed to load AI Mentor PRO insights."));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) return;

        // Check cache first
        try {
            const cached = sessionStorage.getItem(`ai_mentor_pro_${userId}`);
            if (cached && !data) {
                setData(JSON.parse(cached));
                return;
            }
        } catch {}

        if (!data) {
            fetchInsights();
        }
    }, [userId]);

    if (authLoading || loading || (!data && !error && userId)) {
        return (
            <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '1rem' }}>
                <Sparkles className="animate-spin" size={48} color="#ec4899" />
                <p className="text-muted">Analyzing your career trajectory and generating PRO insights...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
                <div style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', maxWidth: '500px' }}>
                    <p style={{ color: 'var(--danger)', margin: '0 0 1rem', fontWeight: 500 }}>{error}</p>
                    <button className="btn btn-primary" onClick={() => fetchInsights(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RotateCw size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>No mentor insights available yet.</p>
                <button className="btn btn-primary" onClick={() => fetchInsights(true)}>
                    <Sparkles size={18} /> Generate Insights
                </button>
            </div>
        );
    }

    return (
        <>
        <ParticleNetwork color="#ec4899" />
        <div className="container slide-up" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '900px' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '50%', color: '#ec4899', marginBottom: '1.5rem', boxShadow: '0 0 40px rgba(236,72,153,0.3)' }}>
                    <Brain size={40} />
                </div>
                <h1 style={{ margin: '0 0 1rem', fontSize: '2.5rem' }}>AI Mentor <span style={{ color: '#ec4899' }}>PRO</span></h1>
                <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto 1.5rem', fontSize: '1.1rem' }}>Your unified premium dashboard for career guidance, personalized roadmaps, and actionable growth strategies.</p>
                <button 
                    onClick={() => fetchInsights(true)} 
                    disabled={loading}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Insights
                </button>
            </div>

            {/* Next Skills and Advice Row */}
            <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid var(--violet-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--violet-light)' }}>
                        <Hexagon size={24} />
                        <h3 style={{ margin: 0 }}>Your Next Skills</h3>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {(data.nextSkills || []).map((skill, idx) => (
                            <li key={idx} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '3px solid var(--violet-light)' }}>
                                {skill}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #ec4899' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ec4899' }}>
                        <Sparkles size={24} />
                        <h3 style={{ margin: 0 }}>Career Advice</h3>
                    </div>
                    <p style={{ lineHeight: 1.8, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {data.careerAdvice}
                    </p>
                </div>
            </div>

            {/* Roadmap */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', borderTop: '4px solid var(--blue-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', color: 'var(--blue-light)' }}>
                    <Map size={24} />
                    <h3 style={{ margin: 0 }}>Career Roadmap</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                    {(data.roadmap || []).map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                            <div style={{ 
                                width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', 
                                color: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontWeight: 'bold', flexShrink: 0, border: '2px solid rgba(56,189,248,0.3)', zIndex: 2
                            }}>
                                {idx + 1}
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', flex: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                                {step}
                            </div>
                        </div>
                    ))}
                    <div style={{ position: 'absolute', left: '17px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(56, 189, 248, 0.2)', zIndex: 1 }} />
                </div>
            </div>

            {/* Projects & LinkedIn Row */}
            <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid var(--success)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--success)' }}>
                        <Lightbulb size={24} />
                        <h3 style={{ margin: 0 }}>Recommended Projects</h3>
                    </div>
                    <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {(data.projectRecommendations || []).map((proj, idx) => (
                            <li key={idx} style={{ marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{proj}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="glass-panel" style={{ padding: '2rem', borderTop: '4px solid #0e76a8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#0e76a8' }}>
                        <Linkedin size={24} />
                        <h3 style={{ margin: 0 }}>LinkedIn Suggestions</h3>
                    </div>
                    <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {(data.linkedinSuggestions || []).map((post, idx) => (
                            <li key={idx} style={{ marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{post}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

        </div>
        </>
    );
};

export default AiMentorPro;

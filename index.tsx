
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Interfaces and Types ---
interface VideoSource {
    quality: string;
    url: string;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    timeLimitMinutes: number | null; // null for unlimited
    features: string[];
}

interface Comment {
    id: string;
    user: string;
    city: string;
    text: string;
    originalLang?: string;
    translatedText?: string;
    targetLang?: string;
    likes: number;
    dislikes: number;
    timestamp: number;
}

interface User {
    username: string;
    email: string;
}

type Theme = 'light' | 'dark';
type Page = 'login' | 'signup' | 'home' | 'library' | 'subscriptions' | 'watch';


// --- Constants and Mock Data ---
const API_KEY = process.env.API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

if (!ai) {
    console.warn("Gemini API Key not found. Translation functionality will be disabled. Ensure API_KEY environment variable is set.");
}


const videoSources: VideoSource[] = [
    { quality: '360p', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4' },
    { quality: '480p', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
    { quality: '720p', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    { quality: '1080p', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
];

const plans: Plan[] = [
    { id: 'free', name: 'Free', price: 0, timeLimitMinutes: 5, features: ['Watch videos for 5 minutes'] },
    { id: 'bronze', name: 'Bronze', price: 10, timeLimitMinutes: 7, features: ['Watch videos for 7 minutes', 'Basic Support'] },
    { id: 'silver', name: 'Silver', price: 50, timeLimitMinutes: 10, features: ['Watch videos for 10 minutes', 'Email Support'] },
    { id: 'gold', name: 'Gold', price: 100, timeLimitMinutes: null, features: ['Unlimited video watching', 'Priority Support'] },
];

// Mock user data store (in a real app, this would be a backend)
const mockUserStore: { [email: string]: User & { passwordHash: string } } = {};


// --- Helper Functions ---
const translateTextWithGemini = async (text: string, targetLanguage: string): Promise<string> => {
    if (!ai) return `Translation unavailable (API key missing): ${text}`;
    if (!text || !targetLanguage) return text;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: `Translate the following text to ${targetLanguage}: "${text}"`,
        });
        return response.text || text;
    } catch (error) {
        console.error("Error translating text:", error);
        return `Translation failed: ${text}`;
    }
};

const isValidCommentText = (text: string): boolean => {
    const regex = /^[a-zA-Z0-9\s.,!?'"():;\n-]*$/;
    return regex.test(text);
};

// --- React Components ---

// ** Navbar Component **
interface NavbarProps {
    isAuthenticated: boolean;
    currentUser: User | null;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    theme: Theme;
    isSouthIndiaSimulated: boolean;
    onToggleSouthIndia: (checked: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, currentUser, currentPage, onNavigate, onLogout, theme, isSouthIndiaSimulated, onToggleSouthIndia }) => {
    return (
        <nav className="navbar" role="navigation" aria-label="Main navigation">
            <div className="navbar-brand">
                <a className="navbar-item logo" onClick={() => onNavigate(isAuthenticated ? 'home' : 'login')}>
                    Advanced Media
                </a>
            </div>
            <div className="navbar-menu">
                <div className="navbar-start">
                    {isAuthenticated && (
                        <>
                            <a className={`navbar-item ${currentPage === 'home' ? 'is-active' : ''}`} onClick={() => onNavigate('home')}>Home</a>
                            <a className={`navbar-item ${currentPage === 'library' ? 'is-active' : ''}`} onClick={() => onNavigate('library')}>Library</a>
                            <a className={`navbar-item ${currentPage === 'subscriptions' ? 'is-active' : ''}`} onClick={() => onNavigate('subscriptions')}>Subscriptions</a>
                        </>
                    )}
                </div>
                <div className="navbar-end">
                    <div className="navbar-item">
                        <label htmlFor="simulateSouthIndiaNav" className="theme-toggle-label">
                            <input
                                type="checkbox"
                                id="simulateSouthIndiaNav"
                                checked={isSouthIndiaSimulated}
                                onChange={(e) => onToggleSouthIndia(e.target.checked)}
                                aria-describedby="location-simulation-desc-nav"
                            />
                            Simulate South India
                        </label>
                         <span id="location-simulation-desc-nav" className="hidden">Toggles theme and OTP simulation based on South India rules.</span>
                    </div>
                    <div className="navbar-item">
                       <span>Theme: {theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
                    </div>
                    {isAuthenticated && currentUser ? (
                        <>
                            <span className="navbar-item">Welcome, {currentUser.username}!</span>
                            <div className="navbar-item">
                                <button className="button is-light" onClick={onLogout}>Logout</button>
                            </div>
                        </>
                    ) : (
                        <div className="navbar-item">
                            <div className="buttons">
                                <button className="button is-primary" onClick={() => onNavigate('signup')}><strong>Sign up</strong></button>
                                <button className="button is-light" onClick={() => onNavigate('login')}>Log in</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};


// ** VideoPlayer Component **
interface VideoPlayerProps {
    sources: VideoSource[];
    currentPlan: Plan;
    onTimeLimitReached: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ sources, currentPlan, onTimeLimitReached }) => {
    const [currentSourceUrl, setCurrentSourceUrl] = useState<string>(sources[0]?.url || '');
    const [selectedQuality, setSelectedQuality] = useState<string>(sources[0]?.quality || '');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVideoPlayingBeforeQualityChange, setIsVideoPlayingBeforeQualityChange] = useState(false);
    const [timeLimitReached, setTimeLimitReached] = useState(false);

    useEffect(() => {
        const source = sources.find(s => s.quality === selectedQuality);
        if (source && source.url !== currentSourceUrl) {
            const currentTime = videoRef.current?.currentTime || 0;
            setCurrentSourceUrl(source.url);
            
            if (videoRef.current) {
                const videoElement = videoRef.current;
                videoElement.onloadeddata = () => {
                    if (videoElement && currentTime > 0) {
                         videoElement.currentTime = currentTime;
                    }
                    if (isVideoPlayingBeforeQualityChange && videoElement && videoElement.paused) {
                         videoElement.play().catch(e => console.error("Error resuming video play:", e));
                    }
                    videoElement.onloadeddata = null; 
                };
            }
        }
    }, [selectedQuality, sources, currentSourceUrl, isVideoPlayingBeforeQualityChange]);
    
    useEffect(()=> {
      setTimeLimitReached(false); 
      if (videoRef.current?.paused && isVideoPlayingBeforeQualityChange) {
         if (currentPlan.timeLimitMinutes === null || (videoRef.current && videoRef.current.currentTime < currentPlan.timeLimitMinutes * 60) ) {
            videoRef.current.play().catch(e => console.error("Error playing video after plan change:", e));
         }
      }
    }, [currentPlan, isVideoPlayingBeforeQualityChange]);

    const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (videoRef.current && !videoRef.current.paused) {
            setIsVideoPlayingBeforeQualityChange(true);
            videoRef.current.pause();
        } else {
            setIsVideoPlayingBeforeQualityChange(false);
        }
        setSelectedQuality(event.target.value);
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && currentPlan.timeLimitMinutes !== null && !timeLimitReached) {
            const limitSeconds = currentPlan.timeLimitMinutes * 60;
            if (videoRef.current.currentTime >= limitSeconds) {
                videoRef.current.pause();
                setTimeLimitReached(true);
                onTimeLimitReached(); 
                alert(`Your ${currentPlan.name} plan allows ${currentPlan.timeLimitMinutes} minutes of viewing. Please upgrade for more time.`);
            }
        }
    };

    return (
        <div className="video-player-container section" role="region" aria-labelledby="video-player-title">
            <h2 id="video-player-title" className="section-title">Video Player</h2>
            <video
                ref={videoRef}
                src={currentSourceUrl}
                controls
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsVideoPlayingBeforeQualityChange(true)}
                onPause={() => setIsVideoPlayingBeforeQualityChange(false)}
                aria-label="Main video content"
            />
            <div className="quality-selector">
                <label htmlFor="quality">Select Quality:</label>
                <select id="quality" value={selectedQuality} onChange={handleQualityChange} aria-label="Video quality selection">
                    {sources.map(source => (
                        <option key={source.quality} value={source.quality}>{source.quality}</option>
                    ))}
                </select>
            </div>
            {currentPlan.timeLimitMinutes !== null && (
                 <p>Current plan: {currentPlan.name} ({currentPlan.timeLimitMinutes} min limit). {timeLimitReached ? 'Time limit reached.' : ''}</p>
            )}
        </div>
    );
};

// ** SubscriptionPlansDisplay Component (renamed for clarity as it's a display component) **
interface SubscriptionPlansDisplayProps {
    currentPlanId: string;
    onUpgradePlan: (planId: string) => void;
}
const SubscriptionPlansDisplay: React.FC<SubscriptionPlansDisplayProps> = ({ currentPlanId, onUpgradePlan }) => {
    return (
        <div className="section" role="region" aria-labelledby="subscription-title">
            <h2 id="subscription-title" className="section-title">Subscription Plans</h2>
            <div className="plans-container">
                {plans.map(plan => (
                    <div key={plan.id} className={`plan-card card ${plan.id === currentPlanId ? 'active' : ''}`}>
                        <h3>{plan.name}</h3>
                        <p className="plan-price">₹{plan.price}{plan.price > 0 ? '/month' : ''}</p>
                        <ul>
                            {plan.features.map((feature, index) => <li key={index}>{feature}</li>)}
                        </ul>
                        {plan.id !== currentPlanId ? (
                             <button onClick={() => onUpgradePlan(plan.id)} aria-label={`Upgrade to ${plan.name} plan`}>
                                Upgrade to {plan.name}
                            </button>
                        ) : (
                            <p><strong>Current Plan</strong></p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ** CommentItem Component **
interface CommentItemProps {
    comment: Comment;
    onLike: (id: string) => void;
    onDislike: (id: string) => void;
    onTranslate: (id: string, targetLang: string) => void;
    isTranslating: boolean;
}
const CommentItem: React.FC<CommentItemProps> = ({ comment, onLike, onDislike, onTranslate, isTranslating }) => {
    const [targetLang, setTargetLang] = useState<string>('en'); 
    const availableLangs = ['en', 'es', 'fr', 'de', 'hi', 'ta', 'ja', 'ko'];

    const handleTranslateClick = () => {
        if (comment.text === comment.translatedText && comment.targetLang === targetLang) return; 
        onTranslate(comment.id, targetLang);
    };
    
    return (
        <div className="comment-item">
            <p className="comment-meta"><strong>{comment.user}</strong> from {comment.city} - <em>{new Date(comment.timestamp).toLocaleString()}</em></p>
            <p>{comment.text}</p>
            {comment.translatedText && (
                <div className="translated-text">
                    <p><em>(Translated to {comment.targetLang?.toUpperCase()}):</em> {comment.translatedText}</p>
                </div>
            )}
            <div className="comment-actions">
                <button onClick={() => onLike(comment.id)} aria-label={`Like comment from ${comment.user}`}>👍 Like ({comment.likes})</button>
                <button onClick={() => onDislike(comment.id)} aria-label={`Dislike comment from ${comment.user}`}>👎 Dislike ({comment.dislikes})</button>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} aria-label="Select language for translation" disabled={isTranslating || !ai}>
                    {availableLangs.map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                </select>
                <button onClick={handleTranslateClick} aria-label="Translate comment" disabled={isTranslating || !ai}>
                    {isTranslating ? 'Translating...' : 'Translate'}
                </button>
            </div>
        </div>
    );
};

// ** CommentSection Component **
interface CommentSectionProps {
    currentUser: User | null; // Pass current user to prefill comment user
}
const CommentSection: React.FC<CommentSectionProps> = ({ currentUser }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newCommentText, setNewCommentText] = useState<string>('');
    const [userCity] = useState<string>('Mockville'); // Could be fetched or part of user profile
    const [error, setError] = useState<string>('');
    const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedComments = localStorage.getItem('comments');
            if (savedComments) {
                setComments(JSON.parse(savedComments));
            }
        } catch (e) {
            console.error("Failed to load comments from localStorage:", e);
            localStorage.removeItem('comments');
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('comments', JSON.stringify(comments));
        } catch (e) {
            console.error("Failed to save comments to localStorage:", e);
        }
    }, [comments]);

    const handleCommentSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentUser) {
            setError('You must be logged in to comment.');
            return;
        }
        const trimmedComment = newCommentText.trim();
        if (!trimmedComment) {
            setError('Comment cannot be empty.');
            return;
        }
        if (!isValidCommentText(trimmedComment)) {
            setError('Comment contains disallowed characters. Please use only letters, numbers, spaces, and basic punctuation (.,!?"\'():;-).');
            return;
        }
        setError('');
        const newComment: Comment = {
            id: Date.now().toString(),
            user: currentUser.username, // Use logged-in user's name
            city: userCity,
            text: trimmedComment,
            likes: 0,
            dislikes: 0,
            timestamp: Date.now(),
        };
        setComments(prevComments => [newComment, ...prevComments]);
        setNewCommentText('');
    };

    const handleLike = (id: string) => {
        setComments(comments.map(c => c.id === id ? { ...c, likes: c.likes + 1 } : c));
    };

    const handleDislike = (id: string) => {
        let commentRemoved = false;
        const updatedComments = comments.map(c => {
            if (c.id === id) {
                const newDislikes = c.dislikes + 1;
                if (newDislikes >= 2) {
                    commentRemoved = true;
                    return null; 
                }
                return { ...c, dislikes: newDislikes };
            }
            return c;
        }).filter(Boolean) as Comment[]; 
        
        setComments(updatedComments);
        if (commentRemoved) {
            alert("Comment removed due to reaching 2 dislikes.");
        }
    };
    
    const handleTranslate = async (id: string, targetLang: string) => {
        const commentToTranslate = comments.find(c => c.id === id);
        if (!commentToTranslate || !ai) return;

        setTranslatingCommentId(id);
        try {
            const translated = await translateTextWithGemini(commentToTranslate.text, targetLang);
            setComments(prevComments => prevComments.map(c => 
                c.id === id ? { ...c, translatedText: translated, targetLang: targetLang } : c
            ));
        } catch (e) {
            console.error("Translation API call failed in component:", e);
             setComments(prevComments => prevComments.map(c => 
                c.id === id ? { ...c, translatedText: "Translation process failed.", targetLang: targetLang } : c
            ));
        } finally {
            setTranslatingCommentId(null);
        }
    };


    return (
        <div className="comment-section section" role="article" aria-labelledby="comment-section-title">
            <h2 id="comment-section-title" className="section-title">Comments</h2>
            {currentUser ? (
                <form onSubmit={handleCommentSubmit} aria-describedby="comment-form-instructions">
                    <div className="form-group">
                        <label htmlFor="commentText">Your Comment as {currentUser.username}:</label>
                        <textarea
                            id="commentText"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write your comment here..."
                            aria-required="true"
                            rows={4}
                            aria-invalid={!!error}
                            aria-describedby={error ? "comment-error" : undefined}
                        />
                         {error && <p id="comment-error" className="error-message" role="alert">{error}</p>}
                         <p id="comment-form-instructions" className="hidden">Enter your comment using letters, numbers, spaces, and basic punctuation.</p>
                    </div>
                    <button type="submit">Post Comment</button>
                </form>
            ) : (
                <p>Please log in to post comments.</p>
            )}
            <div className="comments-list" aria-live="polite">
                {comments.length === 0 && <p>No comments yet. Be the first to comment!</p>}
                {comments.map(comment => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        onLike={handleLike}
                        onDislike={handleDislike}
                        onTranslate={handleTranslate}
                        isTranslating={translatingCommentId === comment.id}
                    />
                ))}
                 {!ai && <p className="error-message">Translation service is currently unavailable (API Key might be missing).</p>}
            </div>
        </div>
    );
};

// ** VoIPSection Component **
const VoIPSection: React.FC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isCallActive, setIsCallActive] = useState(false);
    // const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    // const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);


    const handleStartCall = async () => {
        if (isCallActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setIsCallActive(true);
            alert("Video call started. Local video active. (WebRTC connection to remote peer not implemented).");
        } catch (error) {
            console.error("Error accessing media devices.", error);
            alert("Could not access camera/microphone. Please check permissions and ensure they are not blocked.");
        }
    };

    const handleEndCall = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null; 
        setIsCallActive(false);
        alert("Call ended.");
    };

    const handleScreenShare = async () => {
        if (!isCallActive) {
            alert("Please start a call before sharing screen.");
            return;
        }
        alert("Attempting to start screen share... (getDisplayMedia integration needed for WebRTC)");
        try {
            // @ts-ignore 
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            alert("Screen sharing stream acquired. You would typically send this to the remote peer via WebRTC. The browser will ask which screen/window/tab to share. To share YouTube, select its tab/window.");
            console.log("Screen share stream acquired:", screenStream);
        } catch (error) {
            console.error("Error starting screen share.", error);
            alert("Screen share failed or was cancelled.");
        }
    };

    const handleRecordSession = () => {
        alert("Recording session... (MediaRecorder API integration needed)");
        if (!localStream && !isCallActive) {
             alert("Cannot record: call is not active or no local stream.");
             return;
        }
    };


    return (
        <div className="section voip-section" role="region" aria-labelledby="voip-title">
            <h2 id="voip-title" className="section-title">Voice/Video Call</h2>
            <div className="voip-controls">
                {!isCallActive ? (
                    <button onClick={handleStartCall} aria-label="Start video call">Start Call</button>
                ) : (
                    <button onClick={handleEndCall} aria-label="End video call">End Call</button>
                )}
                <button onClick={handleScreenShare} aria-label="Share screen" disabled={!isCallActive}>Share Screen</button>
                <button onClick={handleRecordSession} aria-label="Record session" disabled={!isCallActive}>
                    Record Session (Demo)
                </button>
            </div>
            <div className="video-streams">
                <div>
                    <p>Your Video</p>
                    <video ref={localVideoRef} autoPlay muted playsInline aria-label="Local video stream"></video>
                </div>
                <div>
                    <p>Friend's Video (Placeholder)</p>
                    <video ref={remoteVideoRef} autoPlay playsInline aria-label="Remote video stream placeholder"></video>
                </div>
            </div>
            <p><small>Note: Full VoIP functionality requires WebRTC implementation for peer-to-peer connection, signaling server, and media stream handling. Screen sharing and recording are demo placeholders.</small></p>
        </div>
    );
};


// ** LoginPage Component **
interface LoginPageProps {
    onLogin: (email: string, otp: string) => void; // Simplified, password check is mock internal
    isSouthIndiaSimulated: boolean;
    onNavigateToSignup: () => void;
}
const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isSouthIndiaSimulated, onNavigateToSignup }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [otpMessage, setOtpMessage] = useState('');

    const handleSubmitAttempt = (event: React.FormEvent) => {
        event.preventDefault();
        if (!email || !password) {
            setLoginError('Email and password are required.');
            return;
        }
        setLoginError('');
        // Mock: Check if user exists (in a real app, this is a backend call)
        if (!mockUserStore[email] || mockUserStore[email].passwordHash !== password) { // Simplified: using plain text password as hash for mock
             setLoginError('Invalid email or password.');
             return;
        }

        const message = isSouthIndiaSimulated
            ? "OTP will be sent via Email for verification (Simulated South India User)."
            : "OTP will be sent via Mobile Number for verification (Simulated Other Location).";
        setOtpMessage(message);
        setShowOtpInput(true);
        alert(message + " Please enter mock OTP '123456'."); // Simulate OTP sending
    };

    const handleOtpSubmit = (event: React.FormEvent) => {
        event.preventDefault();
         if (otp === '123456') { // Mock OTP check
            onLogin(email, otp);
        } else {
            setLoginError('Invalid OTP.');
        }
    };

    return (
        <div className="auth-page section card" role="form" aria-labelledby="login-title">
            <h2 id="login-title" className="section-title">Login</h2>
            {!showOtpInput ? (
                <form onSubmit={handleSubmitAttempt}>
                    <div className="form-group">
                        <label htmlFor="loginEmail">Email:</label>
                        <input type="email" id="loginEmail" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="loginPassword">Password:</label>
                        <input type="password" id="loginPassword" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {loginError && <p className="error-message" role="alert">{loginError}</p>}
                    <button type="submit">Continue</button>
                </form>
            ) : (
                 <form onSubmit={handleOtpSubmit}>
                    <p>{otpMessage}</p>
                    <div className="form-group">
                        <label htmlFor="loginOtp">Enter OTP:</label>
                        <input type="text" id="loginOtp" value={otp} onChange={(e) => setOtp(e.target.value)} required />
                    </div>
                    {loginError && <p className="error-message" role="alert">{loginError}</p>}
                    <button type="submit">Login with OTP</button>
                </form>
            )}
            <p>Don't have an account? <button type="button" className="link-button" onClick={onNavigateToSignup}>Sign Up</button></p>
        </div>
    );
};

// ** SignupPage Component **
interface SignupPageProps {
    onSignup: (username: string, email: string, otp: string) => void; // Simplified, password is set mock internally
    onNavigateToLogin: () => void;
}
const SignupPage: React.FC<SignupPageProps> = ({ onSignup, onNavigateToLogin }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [signupError, setSignupError] = useState('');

    const handleSubmitAttempt = (event: React.FormEvent) => {
        event.preventDefault();
        if (!username || !email || !password) {
            setSignupError('All fields are required.');
            return;
        }
        setSignupError('');
        // Mock: Check if user already exists
        if (mockUserStore[email]) {
            setSignupError('User with this email already exists. Please login.');
            return;
        }
        // Mock: Store user temporarily and simulate OTP sending
        mockUserStore[email] = { username, email, passwordHash: password }; // Storing plain password as hash for mock

        setShowOtpInput(true);
        alert("Mock OTP '123456' has been sent to your email. Please enter it below.");
    };
    
    const handleOtpSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (otp === '123456') { // Mock OTP check
            onSignup(username, email, otp); // Password already "stored"
        } else {
            setSignupError('Invalid OTP.');
        }
    };

    return (
        <div className="auth-page section card" role="form" aria-labelledby="signup-title">
            <h2 id="signup-title" className="section-title">Sign Up</h2>
            {!showOtpInput ? (
                <form onSubmit={handleSubmitAttempt}>
                    <div className="form-group">
                        <label htmlFor="signupUsername">Username:</label>
                        <input type="text" id="signupUsername" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="signupEmail">Email:</label>
                        <input type="email" id="signupEmail" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="signupPassword">Password:</label>
                        <input type="password" id="signupPassword" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {signupError && <p className="error-message" role="alert">{signupError}</p>}
                    <button type="submit">Sign Up</button>
                </form>
            ) : (
                <form onSubmit={handleOtpSubmit}>
                    <p>An OTP has been sent to {email}.</p>
                     <div className="form-group">
                        <label htmlFor="signupOtp">Enter OTP:</label>
                        <input type="text" id="signupOtp" value={otp} onChange={(e) => setOtp(e.target.value)} required />
                    </div>
                    {signupError && <p className="error-message" role="alert">{signupError}</p>}
                    <button type="submit">Verify OTP & Complete Signup</button>
                </form>
            )}
            <p>Already have an account? <button type="button" className="link-button" onClick={onNavigateToLogin}>Log In</button></p>
        </div>
    );
};

// ** HomePage Component **
interface HomePageProps {
    videoSources: VideoSource[];
    currentPlan: Plan;
    onTimeLimitReached: () => void;
    currentUser: User | null;
}
const HomePage: React.FC<HomePageProps> = ({ videoSources, currentPlan, onTimeLimitReached, currentUser }) => {
    return (
        <>
            <VideoPlayer sources={videoSources} currentPlan={currentPlan} onTimeLimitReached={onTimeLimitReached} />
            <CommentSection currentUser={currentUser} />
            <VoIPSection />
        </>
    );
};

// ** LibraryPage Component **
const LibraryPage: React.FC = () => {
    return (
        <div className="section card" role="region" aria-labelledby="library-title">
            <h2 id="library-title" className="section-title">My Library</h2>
            <p>Welcome to your library. Here you'll find your watch history, saved videos, and playlists (coming soon!).</p>
        </div>
    );
};

// ** SubscriptionsPage Component **
interface SubscriptionsPageProps {
    currentPlanId: string;
    onUpgradePlan: (planId: string) => void;
}
const SubscriptionsPage: React.FC<SubscriptionsPageProps> = ({ currentPlanId, onUpgradePlan }) => {
    return (
        <>
            <SubscriptionPlansDisplay currentPlanId={currentPlanId} onUpgradePlan={onUpgradePlan} />
        </>
    );
};


// ** App Component (Main) **
const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('isAuthenticated') === 'true');
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('currentUser');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [currentPage, setCurrentPage] = useState<Page>(() => {
        const storedPage = localStorage.getItem('currentPage') as Page | null;
        return isAuthenticated ? (storedPage || 'home') : 'login';
    });
     const [currentPlanId, setCurrentPlanId] = useState<string>(() => {
        const savedPlanId = localStorage.getItem('currentPlanId');
        return savedPlanId || plans[0].id;
    });
    const [theme, setTheme] = useState<Theme>('light');
    const [isSouthIndiaSimulated, setIsSouthIndiaSimulated] = useState<boolean>(false);
    
    const currentPlan = plans.find(p => p.id === currentPlanId) || plans[0];

    useEffect(() => {
        localStorage.setItem('currentPlanId', currentPlanId);
    }, [currentPlanId]);

    useEffect(() => {
        if (isAuthenticated) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('currentPage', currentPage);
        } else {
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentPage'); // Or set to 'login'
        }
    }, [isAuthenticated, currentUser, currentPage]);

    // Theme Logic
    useEffect(() => {
        const currentHour = new Date().getHours();
        let newTheme: Theme = 'dark'; 

        if (isSouthIndiaSimulated) {
            if (currentHour >= 10 && currentHour < 12) { 
                newTheme = 'light';
            }
        }
        setTheme(newTheme);
        document.body.className = `${newTheme}-theme`;
    }, [isSouthIndiaSimulated]);

    const handleNavigate = (page: Page) => {
        if (page === 'login' || page === 'signup') {
            if (isAuthenticated) { // prevent navigating to auth pages if logged in, redirect to home
                setCurrentPage('home');
                return;
            }
        }
        setCurrentPage(page);
    };

    const handleLogin = (email: string, _otp: string) => { // OTP is validated in LoginPage
        const user = mockUserStore[email]; // Assume password check passed in LoginPage
        if (user) {
            const { passwordHash, ...userDetails } = user; // Don't store passwordHash in currentUser state
            setCurrentUser(userDetails);
            setIsAuthenticated(true);
            setCurrentPage('home');
            alert(`Login successful! Welcome ${user.username}.`);
             // Restore or set default plan ID (could be user-specific from backend)
            const userPlan = localStorage.getItem(`userPlan_${email}`) || plans[0].id;
            setCurrentPlanId(userPlan);
        } else {
             alert('Login failed. User not found (this should not happen if OTP stage reached).');
        }
    };

    const handleSignup = (username: string, email: string, _otp: string) => {
        // User already added to mockUserStore during OTP step in SignupPage
        const user = mockUserStore[email];
         if (user) {
            const { passwordHash, ...userDetails } = user;
            setCurrentUser(userDetails);
            setIsAuthenticated(true);
            setCurrentPage('home');
            setCurrentPlanId(plans[0].id); // New users start with free plan
            localStorage.setItem(`userPlan_${email}`, plans[0].id);
            alert(`Signup successful! Welcome ${username}.`);
        } else {
            alert('Signup completion failed. User data missing.');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentPage('login');
        // Optionally clear plan or reset to default, or keep it in localStorage for next login
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentPage');
        alert("You have been logged out.");
    };
    
    const handleUpgradePlan = (planId: string) => {
        const newPlan = plans.find(p => p.id === planId);
        if (newPlan && currentUser) {
            setCurrentPlanId(planId);
            localStorage.setItem(`userPlan_${currentUser.email}`, planId); // Store plan for this user
            alert(`Payment of ₹${newPlan.price} successful for ${newPlan.name} plan! An invoice has been (simulated) emailed to you.`);
            console.log(`User ${currentUser.email} upgraded to ${newPlan.name}. Invoice (simulated) sent.`);
        } else if (!currentUser) {
            alert("Please log in to upgrade your plan.");
            setCurrentPage('login');
        }
    };
    
    const handleTimeLimitReached = useCallback(() => {
        console.log("Video time limit reached for current plan.");
    }, []);

    const renderPage = () => {
        if (!isAuthenticated) {
            if (currentPage === 'signup') {
                return <SignupPage onSignup={handleSignup} onNavigateToLogin={() => setCurrentPage('login')} />;
            }
            return <LoginPage onLogin={handleLogin} isSouthIndiaSimulated={isSouthIndiaSimulated} onNavigateToSignup={() => setCurrentPage('signup')} />;
        }

        switch (currentPage) {
            case 'home':
                return <HomePage videoSources={videoSources} currentPlan={currentPlan} onTimeLimitReached={handleTimeLimitReached} currentUser={currentUser} />;
            case 'library':
                return <LibraryPage />;
            case 'subscriptions':
                return <SubscriptionsPage currentPlanId={currentPlanId} onUpgradePlan={handleUpgradePlan} />;
            default:
                return <HomePage videoSources={videoSources} currentPlan={currentPlan} onTimeLimitReached={handleTimeLimitReached} currentUser={currentUser} />;
        }
    };

    return (
        <div className={`app-container ${theme}-theme-bg`}>
            <Navbar 
                isAuthenticated={isAuthenticated} 
                currentUser={currentUser}
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                theme={theme}
                isSouthIndiaSimulated={isSouthIndiaSimulated}
                onToggleSouthIndia={setIsSouthIndiaSimulated}
            />
            <main role="main" className="main-content">
                {renderPage()}
            </main>
            <footer role="contentinfo">
                <p>&copy; {new Date().getFullYear()} Advanced Media Platform. All rights reserved.</p>
            </footer>
        </div>
    );
};

// --- Render Application ---
const container = document.getElementById('root');
if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error('Failed to find the root element for React application.');
}

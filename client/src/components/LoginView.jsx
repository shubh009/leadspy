import React, { useState } from 'react';
import { 
  Zap, 
  Globe, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';

export default function LoginView({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('agent@leadspy.ai');
  const [password, setPassword] = useState('leadspy123');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginUser(email, password);
        if (res.user) {
          onLoginSuccess(res.user);
        }
      } else {
        const res = await registerUser(email, password, name);
        if (res.user) {
          setSuccessMsg('Account registered successfully! Logging you in...');
          setTimeout(() => {
            onLoginSuccess(res.user);
          }, 600);
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('agent@leadspy.ai');
    setPassword('leadspy123');
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser('agent@leadspy.ai', 'leadspy123');
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-[#faf7f2] text-[#1f232e] font-sans flex flex-col justify-between overflow-x-hidden overflow-y-auto select-none">
      
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between relative z-30">
        {/* Left: Brand Logo & Support link */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/25 text-white">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-[#14151b] flex items-center gap-1.5">
              LeadSpy
              <span className="text-[10px] bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded font-mono font-bold">AI</span>
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => alert('Support: support@leadspy.ai\nLeadSpy AI Agent Platform')}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-orange-600 transition mt-1 cursor-pointer"
          >
            <span>support@leadspy.ai</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Right: Language, Switch Mode & Request Demo */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer transition">
            <Globe className="w-4 h-4 text-gray-400" />
            <span>English (IN)</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer transition"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#fed7aa] hover:bg-[#fdba74] text-orange-950 shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Request Demo</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN CENTER HERO SECTION WITH ARTISTIC DOODLES */}
      <main className="relative flex-1 flex items-center justify-center px-4 py-8 sm:py-12 z-20">

        {/* LEFT DOODLE ART: Floating message bubble, dotted block & growth arrow */}
        <div className="hidden lg:block absolute left-8 xl:left-24 bottom-16 pointer-events-none select-none z-10">
          {/* Curly Squiggle top */}
          <svg className="absolute -top-32 left-8 w-24 h-16 text-gray-400 stroke-current opacity-70" viewBox="0 0 100 60" fill="none" strokeWidth="1.5">
            <path d="M 10,40 Q 30,10 50,30 T 90,20" strokeLinecap="round" />
            <circle cx="92" cy="18" r="2.5" fill="#f97316" />
          </svg>

          {/* Doodled Speech/Text Card */}
          <div className="relative mb-6 ml-2 w-36 h-20 bg-white/90 border border-gray-300/80 rounded-xl p-3 shadow-sm rotate-[-4deg]">
            <div className="w-16 h-2 bg-gray-200 rounded mb-2"></div>
            <div className="w-24 h-2 bg-orange-200/80 rounded mb-1.5"></div>
            <div className="w-20 h-1.5 bg-gray-100 rounded"></div>
            <div className="absolute -bottom-2 right-4 w-3 h-3 bg-white border-b border-r border-gray-300 rotate-45"></div>
          </div>

          <div className="flex items-end gap-3">
            {/* Dotted Amber Pillar */}
            <div className="w-16 h-32 rounded-lg bg-[#fcd34d]/60 border border-amber-400/40 relative overflow-hidden flex flex-col justify-around items-center p-2 shadow-sm">
              {/* Pattern dots */}
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-900/60"></span></div>
            </div>

            {/* Growth Arrow Block */}
            <div className="w-20 h-24 bg-white border border-gray-300 rounded-lg p-2 flex flex-col items-center justify-center shadow-sm">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center mb-1">
                <TrendingUp className="w-5 h-5 text-orange-500 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Leads +400%</span>
            </div>
          </div>

          {/* Hand drawn base line */}
          <div className="w-64 h-[1.5px] bg-gray-300/70 mt-3 -ml-6 rounded"></div>
        </div>

        {/* RIGHT DOODLE ART: Girl sitting on block with laptop & dotted column */}
        <div className="hidden lg:block absolute right-8 xl:right-24 bottom-16 pointer-events-none select-none z-10">
          {/* Curly Squiggle top right */}
          <svg className="absolute -top-32 right-12 w-28 h-16 text-gray-400 stroke-current opacity-70" viewBox="0 0 100 60" fill="none" strokeWidth="1.5">
            <path d="M 10,25 Q 40,55 70,25 T 95,45" strokeLinecap="round" />
            <circle cx="8" cy="24" r="2" fill="#f59e0b" />
          </svg>

          {/* Doodled Speech Box */}
          <div className="relative mb-4 ml-auto mr-12 w-28 h-16 bg-white border border-gray-300 rounded-lg p-2.5 shadow-sm">
            <div className="w-12 h-1.5 bg-gray-300 rounded mb-1.5"></div>
            <div className="w-20 h-1.5 bg-amber-300 rounded"></div>
            <div className="absolute -bottom-2 left-4 w-2.5 h-2.5 bg-white border-b border-r border-gray-300 rotate-45"></div>
          </div>

          <div className="flex items-end gap-3">
            {/* Girl / Agent vector character sitting on cubic box */}
            <div className="relative w-44 h-56 flex flex-col items-center justify-end">
              {/* Sitting Person Illustration Vector */}
              <svg className="w-40 h-44 -mb-2 relative z-10" viewBox="0 0 160 180" fill="none">
                {/* Hair Bun */}
                <circle cx="125" cy="22" r="10" fill="#1e2029" />
                <circle cx="130" cy="18" r="5" fill="#1e2029" />
                {/* Face & Neck */}
                <circle cx="116" cy="28" r="11" fill="#fee2e2" />
                <path d="M 116,39 L 116,46" stroke="#1e2029" strokeWidth="2" />
                {/* Body / Top with polka or geometric dots */}
                <path d="M 102,46 C 96,55 96,75 106,85 L 126,85 C 132,75 130,55 124,46 Z" fill="#1e2029" />
                <circle cx="109" cy="56" r="1.5" fill="#ffffff" />
                <circle cx="119" cy="58" r="1.5" fill="#ffffff" />
                <circle cx="114" cy="68" r="1.5" fill="#ffffff" />
                <circle cx="123" cy="72" r="1.5" fill="#ffffff" />
                {/* Arms & Hands */}
                <path d="M 105,52 L 86,72 L 95,78" stroke="#1e2029" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Laptop (greenish / mint screen) */}
                <path d="M 72,66 L 86,84 L 102,84" stroke="#84cc16" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <polygon points="76,68 88,82 100,82 86,68" fill="#bef264" opacity="0.8" />
                {/* Legs in relaxed seated position */}
                <path d="M 112,85 C 105,95 72,110 74,130 L 90,135" stroke="#1e2029" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                {/* Lower legs & modern boots */}
                <path d="M 74,130 L 66,155" stroke="#1e2029" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M 88,135 L 86,160" stroke="#1e2029" strokeWidth="5.5" strokeLinecap="round" />
                {/* Shoes */}
                <path d="M 64,155 L 56,164 L 72,164 Z" fill="#1e2029" />
                <path d="M 84,160 L 80,169 L 96,169 Z" fill="#1e2029" />
              </svg>

              {/* White Pedestal / Cube Block */}
              <div className="w-24 h-24 bg-white border border-gray-300 rounded-lg shadow-sm relative z-0">
                <div className="w-full h-full border-t-2 border-gray-100"></div>
              </div>
            </div>

            {/* Right Amber Dotted Pillar */}
            <div className="w-16 h-36 rounded-lg bg-[#fdba74]/50 border border-orange-300/60 relative overflow-hidden flex flex-col justify-around items-center p-2 shadow-sm">
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span></div>
              <div className="w-full flex justify-around"><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span><span className="w-1.5 h-1.5 rounded-full bg-amber-950/70"></span></div>
            </div>
          </div>

          {/* Hand drawn base line */}
          <div className="w-64 h-[1.5px] bg-gray-300/70 mt-3 -ml-4 rounded"></div>
        </div>


        {/* CENTER ELEVATED WHITE CARD (Exact replica of reference UI) */}
        <div className="relative w-full max-w-[420px] bg-white rounded-[26px] shadow-2xl shadow-stone-400/20 border border-gray-100 p-7 sm:p-9 z-20 transition-all">
          
          {/* Header Title & Subtitle */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#14151b]">
              {mode === 'login' ? 'Agent Login' : 'Create Agent Account'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed max-w-xs mx-auto">
              {mode === 'login' 
                ? 'Hey, Enter your details to get sign in to your account' 
                : 'Join LeadSpy AI to prospect verified Google Maps leads & high-paying clients'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-3.5">

            {/* If sign up mode, ask for Name */}
            {mode === 'signup' && (
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-4 py-3 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                  required
                />
              </div>
            )}

            {/* Email / Phone Input */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Email / Phone No"
                className="w-full px-4 py-3 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition pr-10"
                required
              />
              <div className="absolute right-3.5 w-3.5 h-3.5 rounded-full border border-gray-300 pointer-events-none" />
            </div>

            {/* Passcode Input */}
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passcode"
                className="w-full px-4 py-3 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition pr-14"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-xs text-gray-400 hover:text-gray-700 font-medium transition cursor-pointer select-none"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Helper link */}
            <div className="flex items-center justify-between pt-0.5 pb-1">
              <button
                type="button"
                onClick={() => alert('Password Reset instructions sent to: ' + (email || 'your email'))}
                className="text-[11px] sm:text-xs text-gray-500 hover:text-orange-600 transition cursor-pointer"
              >
                Having trouble in sign in?
              </button>
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="text-[11px] sm:text-xs font-semibold text-orange-600 hover:text-orange-700 transition cursor-pointer"
              >
                Use Demo Login
              </button>
            </div>

            {/* Primary Action Button (Warm Amber/Orange styled exactly like reference) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-gray-900 bg-[#fbb066] hover:bg-[#f9a04b] active:scale-[0.99] transition shadow-md shadow-orange-500/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Sign in' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] text-gray-400 font-medium whitespace-nowrap">
              — Or Sign in with —
            </span>
          </div>

          {/* Social Sign In Buttons: Google, Apple ID, Facebook */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Google */}
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer text-xs font-medium text-gray-700"
              title="Sign in with Google"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="hidden sm:inline">Google</span>
            </button>

            {/* Apple ID */}
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer text-xs font-medium text-gray-700"
              title="Sign in with Apple ID"
            >
              <svg className="w-4 h-4 shrink-0 fill-current text-gray-900" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.92.04-2.02.62-2.67 1.37-.56.65-1.06 1.71-.93 2.74 1.03.08 2.07-.51 2.68-1.26z" />
              </svg>
              <span className="hidden sm:inline">Apple ID</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer text-xs font-medium text-gray-700"
              title="Sign in with Facebook"
            >
              <svg className="w-4 h-4 shrink-0 text-[#1877F2] fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span className="hidden sm:inline">Facebook</span>
            </button>
          </div>

          {/* Switch Mode Prompt */}
          <div className="text-center mt-5">
            <p className="text-xs text-gray-500">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                    }}
                    className="text-gray-900 font-semibold hover:text-orange-600 transition underline underline-offset-2 cursor-pointer"
                  >
                    Request Now
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-gray-900 font-semibold hover:text-orange-600 transition underline underline-offset-2 cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="w-full text-center py-4 px-4 text-xs text-gray-400 relative z-20">
        <p>
          Copyright @LeadSpy AI 2026 &nbsp;|&nbsp;{' '}
          <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('LeadSpy Privacy Policy: Leads are securely cached and never shared.'); }} className="hover:text-gray-700 transition">Privacy Policy</a>
          &nbsp;|&nbsp;{' '}
          <a href="#terms" onClick={(e) => { e.preventDefault(); alert('LeadSpy Terms: Free AI Google Maps lead intelligence platform.'); }} className="hover:text-gray-700 transition">Terms of Service</a>
        </p>
      </footer>

    </div>
  );
}

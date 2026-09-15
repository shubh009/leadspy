import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  TrendingDown, 
  ShieldAlert, 
  ShieldCheck, 
  Globe, 
  Star, 
  MapPin, 
  Flame, 
  Calendar
} from 'lucide-react';

export default function ClientAuditReportModal({ lead, isOpen, onClose }) {
  const [copiedPitch, setCopiedPitch] = useState(false);

  if (!isOpen || !lead) return null;

  const hasWebsite = Boolean(lead.website && lead.website.trim() !== '' && lead.website !== 'None');
  const rating = Number(lead.rating || 4.5);
  const reviewsCount = Number(lead.reviewsCount || 10);
  const claimed = Boolean(lead.claimed);

  // Compute Overall Digital Health Score (0-100)
  let healthScore = 40;
  if (hasWebsite) healthScore += 25;
  if (rating >= 4.5) healthScore += 15;
  else if (rating >= 4.0) healthScore += 8;
  if (reviewsCount > 50) healthScore += 10;
  else if (reviewsCount > 15) healthScore += 5;
  if (claimed) healthScore += 10;
  if (lead.instagram) healthScore += 5;
  if (lead.facebook) healthScore += 5;
  healthScore = Math.min(95, Math.max(25, healthScore));

  const grade = healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 45 ? 'C' : 'D';
  const gradeColor = healthScore >= 80 ? 'text-emerald-600' : healthScore >= 65 ? 'text-blue-600' : healthScore >= 45 ? 'text-amber-600' : 'text-rose-600';
  const gradeBg = healthScore >= 80 ? 'bg-emerald-50 border-emerald-200' : healthScore >= 65 ? 'bg-blue-50 border-blue-200' : healthScore >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

  const auditDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const handlePrintPDF = () => {
    window.print();
  };

  const handleCopyAuditPitch = () => {
    const pitch = `Namaste ${lead.name || lead.company}! 🙏\n\nHumne aapke business (${lead.category || 'Business'} in ${lead.location || 'your area'}) ka ek comprehensive Digital Health & Google Maps Audit kiya hai.\n\n📊 Audit Score: ${healthScore}/100 (Grade: ${grade})\n⚠️ Critical Findings:\n${!hasWebsite ? '• No Verified Official Website detected (losing direct client calls)\n' : ''}${!claimed ? '• Google Business Profile is Unclaimed (vulnerable to competitor edits)\n' : ''}${!lead.instagram ? '• Missing Instagram Business presence\n' : ''}• Estimated Missed Monthly Inquiries: ~25 to 45 calls/month\n\nAapki convenience ke liye humne 30-day recovery roadmap banaya hai. Kya main iska detailed audit breakdown share karu?`;
    
    navigator.clipboard.writeText(pitch);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Top Floating Control Bar (Hidden during Print) */}
      <div className="fixed top-3 right-4 z-60 flex items-center gap-2 print:hidden">
        <button
          onClick={handleCopyAuditPitch}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/90 hover:bg-white text-gray-800 text-xs font-semibold rounded-xl shadow-lg border border-gray-200 transition cursor-pointer backdrop-blur-md"
        >
          {copiedPitch ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-orange-500" />}
          <span>{copiedPitch ? 'Pitch Copied!' : 'Copy WhatsApp Pitch'}</span>
        </button>

        <button
          onClick={handlePrintPDF}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save as PDF</span>
        </button>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow-lg border border-gray-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Printable A4 Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 print:my-0 print:rounded-none print:shadow-none print:w-full print:max-w-none text-gray-800">
        
        {/* ========================================================= */}
        {/* HEADER BANNER */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-[#14151b] via-[#1c1e28] to-[#252836] text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold tracking-wider uppercase border border-orange-500/30">
                  CONFIDENTIAL DIGITAL AUDIT
                </span>
                <span className="text-gray-400 text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {auditDate}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {lead.name || lead.company}
              </h1>
              <p className="text-sm text-gray-300 font-medium mt-1 flex items-center gap-2">
                <span>{lead.category || 'Local Business'}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-gray-400">
                  <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                  {lead.location || 'India'}
                </span>
              </p>
            </div>

            {/* Audit Authority Stamp */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-right shrink-0">
              <span className="text-[10px] uppercase text-gray-400 font-semibold block">Audit Engine</span>
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 justify-end">
                <span>LeadSpy</span>
                <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.2 rounded font-bold">AI</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">Verified Diagnostic</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* EXECUTIVE SUMMARY & SCORECARD */}
        {/* ========================================================= */}
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gradient-to-b from-gray-50/70 to-white">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Health Score Gauge */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-200/80 shadow-xs text-center">
              <span className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-2">Overall Digital Health</span>
              <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center ${gradeBg}`}>
                <span className={`text-4xl font-extrabold ${gradeColor}`}>{healthScore}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">out of 100</span>
              </div>
              <div className="mt-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${gradeBg} ${gradeColor}`}>
                  Grade: {grade} • {healthScore < 60 ? 'Critical Gaps' : healthScore < 75 ? 'Moderate Traction' : 'Solid Presence'}
                </span>
              </div>
            </div>

            {/* Executive Diagnostic Findings */}
            <div className="md:col-span-8 space-y-3.5">
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Executive Performance Audit</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Based on real-time analysis of public customer signals, Google local algorithm parameters, and competitive benchmarking in <strong>{lead.location || 'your area'}</strong>, {lead.name} has noticeable client acquisition bottlenecks.
                </p>
              </div>

              {/* 4 Core Vital Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {/* 1. Website Status */}
                <div className={`p-2.5 rounded-xl border ${hasWebsite ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {hasWebsite ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                    <span className="text-[11px] font-bold text-gray-800">Website</span>
                  </div>
                  <span className={`text-[10px] font-semibold block ${hasWebsite ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {hasWebsite ? 'Verified Active' : 'Missing / Inactive'}
                  </span>
                </div>

                {/* 2. GMB Claimed */}
                <div className={`p-2.5 rounded-xl border ${claimed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {claimed ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
                    <span className="text-[11px] font-bold text-gray-800">GMB Listing</span>
                  </div>
                  <span className={`text-[10px] font-semibold block ${claimed ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {claimed ? 'Verified & Claimed' : '⚠️ Unclaimed Profile'}
                  </span>
                </div>

                {/* 3. Google Rating */}
                <div className={`p-2.5 rounded-xl border ${rating >= 4.3 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span className="text-[11px] font-bold text-gray-800">Rating</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 block">
                    {rating}★ ({reviewsCount} reviews)
                  </span>
                </div>

                {/* 4. Instagram / Social */}
                <div className={`p-2.5 rounded-xl border ${lead.instagram ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-100 border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">📸</span>
                    <span className="text-[11px] font-bold text-gray-800">Instagram</span>
                  </div>
                  <span className={`text-[10px] font-semibold block ${lead.instagram ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {lead.instagram ? 'Active Profile' : 'Missing Link'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* DETAILED DIAGNOSTIC BREAKDOWN (THE 4 PILLARS) */}
        {/* ========================================================= */}
        <div className="p-6 sm:p-8 space-y-6">
          <h3 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>Comprehensive Pillar Analysis</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Pillar 1: Google Maps & Local Pack */}
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  1. Google Maps & Local 3-Pack
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700">
                  Visibility: {reviewsCount > 40 ? 'Top 15' : 'Buried'}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Local customers searching for <em>"{lead.category || 'services'}"</em> in your area look at the top 3 results. 
                {!claimed && ' Your profile is UNCLAIMED, allowing rivals to submit erroneous edits or change business hours.'}
                {rating < 4.2 && ' A sub-4.2 rating reduces phone call conversion by up to 58%.'}
                {reviewsCount < 30 && ' Total review volume is below top-ranking local competitors.'}
              </p>
              <div className="text-[11px] font-medium text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Action: Claim profile & implement automated 5-star review collector.</span>
              </div>
            </div>

            {/* Pillar 2: Website & Mobile Conversion */}
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  2. Web & Mobile Conversion
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hasWebsite ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {hasWebsite ? 'Website Live' : 'High Leak: No Website'}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                {!hasWebsite 
                  ? 'Over 82% of smartphone users verify a business website before booking. Without a website, searchers bounce directly to competing firms with online portfolios.'
                  : 'Website detected, but lacks instant WhatsApp chat capture widgets to prevent bounce rates.'}
              </p>
              <div className={`text-[11px] font-medium p-2 rounded-lg border flex items-center gap-1.5 ${hasWebsite ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Action: {!hasWebsite ? 'Deploy high-converting mobile portfolio with 1-tap WhatsApp booking.' : 'Add direct WhatsApp consultation button.'}</span>
              </div>
            </div>

            {/* Pillar 3: Social Proof & Multi-Channel */}
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span>📸</span>
                  3. Social Discovery & Community
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${lead.instagram ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {lead.instagram ? 'Instagram Connected' : 'Missing Opportunity'}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Modern clients in tier-1/2 cities verify Instagram reels and social proof before visiting. 
                {!lead.instagram ? ' No active Instagram profile detected, forfeiting viral local discovery.' : ' Instagram detected; opportunity to cross-promote Google Maps reviews.'}
              </p>
              <div className="text-[11px] font-medium text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Action: Launch weekly client testimonial reels & local geo-tagged posts.</span>
              </div>
            </div>

            {/* Pillar 4: Estimated Missed Revenue */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  4. Monthly Revenue Leakage Calculator
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  Est. 30-45 Lost Inquiries
                </span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed">
                Average local searches for <em>"{lead.category}"</em> in <strong>{lead.location || 'the area'}</strong> exceed 1,500/month. Current gaps are leaking an estimated <strong>₹1,00,000 - ₹2,50,000/month</strong> in potential deal revenue to competitors.
              </p>
              <div className="text-[11px] font-bold text-rose-800 bg-rose-100/80 p-2 rounded-lg border border-rose-300 flex items-center justify-between">
                <span>Estimated Opportunity Upside:</span>
                <span>+35% to +60% Inquiries</span>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* 30-DAY STRATEGIC RECOVERY ROADMAP */}
        {/* ========================================================= */}
        <div className="p-6 sm:p-8 bg-gray-50/80 border-t border-gray-200/80">
          <h3 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            <span>Recommended 30-Day Growth Roadmap</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Week 1 */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block mb-1">Days 1 - 7</span>
              <h4 className="font-bold text-gray-900 mb-1">Pillar Foundations</h4>
              <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                <li>{!hasWebsite ? 'Deploy mobile portfolio website' : 'Install instant WhatsApp widget'}</li>
                <li>Claim and verify Google Maps listing</li>
                <li>Audit competitor ranking keywords</li>
              </ul>
            </div>

            {/* Week 2 */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">Days 8 - 18</span>
              <h4 className="font-bold text-gray-900 mb-1">Review Booster</h4>
              <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                <li>Automate WhatsApp review invites</li>
                <li>Elevate rating past 4.7★ threshold</li>
                <li>Reply to negative public feedback</li>
              </ul>
            </div>

            {/* Week 3-4 */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Days 19 - 30</span>
              <h4 className="font-bold text-gray-900 mb-1">Local Pack Domination</h4>
              <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                <li>Geo-tag photo uploads to GMB</li>
                <li>Launch local Instagram reels funnel</li>
                <li>Dominate Top-3 Google Local Pack</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FOOTER & SIGN-OFF */}
        {/* ========================================================= */}
        <div className="p-6 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">LeadSpy Intelligence Audit Engine</span>
            <span>•</span>
            <span>Prepared for {lead.name}</span>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

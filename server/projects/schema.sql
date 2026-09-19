-- ================================================================
-- LEADSPY: IT PROJECT DISCOVERY ENGINE SCHEMA
-- ================================================================

-- 1. MASTER PROJECTS TABLE (Public central repository of parsed opportunities)
CREATE TABLE IF NOT EXISTS master_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id TEXT UNIQUE,                     -- Hash of normalized title + author for deduplication
    source TEXT NOT NULL,                         -- 'reddit', 'hackernews', 'linkedin', 'twitter', 'remoteok'
    source_url TEXT UNIQUE NOT NULL,              -- Direct link to original post
    source_post_id TEXT,                          -- Native post ID (e.g. Reddit submission ID)
    
    -- Content & AI Analysis
    title TEXT NOT NULL,
    short_summary TEXT NOT NULL,
    original_description TEXT NOT NULL,
    category TEXT NOT NULL,                       -- 'Web Development', 'Mobile App', 'UI/UX', 'SaaS', 'AI/ML'
    subcategory TEXT,
    skills TEXT[] DEFAULT '{}',                   -- ['React', 'Node.js', 'Tailwind']
    features TEXT[] DEFAULT '{}',                 -- ['Admin Panel', 'Payment Gateway']
    
    -- Client / Author Info
    client_name TEXT,
    client_company TEXT,
    client_company_url TEXT,
    client_username TEXT,
    client_email TEXT,                            -- Extracted email (if public)
    client_phone TEXT,                            -- Extracted phone (if public)
    client_profile_url TEXT,                      -- Link to user profile
    client_contact_method TEXT,                   -- 'email', 'phone', 'public_business_contact', 'public_profile_message', 'public_company_website'
    client_location TEXT,                         -- 'USA', 'UK', 'Delhi NCR', etc.
    
    -- Actionable Contactability & Opportunity Metadata (Section 7, 8, 11 of Change Request)
    has_actionable_contact BOOLEAN DEFAULT true,
    contact_type TEXT DEFAULT 'none',             -- 'email', 'phone', 'public_business_contact', 'public_profile_message', 'public_company_website', 'none'
    contact_value TEXT,                           -- email address, phone number, or verified contact URL
    contactability_score NUMERIC DEFAULT 80,
    rejection_reason TEXT,                        -- e.g. 'EMPLOYMENT', 'NO_ACTIONABLE_CONTACT'
    
    -- Commercial Details
    budget TEXT,                                  -- e.g. '$2,000 - $5,000'
    budget_min NUMERIC,
    budget_max NUMERIC,
    currency TEXT DEFAULT 'USD',
    project_type TEXT,                            -- 'Fixed Price', 'Hourly', 'Contract', 'Agency'
    intent TEXT NOT NULL,                         -- 'Looking for Developer', 'Looking for Agency'
    
    -- Metrics & Freshness
    relevance_score NUMERIC DEFAULT 0,            -- 0 to 100
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active'                  -- 'active', 'expired', 'closed'
);

-- Performance Indexes for Fast Multi-filter & Date queries
CREATE INDEX IF NOT EXISTS idx_master_projects_category ON master_projects(category);
CREATE INDEX IF NOT EXISTS idx_master_projects_posted_at ON master_projects(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_projects_skills ON master_projects USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_master_projects_relevance ON master_projects(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_master_projects_source ON master_projects(source);

-- 2. USER SAVED PROJECTS TABLE (Personal CRM & Outreach pipeline)
CREATE TABLE IF NOT EXISTS user_saved_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,                        -- User identifier / session / auth ID
    project_id UUID REFERENCES master_projects(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'saved',                  -- 'saved', 'contacted', 'in_discussion', 'won', 'lost'
    notes TEXT,
    pitch_draft TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_projects_user ON user_saved_projects(user_id);

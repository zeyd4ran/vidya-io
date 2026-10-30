import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Flame,
  Home,
  Layers3,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Play,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';

const navItems = ['Features', 'Pricing', 'Community', 'Resources', 'About'];
const exams = ['JEE Main', 'JEE Advanced', 'NEET', 'CBSE Boards'];

function VidyaMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 256 256" aria-label="Vidya">
      <path fill="currentColor" d="M0 128C70.692 128 128 185.308 128 256H64c0-35.346-28.654-64-64-64v-64Zm256 64c-35.346 0-64 28.654-64 64h-64c0-70.692 57.308-128 128-128v64ZM128 0c0 70.692-57.308 128-128 128V64c35.346 0 64-28.654 64-64h64Zm64 0c0 35.346 28.654 64 64 64v64C185.308 128 128 70.692 128 0h64Z" />
    </svg>
  );
}

function PrimaryButton({ label = 'Start learning free', onClick }) {
  return (
    <button className="v-primary-button group" onClick={onClick} type="button">
      <Sparkles size={15} strokeWidth={2.2} />
      <span>{label}</span>
      <ChevronRight className="v-button-arrow" size={15} />
    </button>
  );
}

function Eyebrow({ children, tag }) {
  return (
    <div className="v-eyebrow">
      <span className="v-eyebrow-dot" />
      <span>{children}</span>
      {tag && <span className="v-eyebrow-tag">{tag}</span>}
    </div>
  );
}

const courseItems = [
  { icon: 'P', subject: 'Physics', topic: 'Rotational motion', preview: 'AI generated notes ready to review...', time: '9:41 AM', color: '#7f77dd', unread: true },
  { icon: 'S', subject: "Sophia's study group", topic: 'Q3 mock test results', preview: 'You scored 82%, 3 weak areas flagged...', time: '8:12 AM', color: '#f59e0b', unread: true },
  { icon: 'C', subject: 'Chemistry', topic: 'Organic reaction mechanisms', preview: 'Video analyzed into 12 flashcards.', time: 'Yesterday', color: '#f59e0b' },
  { icon: 'V', subject: 'Vidya AI', topic: 'Weekly progress digest', preview: 'You completed 14 hours of focused study...', time: 'Yesterday', color: '#c9c4fb' },
  { icon: 'M', subject: 'Maths', topic: 'Definite integrals', preview: '3 doubts resolved, 1 pending.', time: 'Mon', color: '#00d2ff' },
  { icon: 'C', subject: 'Community', topic: 'New answer on your thread', preview: 'Rohit replied to your calculus question.', time: 'Mon', color: '#10b981' },
];

function DashboardMockup() {
  const [selected, setSelected] = useState(0);
  const item = courseItems[selected];
  const sidebarItems = [
    [Home, 'Home'],
    [BookOpen, 'Courses'],
    [CircleHelp, 'Doubt solver', '2'],
    [ClipboardCheck, 'Test maker'],
    [RotateCcw, 'Revision', '5'],
    [BarChart3, 'Analytics'],
  ];

  return (
    <motion.div
      className="v-dashboard-shell"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="v-window-bar">
        <div className="v-traffic-lights"><i /><i /><i /></div>
        <span>Vidya — Dashboard</span>
        <div className="v-window-spacer" />
      </div>
      <div className="v-dashboard-body">
        <aside className="v-dashboard-sidebar">
          <button className="v-ask-button"><Sparkles size={13} /> Ask Vidya</button>
          <div className="v-sidebar-nav">
            {sidebarItems.map(([Icon, label, count], index) => (
              <button className={`v-sidebar-item ${index === 1 ? 'is-active' : ''}`} key={label}>
                <Icon size={14} /> <span>{label}</span>{count && <b>{count}</b>}
              </button>
            ))}
          </div>
          <div className="v-subjects-label">Subjects</div>
          <div className="v-subject-list">
            {[['Physics', '#7f77dd'], ['Chemistry', '#f59e0b'], ['Maths', '#00d2ff'], ['Biology', '#10b981']].map(([name, color]) => (
              <span key={name}><i style={{ background: color }} />{name}</span>
            ))}
          </div>
        </aside>
        <div className="v-course-list">
          <div className="v-course-search"><Search size={13} /><span>Search topics</span></div>
          {courseItems.map((course, index) => (
            <button
              className={`v-course-item ${selected === index ? 'is-selected' : ''}`}
              key={`${course.subject}-${course.topic}`}
              onClick={() => setSelected(index)}
              type="button"
            >
              <span className="v-course-avatar" style={{ background: `${course.color}28`, color: course.color }}>{course.icon}</span>
              <span className="v-course-copy">
                <strong>{course.subject}</strong>
                <em>{course.topic}</em>
                <small>{course.preview}</small>
              </span>
              <span className="v-course-meta">{course.unread && <i />}{course.time}</span>
            </button>
          ))}
        </div>
        <article className="v-reader">
          <div className="v-reader-toolbar">
            <div />
            <div className="v-reader-actions">
              {[Bookmark, Share2, Archive, Trash2].map((Icon, index) => <button key={index} type="button" aria-label="Reader action"><Icon size={13} /></button>)}
              <button type="button" aria-label="More"><MoreHorizontal size={14} /></button>
            </div>
          </div>
          <div className="v-reader-heading">
            <span className="v-reader-subject-avatar">P</span>
            <div><h3>{item.topic}</h3><p>{item.subject} <span>·</span> Updated · {item.time}</p></div>
            <span className="v-weak-pill">Weak area</span>
          </div>
          <div className="v-summary-card">
            <div className="v-summary-title"><Sparkles size={14} /> Summary by Vidya</div>
            <p>This topic covers torque, angular momentum and moment of inertia. You&apos;ve missed 2 similar questions before — review the worked examples below first.</p>
          </div>
          <div className="v-reader-copy">
            <strong>Key concept</strong>
            <p>Torque is the rotational equivalent of force. It determines how much a force acting on an object causes that object to rotate.</p>
            <p>Angular momentum is conserved in a closed system, which is why this topic pairs closely with collision problems in your syllabus.</p>
            <p>Try the practice set below, then ask Vidya if anything doesn&apos;t click.</p>
            <span className="v-ai-signoff">— Vidya AI</span>
          </div>
          <div className="v-attachment"><Paperclip size={13} /> rotational-motion-notes.pdf</div>
        </article>
      </div>
    </motion.div>
  );
}

function RevisionCard() {
  const rows = [
    ['Weak topics', '4', ['Rotational motion — Physics', 'Organic mechanisms — Chemistry'], '#fff'],
    ['Due for revision', '9', ['Definite integrals — Maths', 'Cell division — Biology'], '#e5e5e5'],
    ['Mastered', '21', ['Thermodynamics · Kinematics · Algebra'], '#a3a3a3'],
    ['Bookmarked', '7', ['Doubt thread · Mock test · Formula sheet'], '#525252'],
  ];
  return (
    <motion.div
      className="v-revision-card liquid-glass"
      initial={{ opacity: 0, x: 18 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="v-revision-top"><span>Today · 38 topics reviewed</span><ArrowUpRight size={15} /></div>
      <div className="v-revision-rows">
        {rows.map(([title, count, items, color]) => (
          <div className="v-revision-row liquid-glass" key={title}>
            <div className="v-revision-row-head"><span style={{ color }}>{title}</span><b>{count}</b></div>
            {items.map(text => <p key={text}><i style={{ background: color }} />{text}</p>)}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  const plans = [
    { name: 'Free', price: 'Free', desc: 'For students getting started with AI-guided prep.', features: ['3 active courses', 'Basic doubt solver (10/day)', 'Auto-generated notes', 'Access via web and mobile'] },
    { name: 'Plus', price: yearly ? '₹2,999/y' : '₹299/m', desc: 'For students who want a full personalized study loop.', features: ['Unlimited courses', 'Unlimited doubt solver', 'Adaptive test maker', 'Weakness detection and revision queue', 'Study rooms access'] },
    { name: 'Pro', price: yearly ? '₹5,999/y' : '₹599/m', desc: 'For serious aspirants aiming for top ranks.', features: ['Everything in Plus', 'Priority AI response speed', 'Advanced analytics and rank prediction', '1:1 mentor check-ins', 'Offline download for notes'], pro: true },
  ];
  return (
    <section className="v-pricing-section" id="pricing">
      <svg className="v-noise-svg" aria-hidden="true"><filter id="v-noise-pricing"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" stitchTiles="stitch" /><feComponentTransfer><feFuncA type="linear" slope="0.075" /></feComponentTransfer><feComposite in2="SourceGraphic" operator="in" result="noise" /><feBlend in="SourceGraphic" in2="noise" mode="overlay" /></filter></svg>
      <div className="v-watermark-container"><div className="v-watermark-main"><span className="v-watermark-line-1">Your prep.</span><span className="v-watermark-line-2">Mastered</span></div></div>
      <div className="v-grid">
        {plans.map(plan => (
          <div className={`v-card ${plan.pro ? 'v-card-pro' : ''}`} key={plan.name}>
            <span className="v-tier-small">{plan.name}</span>
            <strong className="v-tier-large">{plan.price}</strong>
            <p className="v-desc">{plan.desc}</p>
            <ul className="v-list">{plan.features.map(feature => <li key={feature}><span className="v-check"><Check size={14} /></span><span>{feature}</span></li>)}</ul>
            <button className="v-btn" type="button">Choose plan</button>
          </div>
        ))}
      </div>
      <div className="v-toggle-wrap"><span>Yearly <small>save 2 months</small></span><button className={`v-toggle ${yearly ? 'active' : ''}`} onClick={() => setYearly(value => !value)} aria-label="Toggle yearly pricing" type="button"><span className="v-toggle-knob" /></button></div>
    </section>
  );
}

export default function LandingPage({ onStartLearning }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const goTo = (id) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="vidya-landing">
      <svg className="v-noise-svg" aria-hidden="true"><filter id="v-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" /><feComposite in2="SourceGraphic" operator="in" result="noise" /><feBlend in="SourceGraphic" in2="noise" mode="multiply" /></filter></svg>
      <div className="v-video-layer">
        <video autoPlay loop muted playsInline preload="auto" aria-hidden="true">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" />
          <source src="/assets/hero-loop.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="v-guide v-guide-left" /><div className="v-guide v-guide-right" />

      <header className="v-navbar">
        <div className="v-nav-inner">
          <button className="v-logo-button" onClick={() => goTo('top')} type="button" aria-label="Back to top"><VidyaMark className="v-mark" /></button>
          <nav className="v-nav-links">{navItems.map((item, index) => <motion.button key={item} onClick={() => goTo(item.toLowerCase())} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.05 }} type="button">{item}</motion.button>)}</nav>
          <div className="v-nav-actions"><PrimaryButton onClick={onStartLearning} /><button className="v-menu-button" onClick={() => setMobileMenuOpen(value => !value)} type="button" aria-label="Open menu">{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button></div>
        </div>
        <AnimatePresence>{mobileMenuOpen && <motion.div className="v-mobile-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{navItems.map(item => <button key={item} onClick={() => goTo(item.toLowerCase())} type="button">{item}<ChevronRight size={14} /></button>)}<PrimaryButton onClick={onStartLearning} /></motion.div>}</AnimatePresence>
      </header>

      <main id="top">
        <section className="v-hero">
          <motion.div className="v-hero-content" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Eyebrow tag="For JEE & NEET aspirants">AI-native learning</Eyebrow>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>Your prep.<br /><span className="v-shiny-text">Mastered</span></motion.h1>
            <motion.p className="v-hero-copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>Vidya is the AI learning companion for JEE and NEET aspirants. It curates lectures, solves doubts, tests you, and tells you exactly what to revise next.</motion.p>
            <div className="v-hero-actions"><PrimaryButton onClick={onStartLearning} /><span>Free forever plan available</span></div>
          </motion.div>
        </section>

        <motion.div className="v-app-strip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          <div className="v-app-strip-inner"><span className="v-app-brand"><VidyaMark /> <b>Vidya</b></span><div className="v-app-nav">{['Dashboard', 'Courses', 'Doubts', 'Tests', 'Community'].map((item, index) => <span className={`${index > 2 ? 'hide-sm' : ''} ${index > 3 ? 'hide-md' : ''}`} key={item}>{item}</span>)}</div><span className="v-streak"><Flame size={14} /> 12 day streak</span></div>
        </motion.div>

        <section className="v-dashboard-section"><DashboardMockup /></section>

        <section className="v-feature-section" id="features">
          <motion.div className="v-feature-copy" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7 }}><Eyebrow tag="AI-native">Revision</Eyebrow><h2>Know exactly what<br />to study next<span>.</span></h2><p>Vidya reads every test, note, and doubt you&apos;ve logged, and turns it into a single prioritized revision queue. No more guessing what to open next.</p><div className="v-chips">{['Auto-flag weak topics', 'Spaced revision', 'Formula flashcards', 'One-tap re-test'].map(chip => <span key={chip}>{chip}</span>)}</div></motion.div>
          <RevisionCard />
        </section>

        <section className="v-exam-cloud" id="resources"><p>Built for the exams that matter most</p><div>{exams.map((exam, index) => <motion.span key={exam} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }}>{exam}</motion.span>)}</div></section>

        <section className="v-testimonials" id="community"><div className="v-testimonials-grid">{[['I stopped bouncing between five apps. Vidya just tells me what’s next and why.', 'Riya A.', 'NEET aspirant'], ['The doubt solver actually explains the steps instead of just giving the answer.', 'Karan V.', 'JEE aspirant'], ['Seeing my weak topics laid out cut my revision time in half.', 'Sara P.', 'JEE aspirant']].map(([quote, name, role]) => <figure className="v-testimonial liquid-glass" key={name}><blockquote>“{quote}”</blockquote><figcaption><strong>{name}</strong><span>{role}</span></figcaption></figure>)}</div></section>

        <Pricing />

        <section className="v-final-section" id="about"><div className="v-final-cta liquid-glass"><div className="v-final-glow" /><div className="v-final-content"><h2>Stop guessing.<br /><span>Start mastering.</span></h2><p>Join thousands of JEE and NEET aspirants who let Vidya plan the next study session for them.</p><div className="v-final-actions"><PrimaryButton onClick={onStartLearning} /><button className="v-talk-button" onClick={() => window.alert('We’ll be in touch soon.')} type="button">Talk to us <ChevronRight size={15} /></button></div></div></div></section>
      </main>
    </div>
  );
}
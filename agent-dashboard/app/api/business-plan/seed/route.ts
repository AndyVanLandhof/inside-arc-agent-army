import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { validatePassword } from '@/app/lib/db';

const INITIAL_SECTIONS = [
  {
    section_key: 'vision',
    title: 'Vision & Mission',
    sort_order: 1,
    content: `Inside Arc was founded by Andy Land, Gideon Clifton, and Gary Munro with a shared belief: that expert-level sports coaching should be accessible to everyone — not just those who can afford a personal coach or live near a training academy.

Our mission is to create the world's most intelligent AI coaching platform, starting with golf. Our first product, Jaime™, is a voice-first AI golf coach that combines real-time computer vision, ball flight tracking, and natural conversation to give every golfer the experience of practising with a top coach.

We believe the best coaching starts with listening, not looking at a screen. Jaime is designed to keep the player in motion, in flow, and improving — hands-free, voice-first, and always personal.

Inside Arc is a platform play. Golf is our beachhead, but the technology — real-time biomechanical analysis, voice coaching, and adaptive learning — scales across every sport where movement matters.

### Meet Jaime — The Brand

Jaime came from Scotland. So did golf.

Named in honour of the Gaelic tradition of personal guidance — a Jaime was a companion, a trusted advisor who walked alongside you — our AI coach carries that same spirit into modern golf.

Jaime wears a tartan scarf because golf has always been Scottish at heart. The warmth of the scarf represents the warmth of personal coaching — not cold technology, but a companion who knows your game, remembers your goals, and helps you get better every time you practise.

Jaime speaks with a Scottish accent. Jaime remembers your last session. Jaime knows when to coach and when to let you find your rhythm. Jaime is patient, encouraging, and direct — just like the best coaches.

### Our North Stars

Five principles that guide everything we build:

1. **Voice-first, always** — The player never needs to touch their phone
2. **Coach-validated** — Every instruction approved by Gary Munro
3. **Real-time, not replay** — Feedback during the session, not after
4. **Personal, not generic** — Coaching adapts to the individual
5. **Platform, not product** — Built to scale across sports

*Source: Inside Arc Executive Summary, November 2025 v6.*`,
  },
  {
    section_key: 'problem',
    title: 'The Problem Every Golfer Knows',
    sort_order: 2,
    content: `85% of golfers never take a professional lesson. That's over a million serious players in the UK alone, hitting balls on driving ranges with no expert feedback, no structured practice plan, and no clear path to improvement.

**Why?** Because traditional coaching doesn't match how golfers actually practise:

- **Lessons are expensive** (£40–80/hour) and require scheduling weeks in advance
- **Most golfers practise alone** — there's no one watching
- **Improvement is slow and invisible** — without data, golfers can't see progress
- **Existing apps require you to stop and look at a screen** between every shot

The result: millions of golfers stuck at the same handicap for years, spending thousands on equipment when what they actually need is expert coaching during practice.

The problem isn't motivation. Golfers want to improve. The problem is access. Expert coaching has always been limited by geography, availability, and cost.

Inside Arc solves this with AI that coaches in real-time, using voice, so the golfer never has to break their natural flow.

### Traditional App vs Jaime

**Traditional App:**
1. Hit a shot
2. Stop
3. Pick up phone
4. Open app
5. Watch video replay
6. Read annotations
7. Try to remember the instruction
8. Put phone down
9. Hit another shot
10. Repeat

**Jaime:**
1. Hit a shot
2. Jaime analyses in real-time
3. Jaime delivers a voice coaching cue
4. Hit your next shot
5. Keep improving

The difference isn't incremental — it's transformational. Jaime keeps the player in flow state, in motion, improving. Every other app breaks that flow.

Voice-first isn't a feature. It's the fundamental rethinking of how AI coaching should work.

*Source: Inside Arc Executive Summary, November 2025 v6.*`,
  },
  {
    section_key: 'product',
    title: 'Product — Meet Jaime',
    sort_order: 3,
    content: `Jaime is the world's first voice-first AI golf coach. Combining real-time computer vision, ball flight tracking, and natural voice conversation, Jaime gives every golfer the experience of practising with a top coach — without the cost, scheduling, or availability constraints.

### How Jaime Coaches

- **Watches your swing** using on-device computer vision (33 body keypoints at 30fps)
- **Tracks ball flight** using CV-based detection (no external hardware)
- **Analyses each shot** in real-time (sub-500ms processing)
- **Delivers focused, timed coaching cues** via voice between shots
- **Adapts** to your skill level, goals, and patterns over time
- **Remembers** your previous sessions and tracks your progress

### What Makes Jaime Different From Every Other Golf App

- **Voice-first:** coaching is delivered through natural conversation, not on-screen annotations
- **Real-time:** analysis happens during the session, not from post-session video
- **All-in-one:** swing analysis, ball tracking, and coaching in a single app
- **No extra hardware:** works with just your phone on a tripod
- **Coach-validated:** every coaching model approved by Gary Munro (PGA, UK Top 50)

### Three Modes, One Seamless Experience

**JAIME RANGE — Practice Coaching**
Set up your phone on the tripod, tell Jaime what you want to work on, and start hitting.
- Real-time swing analysis with voice feedback
- Ball flight tracking and shot statistics
- Structured drill sessions based on your goals
- Session summary with key metrics and improvements
- Progress tracking across sessions

**JAIME CHAT — Conversational Coaching**
Talk to Jaime anytime about your game, strategy, or goals.
- Golf knowledge and strategy advice
- Pre-round preparation
- Equipment guidance
- Rules and etiquette
- Powered by conversational AI with golf-specific training

**JAIME CADDY — On-Course Intelligence**
Take Jaime to the course for real-time strategy and club selection.
- GPS-based course mapping
- Club recommendation based on your shot patterns
- Wind and conditions adjustment
- Competition mode (R&A rules compliant)
- Post-round analysis and scoring

Each mode feeds data into Jaime's adaptive learning system, so coaching gets smarter every time you play.

### Pricing

- **Jaime Range:** £14.99/month (£149/year)
- **Jaime Range + Caddy:** £24.99/month (£249/year)
- Value anchor: "Costs less than 3 rounds of golf" / "1/3 the price of a new driver for actual improvement"

**UK launch: Q2 2026. iOS first. Pilot programme with 8–12 golf clubs.**

*Source: Inside Arc Executive Summary, November 2025 v6.*`,
  },
  {
    section_key: 'technology',
    title: 'The Technology Behind Jaime',
    sort_order: 4,
    content: `Inside Arc's technology platform combines four capabilities:

### 1. Real-time Computer Vision

On-device processing using Apple Vision framework and custom ML models. Tracks 33 body keypoints at 30fps through the golf swing. Sub-500ms processing ensures coaching can be delivered between shots. All processing happens on-device — no cloud latency, no privacy concerns.

### 2. Ball Flight Tracking

CV-based trajectory detection from the phone camera. Detects launch angle, curve direction, and approximate distance. Unique capability — no competitor tracks ball flight without a launch monitor or external radar. Works alongside swing analysis from the same camera feed.

### 3. Voice Coaching Engine

Hybrid system combining pre-recorded phrase packs (recorded by Gary Munro) and dynamic AI-generated speech (ElevenLabs TTS matched to Gary's voice). Designed to deliver natural, varied coaching that doesn't repeat or feel robotic. Scottish accent, warm and direct tone.

### 4. Adaptive Learning System

Machine learning models that track patterns across sessions: which faults recur, which drills are most effective, how the player responds to different coaching styles. Over time, Jaime becomes a genuinely personalised coach — it knows your game.

### Why Now? The Technology Moment Has Arrived

Three technology breakthroughs have converged to make voice-first AI coaching possible for the first time:

**1. On-Device Machine Learning**
Apple's Neural Engine and frameworks like Vision and CoreML now allow complex pose estimation and object detection at 30fps — entirely on-device. Two years ago, this required cloud processing with unacceptable latency.

**2. Voice AI Quality**
Text-to-speech has crossed the quality threshold. Services like ElevenLabs can clone a specific voice with natural intonation, emotion, and variation. For the first time, AI-generated coaching doesn't sound robotic.

**3. Conversational AI**
Large language models (Claude, GPT) can now maintain context, remember preferences, and engage in natural coaching conversations. Combined with sport-specific training, this enables genuinely adaptive coaching.

### Why No One Has Done This Before

- The technology wasn't ready (real-time on-device CV is 18 months old)
- Voice AI wasn't good enough (ElevenLabs launched voice cloning in 2023)
- The combination — CV + voice + adaptive learning — requires multi-disciplinary expertise that traditional golf companies don't have

Inside Arc is built by a team that spans AI, investment, and elite golf coaching. We're building at the intersection.

**Key technical constraint:** iOS first (Apple Vision, SceneKit). Android to follow.

*Source: Inside Arc Executive Summary, November 2025 v6. Architecture led by Tommy.*`,
  },
  {
    section_key: 'market',
    title: 'Market Opportunity',
    sort_order: 5,
    content: `### Beachhead to Multi-Sport Platform

Inside Arc starts with golf but is designed as a platform. The core technology — computer vision, voice coaching, and adaptive learning — transfers across any sport where biomechanics and movement matter.

Each new sport shares approximately 70% of the technology stack. Only the biomechanical models, training data, and coaching content need to be sport-specific.

Near-term expansion targets: tennis (7.9M UK players), padel (fastest-growing racquet sport in Europe), and cricket. The multi-sport platform significantly expands the addressable market from ~£200M (UK golf) to £1B+ (multi-sport, multi-geography).

### UK Golf (Beachhead — Q2 2026)

- 5.6M total UK golfers
- 1.2–1.8M "serious" golfers (10–25 handicap, 20+ rounds/year)
- 85% never take professional lessons
- Addressable market: ~£200M TAM at current pricing
- Target: 3–5% penetration = 50,000–80,000 paying subscribers

### US Golf (Expansion — 2027)

- 28M golfers (5x UK market)
- Same structural problem (most practise alone)
- Significantly larger addressable market

### Tennis (Platform Expansion — 2027+)

- 7.9M UK players (5x golf market alone)
- Same voice-first coaching thesis applies
- Shared technology stack reduces development cost

### Multi-Sport Economics

- Golf only ARR at scale: £6–9.6M
- Tennis alone is 5x the UK golf market
- Multi-sport, multi-geography: £50M+ TAM potential

*Source: Inside Arc Executive Summary, November 2025 v6. Connie tracking competitive landscape for changes.*`,
  },
  {
    section_key: 'competitive',
    title: 'Competitive Landscape',
    sort_order: 6,
    content: `### Competitive Differentiation

No competitor combines real-time voice coaching with swing analysis and ball flight tracking in a single product.

| Competitor | Price | Swing CV | Voice | Ball Tracking | Real-time | Threat |
|-----------|-------|----------|-------|---------------|-----------|--------|
| Sportsbox AI | ~$25/mo | Strong (3D) | No | No | No | HIGH |
| Mustard | ~$15/mo | Good | No | No | No | MEDIUM |
| Sparrow | ~$18/mo | Basic | No | No | No | LOW |
| V1 Golf | Varies | Video analysis | No | No | No | MEDIUM |
| Swee | ~$12/mo | Basic | No | No | No | LOW |

**Key threat:** Sportsbox AI has the best CV tech. If they add voice or partner with a launch monitor, they become formidable. We need to establish the "voice coaching" category before they move.

### What Makes Jaime Different — Four Things No Competitor Offers

**1. Voice-First Coaching**
Jaime is the only golf app that coaches through natural voice conversation. Every competitor relies on on-screen annotations, text overlays, or video playback. Jaime keeps you in flow.

**2. Real-Time Ball Flight Tracking (No Hardware)**
Jaime tracks ball flight using computer vision alone — no launch monitor, no radar, no sensors. Just your phone camera. No competitor offers this.

**3. Integrated Coaching Intelligence**
Jaime doesn't just show you what happened — it tells you what to change. Every coaching instruction is validated by a PGA professional (Gary Munro, UK Top 50) and delivered at the right moment.

**4. One Platform, Every Sport**
Inside Arc is designed as a platform from day one. The same technology scales to tennis, padel, cricket, and beyond. Competitors are single-sport apps that would need to rebuild from scratch.

### The Compounding Moat

Inside Arc's advantages compound over time:

- **Data flywheel:** every swing improves the model
- **Voice library:** coaching content grows and improves with use
- **Coach validation:** Gary Munro ensures quality that competitors can't replicate quickly
- **Platform leverage:** each new sport strengthens the entire platform
- **Community and retention:** golfers who improve stay and evangelize

**Our pricing position:** £14.99 sits between budget (Swee) and premium (Sportsbox). Best value for serious improvement.

*Source: Inside Arc Executive Summary, November 2025 v6. Connie maintains ongoing competitive monitoring.*`,
  },
  {
    section_key: 'financials',
    title: 'Financial Strategy & Targets',
    sort_order: 7,
    content: `### Conservative Estimates Based on UK Golf Market Only

- **Target:** 50,000–80,000 paying subscribers (3–5% penetration of serious UK golfers)
- **ARR at scale:** £6–9.6M (golf only)
- **Multi-sport platform** expands TAM significantly: tennis alone is 5x the UK golf market

### Pricing

- Jaime Range: £14.99/month (£149/year)
- Range + Caddy: £24.99/month (£249/year)
- Value anchor: "Costs less than 3 rounds of golf" / "1/3 the price of a new driver for actual improvement"

### Unit Economics

- **CAC target:** £30–50 (blended across channels)
- **LTV:** £300–500 (12–24 month retention)
- **LTV:CAC ratio:** 6–10x
- **Payback period:** 2–4 months
- **Monthly churn target:** <10%
- **Variable cost per user:** ~30% of revenue (AI processing, hosting)

### Break-Even

~2,500 paying subscribers (Month 18–20). This is the critical gate before Series A.

### Funding Strategy

- **Initial phase:** funded by founders (£500K–750K)
- **Series A target:** when unit economics are proven
- **Series A valuation target:** £25M pre-money

### Long-Term

50–80K UK users = £6–9.6M ARR from golf alone. Multi-sport platform significantly expands this to potentially £50M+ across sports.

*Source: Inside Arc Executive Summary, November 2025 v6. Frank maintains detailed financial models.*`,
  },
  {
    section_key: 'gtm',
    title: 'Go-to-Market',
    sort_order: 8,
    content: `### Launch Strategy

**Launch:** Q2 2026, UK only. iOS first.

**Pilot programme:** 8–12 golf clubs, 500–1,000 beta users (Ulrik designing research framework).

### Channel Strategy

1. **Golf club partnerships** (lowest CAC, highest trust) — revenue share model
2. **PGA network / coaching professionals** (Gary Munro's network)
3. **Simulator studios and driving ranges** (natural placement)
4. **Performance marketing** (Meta, Google — targeting serious golfers)
5. **App Store optimisation**

### Brand Positioning

Scottish heritage, voice-first, personal, emotive. "Jaime came from Scotland. So did golf."

Not another cold tech company — warm, human, credible. The tartan scarf represents the warmth of personal coaching.

### Social Strategy

Instagram (primary), TikTok, LinkedIn. Content pillars: technique/drills, transformation stories, behind-the-scenes, community. Building audience pre-launch.

### Key Metric Targets

- **CAC:** £30–50
- **NPS:** 50+
- **D30 retention:** 70%+

*Source: Inside Arc Executive Summary, November 2025 v6. Grace leads GTM strategy. Suzie on social/community. Pre-launch activity in progress.*`,
  },
  {
    section_key: 'team',
    title: 'Team',
    sort_order: 9,
    content: `### Founders

**Andy Land — CEO**
Partner at Hg (Europe's largest tech-focused private equity investor). Silicon Valley AI experience. Deep understanding of SaaS metrics, scaling, and what world-class technology businesses look like.

**Gideon Clifton — CTO**
Technology consultancy background. Leading platform architecture and technical delivery.

**Gary Munro — Golf Director**
PGA Professional, UK Top 50 Coach. Provides coaching methodology and validation. Every coaching instruction in Jaime is approved by Gary.

### Why This Team

Inside Arc is built by a team that spans AI, investment, and elite golf coaching. We're building at the intersection — a combination of expertise that traditional golf companies don't have and tech companies can't easily replicate.

### Advisory / Extended Team

Being built out. Key hires needed in ML engineering and mobile development for Q1 2026.

*Source: Inside Arc Executive Summary, November 2025 v6. Team section to be expanded as hiring progresses.*`,
  },
  {
    section_key: 'roadmap',
    title: 'Product Roadmap',
    sort_order: 10,
    content: `### Timeline

**2025 Q4:** Product development, coaching content recording with Gary Munro, CV model training

**2026 Q1:** Beta build, tripod prototype finalisation, pilot club partnerships signed

**2026 Q2:** UK launch (Jaime Range), pilot programme with 8–12 clubs, 500–1,000 beta users

**2026 Q3–Q4:** Iterate based on pilot data, Jaime Caddy upgrade, scale marketing

**2027 H1:** US expansion, tennis/padel development begins

**2027 H2:** Multi-sport platform launch

### Key Milestones

- **2,500 paying users** → break-even (Month 18–20)
- **NPS 50+** and **D30 retention 70%+** → validates product-market fit
- **Series A readiness** → requires proven unit economics + growth trajectory

### Product Tiers

**Jaime Range — £14.99/month**
Core practice coaching: real-time swing analysis, ball flight tracking, voice coaching, adaptive drills, session tracking, and progress monitoring. Everything a golfer needs to improve on the driving range.

**Jaime Range + Caddy — £24.99/month**
Everything in Range, plus on-course intelligence: club selection advice, course management strategy, competition mode (R&A compliant), and post-round analysis. A complete golf coaching companion from range to course.

*Source: Inside Arc Executive Summary, November 2025 v6. Pete maintains product roadmap. Timeline subject to pilot learnings.*`,
  },
  {
    section_key: 'hardware',
    title: 'Hardware — Tripod System',
    sort_order: 11,
    content: `### Custom Phone Mount / Tripod

Shipped to premium users for consistent swing recording during range sessions.

### Requirements

- Setup in under 30 seconds on a driving range
- Stable enough for consistent CV tracking (no wobble)
- Survives outdoor conditions (wind, rain, grass, mats)
- Premium look and feel (aluminium/carbon, not plastic)
- Lightweight and portable (fits in golf bag)
- Target BOM: under £40, retail under £79

### Status

Design phase. Harry leading form factor, materials selection, and manufacturer sourcing (likely Shenzhen/Dongguan for production). Working with Tommy on phone positioning requirements for CV accuracy.

### Open Questions

- MagSafe vs universal clamp
- Single vs dual angle adjustment
- Packaging/unboxing design

*New workstream since October 2025. Harry leading.*`,
  },
  {
    section_key: 'platform',
    title: 'Platform Vision',
    sort_order: 12,
    content: `### Inside Arc Is a Platform, Not a Single-Sport App

The architecture is designed so each new sport shares approximately 70% of the infrastructure:

**Shared (~70%):**
- Computer vision engine (retrain for sport-specific biomechanics)
- Voice coaching system (new content, same delivery infrastructure)
- Adaptive learning system
- User data pipeline and analytics
- Subscription and billing
- Mobile app framework

**Sport-specific (~30%):**
- Biomechanical models (golf swing vs tennis serve vs padel stroke)
- Training data and coaching content
- Sport-specific UI elements
- Partner/federation relationships

### Expansion Roadmap

- **Tennis (2027):** 7.9M UK players, natural voice-coaching fit
- **Padel (2027–28):** Fastest-growing racquet sport in Europe
- **Baseball/Cricket (2028+):** Large markets, same CV thesis

### Platform Economics

Each sport added increases TAM without proportional cost. This is the venture-scale story — from £6–9.6M ARR in golf to potentially £50M+ across sports.

### The Inside Arc Platform — Four Capabilities

Inside Arc is building a four-capability coaching engine that underpins every sport:

1. **Real-time Swing Analysis** — On-device computer vision tracking 33 body keypoints at 30fps
2. **Intelligent Ball Flight Tracking** — CV-based trajectory detection without external hardware
3. **Voice-First Coaching** — Natural, conversational coaching delivered between shots
4. **Adaptive Learning System** — Personalised coaching that evolves with every session

*Source: Inside Arc Executive Summary, November 2025 v6. Platform thesis unchanged since founding. Validated by Tommy's architecture work.*`,
  },
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password, force } = body;

  if (!password || !validatePassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // If force=true, delete existing data to allow re-seeding
  if (force) {
    await sql`DELETE FROM business_plan_snapshots`;
    await sql`DELETE FROM business_plan_sections`;
  }

  // Insert sections (skip if they already exist)
  let inserted = 0;
  for (const s of INITIAL_SECTIONS) {
    const existing = await sql`SELECT id FROM business_plan_sections WHERE section_key = ${s.section_key}`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO business_plan_sections (section_key, title, content, sort_order, updated_by)
        VALUES (${s.section_key}, ${s.title}, ${s.content}, ${s.sort_order}, ${'November 2025 v6 Exec Summary'})
      `;
      inserted++;
    }
  }

  // Create initial snapshot
  const sections = await sql`SELECT * FROM business_plan_sections ORDER BY sort_order`;
  const fullContent = sections
    .map((s: Record<string, string>) => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n');
  await sql`
    INSERT INTO business_plan_snapshots (full_content, changes_summary)
    VALUES (${fullContent}, ${'Seeded from Inside Arc Executive Summary — November 2025 v6'})
  `;

  return NextResponse.json({ success: true, inserted, total: INITIAL_SECTIONS.length });
}

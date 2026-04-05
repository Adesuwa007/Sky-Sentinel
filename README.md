
<p align="center">
  <strong>⬡</strong>
</p>

<h1 align="center">SkySentinel</h1>

<p align="center">
  <em>AI-Powered Drone Disaster Response & Digital Twin Simulation</em>
</p>

<p align="center">
  <code>Version 1.0</code>&nbsp;&nbsp;·&nbsp;&nbsp;<code>April 2026</code>
</p>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Solution — SkySentinel](#3-proposed-solution--skysentinel)
4. [System Architecture](#4-system-architecture)
5. [Step-by-Step Mission Workflow](#5-step-by-step-mission-workflow)
6. [Key Features](#6-key-features)
   - [6.1 — 3D Digital Twin Environment](#61--3d-digital-twin-environment)
   - [6.2 — LiDAR Scanning Simulation](#62--lidar-scanning-simulation)
   - [6.3 — Thermal Vision Mode](#63--thermal-vision-mode)
   - [6.4 — AI-Powered Escape Route Generation (A*)](#64--ai-powered-escape-route-generation-a)
   - [6.5 — Procedural Scenario Generation](#65--procedural-scenario-generation)
   - [6.6 — Drone Swarm Coordination](#66--drone-swarm-coordination)
   - [6.7 — First-Person Drone Flight (FPV)](#67--first-person-drone-flight-fpv)
   - [6.8 — AI Mission Analysis Engine](#68--ai-mission-analysis-engine)
   - [6.9 — Augmented Reality (AR) Mode](#69--augmented-reality-ar-mode)
   - [6.10 — Adaptive Mobile Optimization](#610--adaptive-mobile-optimization)
   - [6.11 — Cinematic Visual Effects](#611--cinematic-visual-effects)
7. [Technology Stack](#7-technology-stack)
8. [Recent Improvements & Updates](#8-recent-improvements--updates)
9. [Future Work](#9-future-work)
10. [Conclusion](#10-conclusion)

---

## 1. Executive Summary

**SkySentinel** is an AI-powered drone simulation system designed to revolutionize disaster response. It deploys a virtual drone into a realistic 3D disaster zone, scans the terrain with simulated LiDAR and thermal imaging, detects trapped survivors using computer vision techniques, generates optimal escape routes using the A* pathfinding algorithm, and presents everything through a stunning real-time web dashboard with augmented reality support. The entire system runs in a browser — no installation required — making it instantly accessible to first responders, disaster management teams, and decision-makers anywhere in the world.

---

## 2. Problem Statement

### The Challenge

When a natural disaster strikes — an earthquake, flood, or fire — **the first 72 hours are critical**. During this golden window, the difference between life and death depends on how quickly rescue teams can:

- **Locate survivors** trapped under rubble or hidden from view
- **Understand the terrain** — where it's safe and where it's dangerous
- **Plan the fastest, safest route** to reach survivors and evacuate them

### The Reality Today

Traditional disaster response relies heavily on human scouts venturing into unstable, life-threatening environments. This approach is:

| Problem | Impact |
|---|---|
| **Slow** | Manually searching a disaster zone can take hours or days |
| **Dangerous** | Rescue workers risk their own lives in unstable structures |
| **Incomplete** | Human eyes cannot see through rubble, smoke, or darkness |
| **Uncoordinated** | Without a bird's-eye view, teams often duplicate effort or miss areas entirely |

> [!IMPORTANT]
> According to the United Nations Office for Disaster Risk Reduction, natural disasters affect an average of **350 million people annually**. Speed of response directly correlates with lives saved.

### What's Missing

There is a critical gap between **disaster occurrence** and **coordinated rescue action**. What responders need is an intelligent system that can instantly map the disaster zone, find survivors — even those hidden from view — and generate optimal rescue plans, all without putting additional lives at risk.

---

## 3. Proposed Solution — SkySentinel

**SkySentinel** bridges that gap with a complete AI-driven disaster response simulation platform.

### What It Does (In Simple Terms)

Imagine sending a **smart drone** into a disaster zone. As it flies over the area, it:

1. 🗺️ **Builds a live 3D map** of the entire disaster zone (a "Digital Twin")
2. 🔍 **Scans for survivors** using laser scanning (LiDAR) and heat detection (thermal imaging)
3. 🧠 **Analyzes the situation** — prioritizing who needs help first based on health status
4. 🛤️ **Calculates the safest escape routes** around fires, collapsed structures, and floods
5. 📊 **Generates a full mission report** with risk assessments and AI recommendations
6. 📱 **Displays everything** on a beautiful command center dashboard — accessible from any device

### Why It Matters

| Benefit | Description |
|---|---|
| **Zero Risk** | Drone enters the danger zone instead of humans |
| **Complete Visibility** | LiDAR penetrates smoke and dust; thermal vision sees through darkness |
| **Intelligent Routing** | A* algorithm finds optimal paths around danger zones |
| **Instant Coordination** | One shared digital twin means all teams see the same picture |
| **Works Anywhere** | Runs in a web browser — no special software to install |

---

## 4. System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER'S WEB BROWSER                               │
│                                                                         │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │  COMMAND      │   │  3D DIGITAL TWIN  │   │  REAL-TIME HUD        │  │
│  │  CENTER UI    │   │  VISUALIZATION    │   │  & OVERLAYS           │  │
│  │              │   │                  │   │                        │  │
│  │ • Mission     │   │ • Three.js Scene  │   │ • Battery / Signal    │  │
│  │   Controls    │   │ • Buildings &     │   │ • Scan Progress       │  │
│  │ • Disaster    │   │   Environment     │   │ • Survivor Count      │  │
│  │   Selector    │   │ • Drone Model     │   │ • Timer               │  │
│  │ • Status      │   │ • Survivors       │   │ • Minimap             │  │
│  │   Panels      │   │ • Danger Zones    │   │ • Mission Log          │  │
│  │ • Mission     │   │ • Evacuation      │   │ • AI Advice           │  │
│  │   Log         │   │   Routes          │   │ • FPV Camera          │  │
│  └──────┬───────┘   └────────┬─────────┘   └───────────┬────────────┘  │
│         │                    │                          │               │
│         └────────────────────┼──────────────────────────┘               │
│                              │                                          │
│                    ┌─────────▼──────────┐                               │
│                    │   REACT + R3F      │                               │
│                    │   APPLICATION      │                               │
│                    │   CORE ENGINE      │                               │
│                    └─────────┬──────────┘                               │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                     │
│         │                    │                    │                     │
│  ┌──────▼───────┐   ┌───────▼──────┐   ┌────────▼──────┐              │
│  │  PROCEDURAL   │   │  PATHFINDING  │   │  SCANNING     │              │
│  │  GENERATION   │   │  ENGINE       │   │  SYSTEMS      │              │
│  │  ENGINE       │   │  (A*)         │   │               │              │
│  │               │   │               │   │ • LiDAR Sim   │              │
│  │ • Survivors   │   │ • Safest      │   │ • Thermal Sim │              │
│  │ • Danger      │   │ • Fastest     │   │ • Survivor    │              │
│  │   Zones       │   │ • Balanced    │   │   Detection   │              │
│  │ • Buildings   │   │ • Danger      │   │ • Swarm       │              │
│  │ • Blocked     │   │   Avoidance   │   │   Coordination│              │
│  │   Roads       │   │ • Blocked     │   │               │              │
│  │ • Signal      │   │   Road        │   │               │              │
│  │   Dead Zones  │   │   Awareness   │   │               │              │
│  └──────────────┘   └──────────────┘   └───────────────┘              │
│                                                                         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ HTTP API
                              ┌───────▼───────┐
                              │   NEXT.JS     │
                              │   BACKEND     │
                              │   SERVER      │
                              │               │
                              │ POST /api/    │
                              │   mission     │
                              │               │
                              │ • Risk        │
                              │   Assessment  │
                              │ • Mission     │
                              │   Grading     │
                              │ • AI Recom-   │
                              │   mendations  │
                              │ • Survivor    │
                              │   Triage      │
                              └───────────────┘
```

### Architecture Explained

The system is built as a **full-stack web application** with three major layers:

| Layer | What It Does | Key Technologies |
|---|---|---|
| **Frontend (Browser)** | Renders the 3D scene, manages the user interface, handles all real-time interactions and visual effects | React, Three.js, React Three Fiber |
| **Simulation Engine** | Runs all the intelligence — procedural world generation, LiDAR/thermal scanning, A* pathfinding, swarm drone coordination | TypeScript, Custom algorithms |
| **Backend API** | Analyzes completed missions, computes risk scores, generates AI recommendations and mission grades | Next.js API Routes |

> [!NOTE]
> The entire application is **self-contained**. There are no external AI APIs, cloud dependencies, or third-party services. All intelligence runs locally, making it fast, private, and deployable anywhere.

---

## 5. Step-by-Step Mission Workflow

Here's exactly what happens from the moment you open SkySentinel until a mission is complete:

---

### Phase 1: Mission Initialization

```
USER opens SkySentinel in browser
         │
         ▼
┌─────────────────────────────┐
│  PROCEDURAL GENERATION      │
│  ENGINE ACTIVATES           │
│                             │
│  A unique mission seed is   │
│  generated, creating:       │
│  • 5–8 survivors at random  │
│    positions with random    │
│    health values (12–88%)   │
│  • 2–4 danger zones         │
│  • Blocked roads            │
│  • Signal dead zones        │
│  • A procedural cityscape   │
│    with buildings, rubble,  │
│    trees, cars, streetlights│
└──────────────┬──────────────┘
               ▼
  3D Digital Twin loads —
  Command Center is READY
```

**What happens behind the scenes:**
- A **random seed number** is generated from the current time
- This seed is fed into a deterministic random number generator (Mulberry32 algorithm)
- The generator produces the exact same scenario every time the same seed is used — meaning missions can be **replayed** for training or analysis
- Survivors are placed at **completely random positions** with collision checks to ensure no one spawns inside buildings, too close to danger zones, or on blocked roads
- Each survivor receives a **random health value** between 12% and 88%, making every mission feel different and realistic

---

### Phase 2: Disaster Selection & Deployment

```
USER selects disaster type:
  🏚️ Earthquake  |  🌊 Flood  |  🔥 Fire
         │
         ▼
USER clicks "START MISSION"
         │
         ▼
  Mission timer begins (12 minutes)
  Battery starts draining
  AI Advisor: "Mission armed. Deploy drone when ready."
         │
         ▼
USER clicks "DEPLOY DRONE"
         │
         ▼
  Drone appears in the 3D scene
  hovering at operational altitude
```

---

### Phase 3: Scanning & Detection

The operator now has multiple scanning options:

#### Option A: LiDAR Scan
```
USER clicks "LiDAR SCAN"
         │
         ▼
┌─────────────────────────────┐
│  DRONE BEGINS ORBITAL SCAN  │
│                             │
│  • Flies in a circular      │
│    pattern around the zone  │
│  • Emits simulated laser    │
│    point cloud particles    │
│  • Rotating radar sweep     │
│    beam visible on ground   │
│  • Expanding ring pulses    │
│  • Scan wave sphere expands │
│  • Progress: 0% ──▶ 100%   │
│                             │
│  As scan progresses:        │
│  40% → Mapping Environment  │
│  70% → Analyzing Structures │
│  97% → Survivors revealed   │
│  100% → SCAN COMPLETE       │
└──────────────┬──────────────┘
               ▼
  All survivors detected via LiDAR
  Intel panel unlocked
```

#### Option B: Thermal Vision
```
USER clicks "THERMAL VISION" (or presses T)
         │
         ▼
┌─────────────────────────────┐
│  THERMAL IMAGING ACTIVATES  │
│                             │
│  • Screen shifts to dark    │
│    thermal color palette    │
│  • Survivors glow based on  │
│    their health:            │
│    🔴 Red = Critical (<35%) │
│    🟠 Orange = Medium       │
│    🟡 Yellow = Healthy      │
│  • Heat shimmer rings pulse │
│    around each survivor     │
│  • Scan line + noise grain  │
│    overlays for realism     │
│  • Can detect hidden        │
│    survivors that LiDAR     │
│    might miss               │
└─────────────────────────────┘
```

#### Option C: Auto Search / Swarm Deploy
```
USER clicks "AUTO SEARCH" or "DEPLOY SWARM"
         │
         ▼
  Auto Search: Drone follows a systematic
  grid pattern covering the entire zone

  Swarm Deploy: 3 drones deploy simultaneously:
  • ALPHA (Cyan)   — LiDAR scanning orbit
  • BRAVO (Orange) — Thermal grid sweep
  • CHARLIE (Purple) — Survivor mapping
```

---

### Phase 4: AI Analysis & Route Planning

```
Survivors detected
         │
         ▼
USER clicks "AI PLANNING"
         │
         ▼
┌─────────────────────────────┐
│  AI PRIORITY ENGINE         │
│                             │
│  Analyzes all survivors:    │
│  • Sorts by health (lowest  │
│    = most urgent)           │
│  • Calculates distance to   │
│    evacuation zone          │
│  • Estimates rescue time    │
│  • Assigns priority:        │
│    🔴 HIGH   — lowest 20%  │
│    🟡 MEDIUM — next 35%    │
│    🟢 LOW    — remaining   │
└──────────────┬──────────────┘
               ▼
USER clicks "GENERATE ROUTES"
               │
               ▼
┌─────────────────────────────┐
│  A* PATHFINDING ENGINE      │
│                             │
│  Generates 3 optimal routes │
│  from the highest-priority  │
│  survivor to the safe zone: │
│                             │
│  🔵 SAFEST — maximum        │
│     avoidance of all danger │
│     zones (14× danger cost) │
│                             │
│  🟡 FASTEST — shortest      │
│     distance, light danger  │
│     penalty (1.2× cost)     │
│                             │
│  ⚪ BALANCED — optimal mix  │
│     of speed and safety     │
│     (5.5× danger cost)      │
│                             │
│  Routes render as glowing   │
│  3D lines with animated     │
│  "GPS pearl" markers        │
└──────────────┬──────────────┘
               ▼
  Routes visible in 3D scene,
  minimap, and HUD
```

---

### Phase 5: Rescue Simulation & Mission Complete

```
USER clicks "RESCUE SIM"
         │
         ▼
  Ground teams simulate extraction
  along the balanced route
         │
         ▼
USER clicks "MISSION COMPLETE"
         │
         ▼
┌─────────────────────────────────┐
│  AI MISSION ANALYSIS ENGINE     │
│  (Backend API)                  │
│                                 │
│  Receives full mission data:    │
│  • All survivor health/status   │
│  • Routes generated             │
│  • Battery & time remaining     │
│  • Scan completion status       │
│  • Tools used (thermal, swarm)  │
│                                 │
│  Computes:                      │
│  ┌───────────────────────────┐  │
│  │ Mission Grade: S/A/B/C/D │  │
│  │ Risk Level: LOW → CRITICAL│  │
│  │ Route Recommendation     │  │
│  │ AI Action Items          │  │
│  │ Resource Efficiency      │  │
│  │ Survivor Triage Report   │  │
│  └───────────────────────────┘  │
└────────────────┬────────────────┘
                 ▼
  ┌─────────────────────────────┐
  │  MISSION SUMMARY MODAL     │
  │                             │
  │  Beautiful glassmorphic     │
  │  overlay displaying:        │
  │  • Grade badge (S/A/B/C/D) │
  │  • Risk level indicator    │
  │  • Survivors found/total   │
  │  • Average health          │
  │  • Recommended route       │
  │  • AI recommendations list │
  │  • Resource efficiency     │
  │                             │
  │  Options:                   │
  │  [Continue] [New Mission]  │
  │  [Replay Mission]          │
  └─────────────────────────────┘
```

---

## 6. Key Features

### 6.1 — 3D Digital Twin Environment

#### What It Is
A fully interactive, real-time **3D replica of a disaster zone** rendered directly in the browser. This "digital twin" mirrors what a real disaster zone would look like from a drone's perspective.

#### Why It Was Built
Disaster responders need to see the terrain before entering it. A 3D digital twin gives them a bird's-eye understanding of the environment — buildings, rubble, roads, hazards — without setting foot in the danger zone.

#### How It Works
- A **procedural cityscape** generates 16+ buildings: damaged inner-ring structures with fallen walls, rubble, exposed rebar, and collapsed floor slabs, plus intact outer-ring buildings with lit/unlit windows
- A **central collapsed building** (loaded from a 3D model file, or generated procedurally as fallback) anchors the disaster site
- **Environmental props** — trees, cars, streetlights — are instanced for performance (meaning the GPU draws many copies from a single template)
- The ground plane features a procedurally generated texture with cracks for earthquake scenarios
- **Atmospheric particles** — dust, smoke, fire embers — bring the scene to life
- A gradient **sky dome** with fog creates depth and cinematic mood

#### Technologies Used
Three.js, React Three Fiber, GLTF/GLB 3D models, WebGL instanced rendering, procedural geometry

---

### 6.2 — LiDAR Scanning Simulation

#### What It Is
**LiDAR** (Light Detection and Ranging) is a real-world technology where a drone shoots thousands of laser pulses at the ground and measures how they bounce back. This creates a highly detailed 3D map of the terrain — even through smoke, dust, and darkness.

SkySentinel simulates this process visually and functionally.

#### Why It Was Built
In a real disaster, you can't see through dust clouds or into collapsed buildings with a regular camera. LiDAR cuts through environmental obstacles to reveal the true shape of the terrain and detect human figures that cameras would miss.

#### How We Built It
The LiDAR system consists of several coordinated visual components:

| Component | Visual Effect |
|---|---|
| **Point Cloud** | Up to 8,000 colored particles emitted from the drone's position, color-coded by height (blue → green → yellow → red) |
| **Rotating Radar Sweep** | A thin cyan laser line rotating 360° beneath the drone with a trailing fan |
| **Expanding Radar Rings** | 3 concentric rings pulsing outward from the drone position |
| **Scan Wave Sphere** | A transparent sphere expanding from the drone, representing the scan coverage area |
| **LiDAR Dust Particles** | 300 floating particles illuminated in the scan beam |
| **Scanning Grid** | A ground-level grid overlay that follows the drone |

#### How It Works in Simple Terms
1. When the user clicks **"LiDAR SCAN"**, the drone enters an automated orbital flight path
2. As it orbits, point cloud particles spawn in batches, building up a 3D data map
3. The scan progresses from 0% to 100% over approximately 11 seconds
4. At each frame, the system checks if any survivors are within 20 meters of the drone — if so, they're marked as "detected by LiDAR"
5. Once the scan reaches 100%, all survivors are revealed and the intelligence panel unlocks

---

### 6.3 — Thermal Vision Mode

#### What It Is
**Thermal imaging** (also called infrared imaging) detects heat signatures. Every living person emits body heat, which shows up as bright colors against the cooler background of buildings and rubble.

SkySentinel simulates this with a full-screen visual transformation.

#### Why It Was Built
Some survivors may be **hidden** — trapped under debris, behind walls, or in dark spaces. A regular camera or even LiDAR might miss them, but **thermal vision can't be fooled** — if someone is alive, they emit heat.

#### How We Built It
When thermal mode activates, the entire rendering pipeline transforms:

| Effect | Description |
|---|---|
| **Color Shift** | Background changes to deep purple/black (`#050010`) |
| **Survivor Heat Glow** | Each survivor's 3D model emits color based on health: 🔴 red (critical), 🟠 orange (moderate), 🟡 yellow (healthy) |
| **Heat Shimmer Rings** | Pulsating rings and vertical heat columns surround each survivor |
| **Chromatic Aberration** | Post-processing effect that splits RGB channels — mimicking real thermal camera artifacts |
| **Enhanced Bloom** | Increased glow intensity (1.0) with lower threshold (0.12) to make heat sources pop |
| **Scan Line + Noise Grain** | CSS overlays simulating a real thermal camera display |
| **Vignette** | Darker edges simulating the lens falloff of thermal optics |

#### How It Works in Simple Terms
Press **T** on the keyboard (or click the thermal button) and the world transforms. Suddenly, everyone glowing warm is a survivor — and their color tells you how urgent they are. Red means critical; get to them first.

---

### 6.4 — AI-Powered Escape Route Generation (A*)

#### What It Is
The **A* algorithm** (pronounced "A-star") is one of the most efficient pathfinding algorithms in computer science. It finds the shortest path between two points while intelligently avoiding obstacles.

SkySentinel uses A* to generate three different rescue routes from the highest-priority survivor to the evacuation zone.

#### Why It Was Built
In a disaster zone, you can't just walk in a straight line to a survivor. There are fires, flooded areas, collapsed structures, and blocked roads in the way. Rescue teams need **pre-calculated optimal routes** that balance speed against safety.

#### How We Built It
The map is divided into a **72×72 grid** overlaid on the 120-meter disaster zone. Each cell knows:
- Whether it's **blocked** (rubble, collapsed road)
- How close it is to a **danger zone** (fire, flood, structural collapse)
- Its **traversal cost** — which changes based on the route mode

The A* algorithm then searches through this grid using three different **danger cost multipliers**:

| Route Mode | Danger Multiplier | Strategy |
|---|---|---|
| 🔵 **Safest** | 14× | Strongly avoids all danger zones — takes the long way around |
| 🟡 **Fastest** | 1.2× | Minimizes distance — will path near (but not through) danger |
| ⚪ **Balanced** | 5.5× | Optimal trade-off between speed and safety |

#### How It Works in Simple Terms
Think of it like a GPS. You ask for directions from Point A (the survivor) to Point B (the safe zone), and the system gives you three options:
- The **safest** route that goes way around all danger
- The **fastest** route that cuts through less dangerous areas
- The **balanced** route that's a smart compromise

All three routes render as glowing 3D lines in the scene, with animated "GPS pearl" markers that travel along the safest path.

---

### 6.5 — Procedural Scenario Generation

#### What It Is
Every time you start a new mission, SkySentinel **creates a completely unique disaster scenario from scratch** — different survivor positions, different danger zones, different blocked roads. No two missions are ever the same.

#### Why It Was Built
Training and testing require variety. If the same scenario played every time, responders would memorize the layout instead of practicing their decision-making skills. Procedural generation ensures **infinite replayability**.

#### How We Built It
The system uses a **seeded pseudo-random number generator** called Mulberry32:

1. A random **seed number** is generated (from the current timestamp + entropy)
2. This seed is passed into the generator, which produces a sequence of random numbers
3. Every element of the scenario — survivor count, positions, health values, danger zone locations, blocked roads — is derived from this sequence
4. **Same seed = same scenario** every time, enabling replay and comparison

The generation follows a strict **dependency order**:
```
Seed → Danger Zones → Blocked Roads → Survivors → Swarm Drones → Signal Dead Zones → Drone Start Position
```

Each step respects collision rules:
- Survivors must be at least **5 meters** apart
- Survivors cannot be inside buildings or within **4 meters** of danger zones
- At least one survivor is guaranteed to be **30+ meters** from the evacuation zone (making pathfinding meaningful)
- Danger zones must be at least **10 meters** apart and **18 meters** from the evacuation zone

#### Recent Improvement
Survivors now spawn at **completely random positions** every time — no more fixed layouts. Each survivor also receives a **random health value** between 12% and 88%, making every mission feel genuinely unique and unpredictable.

---

### 6.6 — Drone Swarm Coordination

#### What It Is
Instead of one drone doing everything, SkySentinel can deploy a **coordinated swarm of three drones**, each with a specialized role.

#### Why It Was Built
In real-world search and rescue, a single drone covering a large area is slow. **Multi-drone swarms** can divide the search zone into sectors and cover ground 3× faster, with each drone contributing different sensor capabilities.

#### How It Works
When the user clicks **"DEPLOY SWARM"**, three drones deploy with distinct missions:

| Drone | Callsign | Color | Role | Flight Pattern |
|---|---|---|---|---|
| Drone 1 | **ALPHA** | 🔵 Cyan | LiDAR Scanner | Circular orbit (36 waypoints) |
| Drone 2 | **BRAVO** | 🟠 Orange | Thermal Search | Grid sweep (5×5 pattern) |
| Drone 3 | **CHARLIE** | 🟣 Purple | Survivor Mapper | Visits each known survivor position |

Each drone's position updates in real-time, visible on both the 3D scene and the minimap. A **Swarm Status** panel shows each drone's name, role, current status, and progress percentage.

---

### 6.7 — First-Person Drone Flight (FPV)

#### What It Is
**FPV** (First-Person View) allows the operator to take direct manual control of the drone and fly through the disaster zone from the drone's perspective.

#### Why It Was Built
Automated scans are efficient, but sometimes an operator needs to **manually investigate** a specific area — peek around a corner, fly lower to inspect rubble, or position the drone for a better thermal read.

#### How It Works

| Control | Action |
|---|---|
| **W / A / S / D** | Move forward, left, backward, right |
| **Q / E** | Fly up / down |
| **Mouse** | Look around (yaw and pitch) |
| **Shift** | Boost speed (2× multiplier) |
| **T** | Toggle thermal vision |
| **Escape** | Exit FPV mode |

The FPV mode features:
- **Velocity-based camera shake** for realism
- **Additional scan vibration** when LiDAR is active
- A **full HUD overlay** showing altitude, speed, battery, signal strength, GPS coordinates, mission state, and survivor count
- **Signal dead zones** where the signal strength drops and glitches — simulating real-world RF interference

---

### 6.8 — AI Mission Analysis Engine

#### What It Is
A **server-side intelligence engine** that analyzes your completed mission and generates a comprehensive report with grades, risk scores, and actionable recommendations.

#### Why It Was Built
Raw data is useless without interpretation. After a mission, commanders need to know: *Was this mission successful? What did we miss? What should happen next?* The AI engine answers all of these questions automatically.

#### How We Built It
The backend exposes a **REST API endpoint** (`POST /api/mission`) that receives the complete mission telemetry:
- All survivor data (health, priority, detection method, location)
- Routes generated (safest/fastest/balanced waypoints)
- Resource status (battery, time remaining)
- Feature usage (thermal imaging, swarm deployment)
- Disaster type and scan completion status

The engine then computes:

| Analysis | What It Calculates |
|---|---|
| **Mission Grade** | S (≥90), A (≥80), B (≥70), C (≥55), D (<55) |
| **Risk Assessment** | LOW / MODERATE / HIGH / CRITICAL — with specific risk factors listed |
| **Survivor Triage** | Total detected, critical count, average health, estimated survival window |
| **Route Recommendation** | Which route to use (Fastest for CRITICAL, Balanced for HIGH, Safest for LOW) |
| **AI Recommendations** | Actionable items: "Deploy ground team via balanced route," "Thermal sweep needed," etc. |
| **Resource Efficiency** | Battery efficiency, time efficiency, scan coverage rating |

---

### 6.9 — Augmented Reality (AR) Mode

#### What It Is
AR mode allows users to **overlay the 3D disaster scene onto the real world** through their phone or tablet's camera, using WebXR technology.

#### Why It Was Built
Imagine a field commander holding up their phone and seeing the evacuation routes, survivor locations, and danger zones **projected onto the real terrain** in front of them. AR bridges the gap between the digital plan and the physical world.

#### How It Works
- SkySentinel uses the **WebXR API** with `hit-test` and `dom-overlay` features
- On compatible mobile devices, an **"ENTER AR"** button appears
- The 3D scene — including evacuation routes, danger zone markers, and survivor indicators — renders in augmented reality
- AR mode is automatically enabled on mobile devices for optimal device capability detection

---

### 6.10 — Adaptive Mobile Optimization

#### What It Is
SkySentinel **automatically detects the user's device** and adjusts rendering quality to ensure smooth performance on both high-end desktops and mobile phones.

#### Why It Was Built
A disaster response tool must work everywhere — including on a field responder's phone. But phones have less processing power than desktops. The system intelligently reduces visual complexity without sacrificing essential functionality.

#### What Gets Optimized on Mobile

| Setting | Desktop | Mobile |
|---|---|---|
| Shadow Map Resolution | 1024px | 512px |
| FPS Cap | Unlimited | 30 FPS |
| Device Pixel Ratio | Up to 2× | Up to 1.5× |
| LiDAR Max Points | 8,000 | 4,000 |
| Dust Particles | 400 | 200 |
| Smoke Particles | 120 | 60 |
| Inner Buildings | 6 | 4 |
| Outer Buildings | 10 | 7 |
| Post-Processing | Full | Disabled |
| Fill Light | Enabled | Disabled |
| Scan Wave Sphere | Shown | Hidden |
| Radar Rings | Shown | Hidden |

> [!TIP]
> Despite these optimizations, mobile users still get full access to all features — LiDAR scanning, thermal vision, pathfinding, swarm deployment, and AR mode. Only the heaviest visual effects are reduced.

---

### 6.11 — Cinematic Visual Effects

#### What It Is
SkySentinel uses **film-grade post-processing effects** to create a premium, immersive visual experience that feels like a real command center.

#### Effects Pipeline

| Effect | Purpose |
|---|---|
| **ACES Filmic Tone Mapping** | Cinema-quality color grading that prevents blown-out highlights |
| **Unreal Bloom** | Adds a soft glow to bright elements — drone lights, scanner beams, survivor glow |
| **Vignette** | Darkens screen edges for a focused, cinematic framing effect |
| **Chromatic Aberration** | Splits color channels slightly — used in thermal mode to simulate real IR cameras |
| **Fog** | Depth-based fog that fades distant objects, creating atmosphere |
| **Navigation Lights** | Red/green blinking lights on the drone, mimicking real aviation lighting |
| **Glassmorphism UI** | Frosted-glass panels with blur effects for the command center interface |

---

## 7. Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 | Full-stack React framework with server-side capabilities |
| **Language** | TypeScript | Type-safe JavaScript for reliable, maintainable code |
| **UI Library** | React 19 | Component-based user interface development |
| **3D Engine** | Three.js 0.183 | WebGL-based 3D graphics rendering |
| **3D React Binding** | React Three Fiber (R3F) 9.5 | Declarative Three.js components for React |
| **3D Utilities** | Drei 10.7 | Pre-built R3F components (cameras, controls, lines, etc.) |
| **3D Models** | GLTF / GLB format | Industry-standard 3D model format (drone, buildings, survivors) |
| **Model Source** | Sketchfab | High-quality community 3D models |
| **Pathfinding** | Custom A* Algorithm | Weighted grid-based pathfinding with danger avoidance |
| **Random Generation** | Mulberry32 PRNG | Seeded pseudo-random number generator for reproducible scenarios |
| **Post-Processing** | EffectComposer | Bloom, vignette, chromatic aberration rendering pipeline |
| **AR** | WebXR API | Browser-native augmented reality |
| **Styling** | CSS + Inline Styles | Glassmorphism UI with custom animations |
| **API** | Next.js API Routes | Server-side mission analysis endpoint |
| **Audio** | Web Audio API | Procedural scan/drone sounds via oscillators |
| **Build Tool** | Webpack (via Next.js) | Module bundling and optimization |

---

## 8. Recent Improvements & Updates

> [!NOTE]
> The following improvements were made to enhance the realism, reliability, and visual quality of the simulation.

### 🎲 Randomized Survivor Placement

**Before:** Survivors appeared at fixed, predetermined positions every time the simulation loaded.

**After:** Survivors now spawn at **completely random positions** on every mission, determined by the procedural generation engine. A sophisticated placement algorithm ensures:
- No survivor spawns inside a building
- No two survivors are closer than 5 meters
- No survivor is placed inside a danger zone or on a blocked road
- At least one survivor is guaranteed to be far from the evacuation zone

**Impact:** Every mission now feels genuinely unique, forcing operators to rely on scanning tools rather than memorization.

---

### 🩺 Randomized Health Values

**Before:** Survivors had static or predictable health values.

**After:** Each survivor receives a **random health value between 12% and 88%** at spawn time. Health continues to decay during the mission (losing 0.12% every 5 seconds), creating dynamic urgency.

**Impact:** The AI priority system now produces different triage orders every mission, and the mission analysis engine generates more varied and realistic recommendations.

---

### 👁️ Improved Survivor Visibility & Scaling

**Before:** Survivor models could sometimes be too small, overlapping, or hard to distinguish from environment objects.

**After:** Survivors are now **properly scaled** (2× for GLB models, 1× for procedural fallback capsules) and **reliably visible** in all viewing modes. Each survivor's visibility logic is clearly tied to mission state — hidden before scanning, revealed after detection, always glowing in thermal mode.

**Impact:** Operators can now immediately identify and count survivors in the 3D scene without confusion.

---

### 📦 Improved GLB Model Loading

**Before:** Loading 3D models from Sketchfab sometimes failed silently or caused visual glitches.

**After:** A robust **GLB caching system** was implemented:
- Models are loaded once and cached in memory
- Concurrent requests for the same model are queued and resolved together (preventing duplicate loads)
- Every model component has a **procedural fallback** — if the GLB fails to load, a hand-crafted geometric replacement appears seamlessly
- Cancelled component mounts are properly handled to prevent memory leaks

**Impact:** The simulation loads reliably regardless of network conditions or missing model files.

---

## 9. Future Work

### 🚁 Real Drone Integration

The ultimate vision for SkySentinel is to move from simulation to **real-world deployment**. Here's the planned roadmap:

| Phase | Goal | Details |
|---|---|---|
| **Phase 1** | Hardware Bridge | Integrate with real drone flight controllers (DJI SDK, PX4, ArduPilot) to receive live telemetry — GPS position, altitude, battery, camera feed |
| **Phase 2** | Real LiDAR Data | Ingest actual LiDAR point cloud data (from sensors like Velodyne or Livox) and render it in the 3D scene in real-time |
| **Phase 3** | Computer Vision | Replace simulated survivor detection with real **object detection models** (YOLO, MediaPipe) running on the drone's live camera feed |
| **Phase 4** | Thermal Camera | Connect to actual thermal cameras (FLIR, DJI Zenmuse H20T) and overlay real heat maps onto the Digital Twin |
| **Phase 5** | Multi-Drone Fleet | Enable real swarm coordination where multiple physical drones share scan data through a centralized SkySentinel command center |
| **Phase 6** | Field Deployment | Package SkySentinel as a fully offline application that runs on a ruggedized field laptop or tablet, connected to drones via local mesh network |

### 🧠 AI Enhancements
- **Predictive survivor modeling** — estimate where survivors are likely to be based on building layouts and collapse patterns
- **Dynamic danger zone tracking** — detect fires or floods that are spreading and reroute accordingly
- **Voice command interface** — allow operators to control the drone hands-free
- **Natural language mission briefing** — AI generates plain-English summaries for command staff

### 🌐 Platform Expansion
- **Multi-operator support** — multiple commanders viewing the same Digital Twin simultaneously
- **Cloud deployment** — persistent mission history and cross-organization data sharing
- **Offline-first PWA** — full functionality without internet access

---

## 10. Conclusion

**SkySentinel** demonstrates that the future of disaster response is intelligent, automated, and accessible. By combining:

- 🗺️ **Real-time 3D Digital Twin visualization** for complete situational awareness
- 🔍 **Simulated LiDAR and Thermal scanning** for all-condition survivor detection
- 🧠 **A* pathfinding** for optimal rescue route generation
- 🤖 **AI-powered mission analysis** for intelligent decision support
- 📱 **Cross-platform web technology** for instant deployment anywhere

...into a single, browser-based platform, SkySentinel proves that advanced technologies — traditionally reserved for military-grade systems — can be made **accessible, intuitive, and immediately useful** for the people who need them most: first responders saving lives when every second counts.

> [!IMPORTANT]
> SkySentinel is not just a simulation. It is a **proof of concept for a new paradigm** in disaster response — where AI-powered drones, digital twins, and intelligent route planning work together seamlessly to save more lives, faster, and safer than ever before.

---

<p align="center">
  <strong>⬡ SkySentinel</strong><br>
  <em>AI Disaster Response · Digital Twin · Drone Simulation</em><br><br>
  <code>Built with ❤️ for a safer world</code>
</p>

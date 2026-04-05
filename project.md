# ⬡ SkySentinel Disaster Response System
**Comprehensive Technical Documentation & Project Overview**

SkySentinel is an advanced, high-fidelity digital twin and mission-control platform designed for drone-assisted disaster response. Built primarily as an interactive simulation and logistical tool, the system coordinates wide-area search operations, dynamic environmental hazard mapping, and real-time ground team response. 

The application architecture uniquely splits into two parallel experiences: a heavily graphical **3D Command Center** for drone operators, and a highly optimized, mobile-first **Rescue Field Interface** for on-the-ground operatives. This document outlines the technical implementations, algorithmic approaches, and architectural philosophies behind SkySentinel.

---

## Table of Contents
1. [Core Features & Vision](#1-core-features--vision)
2. [Macro Architecture & Tech Stack](#2-macro-architecture--tech-stack)
3. [Deep Dive: 3D Visualization & Graphics](#3-deep-dive-3d-visualization--graphics)
4. [Deep Dive: Procedural Generation & AI](#4-deep-dive-procedural-generation--ai)
5. [Deep Dive: Synchronous Polling & State Management](#5-deep-dive-synchronous-polling--state-management)
6. [Deep Dive: Mobile Rescue Interface](#6-deep-dive-mobile-rescue-interface)
7. [Mission Workflow](#7-mission-workflow)
8. [Extensive Directory Mapping](#8-extensive-directory-mapping)

---

## 1. Core Features & Vision

Disaster zones (earthquakes, wildfires, industrial accidents) suffer from massive communication blackouts, spatial unpredictability, and severe time constraints. SkySentinel is built to target the "Golden Hour" of rescue operations.

*   **Real-time FPV & Isometric Visualization:** Operators pilot a responsive digital twin of an aerial scout drone over a 3D procedurally generated disaster topology.
*   **Sensor Simulation (LiDAR & Thermal):** Physically simulated raycast scanning creates topological point clouds, while dynamic tone-mapping mimics thermal infrared detection for occluded targets.
*   **AI Pathfinding (A* Navigation):** The proprietary engine calculates multiple route permutations (Fastest, Safest, Balanced) based on real-time threat-radii and blocked topography.
*   **Distributed Team Coordination:** Field operatives utilize a synchronous web-app to receive commands, view vector-based maps, and report extractions.
*   **Compliance & Analytics:** Post-mission automated PDF generation compiles survivor details, risk vectors, and battery/time efficiency metrics for administrative review.

---

## 2. Macro Architecture & Tech Stack

SkySentinel abandons heavy external databases in favor of a locally deployable, serverless memory model. This ensures it can theoretically be packed into a decentralized edge-computational box during a real power grid failure.

**Frontend Toolkit:**
*   **Next.js 16 (App Router):** Provides optimal code-splitting, routing, and server-side logic handling.
*   **React 19 & TypeScript:** Strongly typed UI components utilizing modern hooks (`useMemo`, `useCallback`, `useRef`) to avoid frame drops in complex render loops.
*   **Three.js & React Three Fiber (R3F):** Engine powering the 3D WebGL renderer, utilizing declarative JSX syntax for complex volumetric geometries.
*   **CSS / Design System:** Pure Vanilla CSS utilizing scoped classes. Heavily inspired by cyberpunk/military interfaces (glassmorphism, monospace fonts, glowing hex grids).

**Backend Toolkit:**
*   **Next.js Route Handlers:** Serverless endpoints acting as an active state machine.
*   **In-Memory Store:** Memory-persistent JS objects handle database duties to ensure `<10ms` response times.

**Asset & Utility Libraries:**
*   **jsPDF & jspdf-autotable:** Client-side vector graphic reporting.
*   **GLTF Pipeline:** Handling of `.glb` 3D assets (Drone, Humvee, Buildings).

---

## 3. Deep Dive: 3D Visualization & Graphics

The `/components/Scene.tsx` file is the graphical workhorse of the application, rendering a 144x144 unit grid representing the operational theater.

### Sensor Simulation: LiDAR Scan
To simulate a LiDAR scan, the engine utilizes a customized `THREE.Raycaster`. 
1. The drone emits expanding circular rays targeting down at the floor mesh and building bounding boxes.
2. For each intersection, a localized green visual particle (a custom Shader/Point mesh) is spawned.
3. This is aggregated into a `THREE.BufferGeometry` to render thousands of points without tanking frames per second, slowly creating a "Point Cloud" topology of the map while simultaneously revealing hidden survivor meshes.

### Thermal Vision Overlays
Instead of swapping textures, Thermal vision is handled via global lighting mutations and HTML post-processing:
1. `gl.toneMappingExposure` is artificially pumped alongside scene ambient brightness.
2. The environmental textures default to a dark, cold hue (`#050010`), while entities marked "biological" (survivors) exhibit glowing emissive red/orange materials.
3. A pure CSS overlay (`thermal-noise`, `thermal-scanline`) sits above the WebGL canvas, adding analog film grain and moving CRT scanlines to perfect the optical illusion.

### Flight Dynamics
The `SplineDrone.tsx` utilizes non-linear spring physics to simulate aerial drifting. When the user initiates movement (WASD), the drone naturally pitches (`rotation.x`) and rolls (`rotation.z`) into the vector of momentum. Idle states feature subtle sinusoidal bobbing on the Y-axis to replicate wind resistance.

---

## 4. Deep Dive: Procedural Generation & AI

A fixed map is useless for a simulation. SkySentinel relies on a heavily constrained Seeded Random Number Generator (RNG) in `lib/data.ts`.

### Environmental Spawning
Every mission is assigned a unique seed (e.g., `84521`). 
*   **Buildings:** The algorithm attempts to place randomized bounding boxes across the grid. It utilizes a `getMinimumDistance` check to prevent overlap.
*   **Hazards:** Threat zones (fires, chemical spills) are mathematically placed. Their centers and radii determine the `riskLevel`.
*   **Survivors:** NPCs are scattered randomly. Their health values and priorities (Critical, Medium, Low) are assigned based on their proximity to hazard centers. 

### A* Pathfinding Logic
Housed in `lib/helpers.ts`, the navigation AI uses a Manhattan-distance heuristic A* algorithm to path a survivor to the green Evac Zone.
*   The 144x144 space is translated into an integer grid.
*   **Safest Route:** The cost function aggressively penalizes grid nodes that fall within a danger zone's mathematical radius.
*   **Fastest Route:** Ignores hazard damage entirely, drawing the tightest geometric curve regardless of fire or radiation.
*   **Balanced:** Weighs the distance against light perimeter damage.

---

## 5. Deep Dive: Synchronous Polling & State Management

Because field operatives (Mobile) and the Command Center (Desktop) must share exact data, Next.js API routes act as a synchronous bus.

### The Polling Loop
Both clients run `setInterval()` loops polling `/api/mission-state` and `/api/rescue-status` every 3000ms.
*   **Delta Updates:** The Command center posts the current drone coordinate, survivor detection status, and battery levels.
*   The mobile device fetches this payload. If the response age exceeds the threshold, the UI downgrades from a green "LIVE" status to a yellow "DELAYED" or red "OFFLINE", instantly alerting operatives of signal loss.

### Endpoints
*   `GET /api/mission-state`: Returns the master JSON object (Seed, hazards, survivor arrays).
*   `POST /api/rescue-status`: Appends events (`ARRIVED`, `EXTRACTED`) to a queue. When an operative fires `EXTRACTED`, the specific survivor object's `rescued` flag flips to true, immediately updating the 3D display on the Command Console.
*   `GET /api/rescue-teams`: Provides an array of active connections. Operatives POST a heartbeat every 10s to remain active on the command's roster.

---

## 6. Deep Dive: Mobile Rescue Interface

The `/rescue` interface trades graphical intensity for operational reliability. 
*   **One-Handed UX:** Features a bottom-tab navigation system (`Target`, `Map`, `Survivor`, `Status`). Heavy Action buttons (`EXTRACT`, `NEED BACKUP`) are 2x2 grids at the bottom of the thumb-reach zone.
*   **Sunlight Readability:** High-contrast `#00ffc8` (Cyan) and `#ff6600` (Orange) on pure dark (`#050010`) backgrounds to bypass screen glare.
*   **SVG Data Viz:** Completely dodges WebGL. The "Drone Overhead View" is rendered utilizing standard HTML5 Canvas 2D contexts, matching the 3D procedurally generated map 1-to-1 via coordinate translation. The Survivor tab features a custom SVG polyline graph predicting health-decline vectors.

---

## 7. Mission Workflow

1.  **Deployment:** Operator opens `/command`. A random seed initializes the environment. The drone is deployed via the deployment cinematic.
2.  **Mapping:** Operator engages LiDAR (`SCANNING`). Raycasts reveal topology and lock onto survivor positions.
3.  **Analysis:** The AI sorts survivors by health deterioration rate and calculates optimal extraction routes.
4.  **Field Response:** A ground operative opens `/rescue`, logs in with a callsign, and receives the extraction coordinate. The compass directs them to the target.
5.  **Execution:** The operative marks `ARRIVED` and `EXTRACTED`. The Command Center updates in real-time.
6.  **Debrief:** The Operator hits `MISSION COMPLETE`. The app downloads a finalized PDF summarizing battery usage, time to extract, and casualty rates.

---

## 8. Extensive Directory Mapping

Below is the exhaustive architectural layout of the source repository:

```text
drone-disaster-frontend/
├── app/
│   ├── api/
│   │   ├── broadcast/route.ts        # Handles command-to-team messaging
│   │   ├── mission-state/route.ts    # The core in-memory master state DB
│   │   ├── report/route.ts           # Receives mission data for PDF aggregation
│   │   ├── rescue-status/route.ts    # Processes field team actions (EXTRACTED, etc.)
│   │   └── rescue-teams/route.ts     # Heartbeat monitor for connected field devices
│   │
│   ├── command/
│   │   ├── CCLeftPanel.tsx           # Mission status UI, routing triggers, team roster
│   │   ├── CCMissionComplete.tsx     # End-of-mission modal triggering PDF logic
│   │   ├── CCOverlays.tsx            # Viewport HUD (Alt, Speed, Battery) and Hotkeys
│   │   ├── CCRightPanel.tsx          # Threat assessments, Route stats, Broadcast input
│   │   ├── CCTopNav.tsx              # System header
│   │   ├── CommandCenter.tsx         # The main monolithic controller binding 3D & State
│   │   └── command.css               # Isolated CSS for the desktop command interface
│   │
│   ├── components/
│   │   ├── ModelHelpers.tsx          # React Three Fiber loaders for .glb meshes
│   │   ├── ParticleBackground.tsx    # Aesthetic UI background for landing page
│   │   ├── Scene.tsx                 # Core WebGL 3D environment logic (Raycasting, Lighting)
│   │   ├── SplineDrone.tsx           # Drone physics, kinematics, and propeller animations
│   │   └── ui.tsx                    # Shared micro-components (Minimap Canvas)
│   │
│   ├── lib/
│   │   ├── data.ts                   # Complex procedural generation matrices and Seed RNG
│   │   ├── helpers.ts                # A* pathfinding graph execution
│   │   ├── pdfReport.ts              # `jsPDF` vector drawing algorithms
│   │   └── types.ts                  # Shared TypeScript interfaces (Survivor, Vec2, etc.)
│   │
│   ├── rescue/
│   │   ├── RescueApp.tsx             # The primary 4-tab mobile state machine
│   │   ├── RescueMap.tsx             # HTML5 Canvas 2D projection of the 3D map
│   │   ├── page.tsx                  # Next.js route wrapper
│   │   └── rescue.css                # Scoped mobile-first styling for high-contrast visibility
│   │
│   ├── globals.css                   # Root styling variables
│   ├── layout.tsx                    # Next.js header injection & Font (Space Grotesk) wrapper
│   └── page.tsx                      # Landing page featuring animated backgrounds
│
├── public/                           # glTF (.glb) files for cars, buildings, drones
└── next.config.ts                    # Build configurations and Webpack optimizations
```

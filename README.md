# 🚁 SkySentinel: AI Disaster Response Drone System

## 🌟 1. Project Title and Overview
**SkySentinel** is a web-based, highly immersive AI Disaster Response Drone simulation and command center system. 
During critical disaster scenarios (such as earthquakes and floods), the golden hours are incredibly important. SkySentinel allows commanders to autonomously or manually deploy drones to map out unknown terrains, run LiDAR scans to assess structural integrity, detect heat signatures using thermal vision, identify survivors, and safely generate AI-optimized rescue routes.

### Key Features
- **Cinematic Drone Deployment:** Realistic drone initialization, movement, and flight dynamics. 
- **LiDAR Scanning:** Fully animated environment sweep that generates raw point clouds and reconstitutes 3D environment meshes.
- **Thermal Vision Mode:** Detect underlying heat signatures of survivors and assess immediate threat and hazard zones.
- **Survivor Detection & Triage:** Automatically detects, maps, and prioritizes survivors based on structural integrity and health states.
- **Augmented Reality (AR) View:** Visualize rescue routes directly in physical space via WebXR for localized rescue teams.
- **Command & Rescue Sync:** Real-time data bridging between the Command Center operation UI and on-the-ground rescue operatives.

---

## 🛠️ 2. Tech Stack
- **Next.js 14:** React framework for SSR and optimized API routing.
- **Three.js & React Three Fiber (R3F):** Engine used for our immersive 3D simulation environment.
- **TypeScript:** Ensuring type safety and predictability across the stack.
- **WebXR:** Powering our AR mode for mobile devices.
- **Git LFS:** Serving large `.glb` 3D model files globally.

---

## ⚙️ 3. Features Explanation
- **Drone Simulation and Controls:** Navigate the drone visually using a third-person orbit or a meticulously crafted FPV (First-Person View) complete with virtual inertia reticles.
- **LiDAR Scan → Point Cloud → 3D Model:** The drone mathematically simulates raycasting bounds to build a point cloud logic structure, filtering into a reconstructed environment mesh representing mapped areas.
- **Thermal Vision:** Replaces environmental textures with heat-mapped visual identifiers pinpointing distressed survivor health variables.
- **Priority Rescue System:** Using an AI triage pattern, it assesses survivor severity and outputs an optimal extraction route traversing safest or fastest navigational graphs. 
- **AR Visualization:** On-site rescue teams can pull up their mobile devices to see holographic waypoint markers overlaid in the real world leading directly to extraction zones.

---

## 💻 4. Installation Instructions (Very Important)
*Note: Because our environment features rich 3D assets, following these installation steps carefully is essential.*

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/drone-disaster-frontend.git
   cd drone-disaster-frontend
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Install Git LFS & Pull Models (CRITICAL)**
   Our 3D `.glb` files are stored using Git Large File Storage. See **Section 5** below for exact commands.
4. **Run Development Server (Local Desktop)**
   ```bash
   npm run dev
   ```
   *Open: `http://localhost:3000`*
5. **Run Development Server (HTTPS for AR/Mobile)**
   WebXR requires an HTTPS context to be able to access AR device hardware.
   If using Next.js with local HTTPS:
   ```bash
   next dev --experimental-https
   ```
   *(Alternatively, you can utilize a tool like `ngrok` -> `ngrok http 3000`)*
6. **Opening on Mobile**
   Connect your mobile device to the same Wi-Fi, then visit your computer's local IP address using the HTTPS connection link.

---

## 📦 5. Git LFS Setup
You **MUST** pull the models via Git LFS. If you skip this step, your `.glb` objects will render as tiny textual pointer files resulting in endless loading screens or crashed GLTFLoaders.

To resolve this, ensure Git LFS is installed securely on your system:
```bash
git lfs install
```
Pull the required binary model assets:
```bash
git lfs pull
```

---

## 🚨 6. If Models Do Not Load
If Git LFS fails or you do not have permission hooks enabled, you can install the models manually:
1. Download our provided `models.zip` file (available in our submission portal).
2. Extract the contents directly into the following local folder route:
   ```text
   /public/models/
   ```
*(You should see files such as `drone.glb` and `soldier.glb` sitting directly inside `/public/models/`)*

---

## 🎮 7. Controls
* **W/A/S/D** → Move drone horizontally mapped across the grid
* **Arrow Up (↑) / Arrow Down (↓)** → Change altitude elevation
* **Mouse / Trackpad** → Camera look / yaw / pitch / orbit
* **F** → Toggle Fullscreen Mode
* **Esc** → Exit First-Person View

**Command Panel Operations:**
* **DEPLOY DRONE** → Launches the drone from standby into the map.
* **LIDAR SCAN** → Initializes area sweep mapping.
* **THERMAL VIEW** → Switches optics to heat signatures.
* **OPEN RESCUE APP** → Opens the simulated mobile portal where rescue personnel use Augmented Reality (AR) view.

---

## 📂 8. Project Structure
- `/app/components` → Reusable Three.js & R3F components (Scene, Drone models, LiDAR processing).
- `/app/command` → Command Center UI interface, maps, operations, and AI prompt analysis logic.
- `/app/rescue` → Real-time synced Rescue Team App UI supporting AR navigation overlays.
- `/app/api` → Internal API handling state synchronization between Command and Rescue groups.
- `/lib` → Mathematical helpers, Graph routing algorithms, and mocked disaster metadata payloads.

---

## 💡 9. Hackathon Problem Statement & Solution

**The Problem:**
During mass-scale disasters, first responders fly blind into highly hazardous architecture. Mapping an unstable environment safely traditionally takes far too long, drastically reducing the survival window for trapped individuals, while ground teams lack clear coordinates amidst the chaos.

**Our Solution:**
SkySentinel provides a comprehensive bridge between scout deployment and on-the-ground rescue via a closed-loop system simulation. A commanding officer safely deploys an autonomous drone to actively map unsafe structures via rapid LiDAR and detect survivors accurately via Thermal. The system’s AI then parses triage variables mapping the safest navigational vectors. Those safe routes are immediately relayed to the on-site ground teams who use mobile devices equipped with AR vision to essentially be "laser-guided" directly to survivors through hazardous terrain, avoiding danger zones without needing physical topographic maps.

---

## 🚀 10. Future Improvements
- **Real-time Multiplayer Syncing:** Upgrade server polling mechanisms to lightweight WebSockets for flawless sub-millisecond Command ↔ Rescue bridging.
- **Physical Hardware Hook-ins:** Utilize WebRTC to connect the command center to physical drone models capturing live point cloud mapping data instead of simulated metrics.
- **Advanced Wind / Environmental Modeling:** Simulate aerodynamics, drone drift mapping, and realistic degradation of structures sequentially during flight.
- **LLM Integrated Triage:** Feed survivor data metrics organically into an LLM capable of giving step-by-step extraction tactics localized to specific injury conditions.

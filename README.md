Welcome to...
 
![ClaudeMap branding](resources/img/ClaudeMapBranding.png)
 
**Google Maps for vibecoders.**
  
AI lets you build faster than ever, but the very tools that help our productivity are leaving us behind, you don't understand what you're building anymore. You can vibe code a full app in a weekend and not even start t0 explain how it works. ClaudeMap fixes that.
 
Unlike traditional visualization tools, ClaudeMap organizes your code by what it actually does. Claude reads your project and groups it into concepts in a way you actually think about your app. Zoom out to see the big picture. Zoom in to see the details. Colors show what's healthy and what's broken.
Use `/explain` and ask any question about your code and claude will present direclty on the map and explain step by step.
 
All powered by the same AI you vibe code with.

![ClaudeMap terminal and map view](resources/img/ClaudeTerminal+ClaudeMap.png)
 
## Get Started
 
```bash
npx claudemap install
```
 
Then in Claude Code:
 
```
/setup-claudemap
```
 
Your codebase is now a map.
 
## Commands
 
| Command | What it does |
|---------|-------------|
| `/setup-claudemap` | Analyze your repo and generate the map |
| `/refresh` | Update the map after code changes |
| `/open-claudemap` | Reopen the map without rebuilding |
| `/explain` | Visual guided walkthroughs — Claude highlights the path on your map as it explains |
| `/claudemap-control` | Direct the map with natural language — "show me auth", "what's broken" |
 
## How It Works
 
ClaudeMap installs as a Claude Code skill. When you run `/setup-claudemap`, it reads your project, sends the structure to a dedicated architecture subagent, and renders the result as an interactive map in your browser. No cloud, no backend — everything runs locally through Claude Code.
 
After code changes, `/refresh` detects what changed and updates the map without rebuilding from scratch.
 
## Project Structure
 
```
app/        → Visual map interface
skill/      → Claude Code skill and architecture subagent
scripts/    → Install and packaging scripts
contracts/  → Graph schema and sample data
demo/       → Demo sandboxes and cached payloads
```
 
## Development
 
```bash
npm install
npm run dev
```
 
## License
 
MIT

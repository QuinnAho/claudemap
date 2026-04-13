Welcome to...
 
![ClaudeMap branding](resources/img/ClaudeMapBranding.png)
 
**Google Maps for vibecoders.**
 
![ClaudeMap terminal and map view](resources/img/ClaudeTerminal+ClaudeMap.png)
 
AI lets you build faster than ever — but devs are getting left behind, you don't understand what you're building anymore. You can vibe code a full app in a weekend and not be able to explain how your own auth flow works. ClaudeMap fixes that.
 
Unlike traditional visualization tools that just mirror your folder structure, ClaudeMap organizes your code by what it actually does. Claude reads your project and groups it into concepts like Auth, Database, and Routing — the way you actually think about your app. Zoom out to see the big picture. Zoom in to see the details. Colors show what's healthy and what's broken. Click anything and Claude explains it in plain english. Use `/explain` and Claude doesn't just respond with text — it visually walks you through your codebase on the map, highlighting the path step by step.
 
All powered by the same AI you vibe code with.
 
## Demo
 
https://www.youtube.com/watch?v=mubRRx5mXzA
 
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
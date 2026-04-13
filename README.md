Welcome to...
 
![ClaudeMap branding](resources/img/ClaudeMapBranding.png)
 
**Google Maps for vibecoders.**
  
AI lets you build faster than ever, but the very tools that help our productivity are leaving us behind, you don't understand what you're building anymore. You can vibecode a full app in a weekend and not even start to explain how it works. ClaudeMap fixes that.
 
Unlike traditional visualization tools, ClaudeMap organizes your code by what it actually does. Claude reads your project and groups it into concepts in a way you actually think about your project. Zoom out to see the big picture. Zoom in to see the details. Colors show what's healthy and what's broken.
Use `/explain` and ask any question about your code and claude will present direclty on the map and explain step by step.
 
All powered by the same AI you vibecode with.

> Note: ClaudeMap started as a hackathon project, so parts of it are still rough around the edges. It was strong enough that I was encouraged to open source it, so if you want to use it, improve it, or help shape it, please do.

[![ClaudeMap Demo](resources/img/thumbnail.png)](https://www.loom.com/share/6a2ff0948ae64ae6994fb3817cb3607e)

[Play with ClaudeMap's map](https://quinnaho.github.io/claudemap/)
 
## Get Started
 
```bash
cd <my-repo>
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
| `/explain` | Visual guided walkthroughs â€” Claude highlights the path on your map as it explains |
| `/show` | Direct the map with natural language â€” "show me auth", "what's broken" |
 
## How It Works
 
ClaudeMap installs as a Claude Code skill. When you run `/setup-claudemap`, it reads your project, sends the structure to a dedicated architecture subagent, and renders the result as an interactive map in your browser. No cloud, no backend â€” everything runs locally through Claude Code.
 
After code changes, `/refresh` detects what changed and updates the map without rebuilding from scratch.
 
## Project Structure
 
```
app/        â†’ Visual map interface
skill/      â†’ Claude Code skill and architecture subagent
scripts/    â†’ Install and packaging scripts
contracts/  â†’ Graph schema and sample data
demo/       â†’ Demo sandboxes and cached payloads
```
 
## Development
 
```bash
npm install
npm run dev
```
 
## License
 
MIT

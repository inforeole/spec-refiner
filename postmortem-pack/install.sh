#!/bin/bash
# Post-mortem system installer for Claude Code
# Usage: bash install.sh

set -e

echo "📦 Installation du système post-mortem Claude Code..."

# Create directories
mkdir -p .claude/scripts .claude/logs

# Create settings.json
cat > .claude/settings.json << 'EOF'
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/scripts/log-prompt.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
EOF

# Create log-prompt.sh
cat > .claude/scripts/log-prompt.sh << 'EOF'
#!/bin/bash
LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/prompts.jsonl"
mkdir -p "$LOG_DIR"
INPUT=$(cat)
[ -z "$INPUT" ] && exit 0
PROMPT=$(echo "$INPUT" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(data.get("prompt",""))' 2>/dev/null)
[ -z "$PROMPT" ] && PROMPT="$INPUT"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
ESCAPED_PROMPT=$(printf '%s' "$PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read())[1:-1])')
echo "{\"timestamp\":\"$TIMESTAMP\",\"branch\":\"$GIT_BRANCH\",\"commit\":\"$GIT_HASH\",\"prompt\":\"$ESCAPED_PROMPT\"}" >> "$LOG_FILE"
EOF
chmod +x .claude/scripts/log-prompt.sh

# Create analyze.js (minified, uses hardcoded git commands - safe)
cat > .claude/scripts/analyze.js << 'JSEOF'
#!/usr/bin/env node
import{readFileSync,writeFileSync,existsSync}from'fs';import{execSync}from'child_process';import{fileURLToPath}from'url';import{dirname,join}from'path';const __filename=fileURLToPath(import.meta.url),__dirname=dirname(__filename),LOGS_DIR=join(__dirname,'..','logs'),REPORT_FILE=join(__dirname,'..','report.md');function parseJsonl(f){if(!existsSync(f))return[];try{return readFileSync(f,'utf-8').split('\n').filter(l=>l.trim()).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean)}catch{return[]}}function analyzeGit(){try{const log=execSync('git log --oneline --since="30 days ago" 2>/dev/null||git log --oneline -100',{encoding:'utf-8',cwd:join(__dirname,'../..')});const c=log.trim().split('\n').filter(Boolean);return{total:c.length,patterns:{fixes:c.filter(x=>/\bfix/i.test(x)),features:c.filter(x=>/\b(feat|add|implement)/i.test(x)),refactors:c.filter(x=>/\b(refactor|clean|improve)/i.test(x)),reverts:c.filter(x=>/\brevert/i.test(x))}}}catch{return{total:0,patterns:{}}}}function categorize(prompts){const cat={bugs:[],features:[],questions:[],refactoring:[],other:[]};for(const p of prompts){const t=(p.prompt||'').toLowerCase();if(/\b(bug|fix|error|crash|broken|marche pas)\b/.test(t))cat.bugs.push(p);else if(/\b(add|create|implement|ajoute|crée|nouveau)\b/.test(t))cat.features.push(p);else if(/\?|comment|pourquoi|what|how|why/.test(t))cat.questions.push(p);else if(/\b(refactor|clean|simplif|améliore)\b/.test(t))cat.refactoring.push(p);else cat.other.push(p)}return cat}function findPatterns(prompts){const p={};for(const x of prompts){const words=(x.prompt||'').toLowerCase().replace(/[^a-zàâäéèêëïîôùûü\s]/g,'').split(/\s+/).filter(w=>w.length>4);for(const w of words)p[w]=(p[w]||0)+1}return Object.entries(p).filter(([,c])=>c>2).sort((a,b)=>b[1]-a[1]).slice(0,20)}function main(){console.log('🔍 Analyse post-mortem...\n');const prompts=parseJsonl(join(LOGS_DIR,'prompts.jsonl')),errors=parseJsonl(join(LOGS_DIR,'errors.jsonl')),git=analyzeGit(),cat=categorize(prompts),repeated=findPatterns(prompts);const insights=[];if((git.patterns.fixes?.length||0)>(git.patterns.features?.length||0))insights.push('⚠️ Plus de fixes que de features - dette technique?');if(cat.bugs.length>cat.features.length)insights.push('ℹ️ Session debug: '+cat.bugs.length+' fixes vs '+cat.features.length+' features');const recs=repeated.filter(([,c])=>c>3).map(([w,c])=>'Documenter "'+w+'" ('+c+'x)');const report='# Rapport Post-Mortem\n\n*'+new Date().toISOString().split('T')[0]+'*\n\n## Résumé\n| Métrique | Valeur |\n|----------|--------|\n| Prompts | '+prompts.length+' |\n| Erreurs | '+errors.length+' |\n| Commits (30j) | '+git.total+' |\n| Fix/Feature | '+(git.patterns.fixes?.length||0)+'/'+(git.patterns.features?.length||0)+' |\n\n## Répartition\n- 🐛 Bugs: '+cat.bugs.length+'\n- ✨ Features: '+cat.features.length+'\n- ❓ Questions: '+cat.questions.length+'\n- 🔧 Refactoring: '+cat.refactoring.length+'\n- 📝 Autres: '+cat.other.length+'\n\n## Mots-clés\n'+(repeated.slice(0,10).map(([w,c])=>'- **'+w+'**: '+c+'x').join('\n')||'*Pas de données*')+'\n\n## Insights\n'+(insights.join('\n')||'*RAS*')+'\n\n## Recommandations\n'+(recs.map((r,i)=>(i+1)+'. '+r).join('\n')||'*Aucune*')+'\n';writeFileSync(REPORT_FILE,report);console.log('✅ Rapport: '+REPORT_FILE+'\n');console.log(report)}main();
JSEOF
chmod +x .claude/scripts/analyze.js

# Update .gitignore
if [ -f .gitignore ]; then
    if ! grep -q ".claude/logs/" .gitignore; then
        echo -e "\n# Claude Code Post-mortem\n.claude/logs/\n.claude/report.md\n.claude/settings.local.json" >> .gitignore
    fi
else
    echo -e "# Claude Code Post-mortem\n.claude/logs/\n.claude/report.md\n.claude/settings.local.json" > .gitignore
fi

# Add npm script if package.json exists
if [ -f package.json ]; then
    if command -v node &> /dev/null; then
        node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let modified = false;
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts.postmortem) {
    pkg.scripts.postmortem = 'node .claude/scripts/analyze.js';
    modified = true;
    console.log('✅ Script npm ajouté: npm run postmortem');
}
if (!pkg.type) {
    pkg.type = 'module';
    modified = true;
    console.log('✅ type: module ajouté au package.json');
}
if (modified) {
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
}
"
    fi
fi

echo ""
echo "✅ Installation terminée!"
echo ""
echo "Usage:"
echo "  npm run postmortem   # Générer un rapport"
echo ""
echo "Les prompts seront loggés automatiquement dès le prochain redémarrage de Claude Code."

'use strict';

const VENDOR = /(^|\/)(node_modules|vendor|bower_components|\.venv|venv|__pypackages__|target|build|dist|\.gradle|\.tox|site-packages|\.next|out)\//;

// ─────────────────────────── PACKAGE MANAGERS ───────────────────────────
// Référentiel cooldown : https://cooldowns.dev/
// La configurabilité est portée par le PACKAGE MANAGER, pas par l'écosystème
// (ex: en Python, uv et pixi sont configurables; pip / poetry / pdm / pipenv ne le sont pas).
const PACKAGE_MANAGERS = {
  // ── JS / Node : tous configurables côté repo
  npm: {
    cooldown: {
      configurable: true,
      configHint: '`min-release-age` dans `.npmrc`',
      detect: { file: /(^|\/)\.npmrc$/, content: /min-release-age\s*=/i },
    },
  },
  yarn: {
    cooldown: {
      configurable: true,
      configHint: '`npmMinimalAgeGate` dans `.yarnrc.yml`',
      detect: { file: /(^|\/)\.yarnrc\.yml$/, content: /npmMinimalAgeGate\s*:/i },
    },
  },
  pnpm: {
    cooldown: {
      configurable: true,
      configHint: '`minimumReleaseAge` dans `pnpm-workspace.yaml` / `.npmrc` / `.pnpmrc`',
      detect: { file: /(^|\/)(pnpm-workspace\.yaml|\.pnpmrc|\.npmrc)$/, content: /minimumReleaseAge\s*[:=]/i },
    },
  },
  bun: {
    cooldown: {
      configurable: true,
      configHint: '`minimumReleaseAge` dans `bunfig.toml`',
      detect: { file: /(^|\/)bunfig\.toml$/, content: /minimumReleaseAge\s*=/i },
    },
  },
  deno: {
    cooldown: {
      configurable: true,
      configHint: '`minimumDependencyAge` dans `deno.json(c)`',
      detect: { file: /(^|\/)deno\.jsonc?$/, content: /"minimumDependencyAge"\s*:/i },
    },
  },

  // ── Python : seuls uv et pixi sont configurables côté repo (cf. cooldowns.dev)
  pip: {
    cooldown: {
      configurable: false,
      note: "**pip** ne supporte pas le cooldown nativement côté repo applicatif (cf. https://cooldowns.dev/). À gérer en passant à **uv**, via un **proxy/cache PyPI** (devpi, Artifactory, Nexus, JFrog Curation) ou **Dependabot cooldown** dans `.github/dependabot.yml`.",
    },
  },
  uv: {
    cooldown: {
      configurable: true,
      configHint: '`exclude-newer` dans `[tool.uv]` de `pyproject.toml`',
      detect: { file: /(^|\/)pyproject\.toml$/, content: /\[tool\.uv\][\s\S]*exclude-newer\s*=/i },
    },
  },
  poetry: {
    cooldown: {
      configurable: false,
      note: "**Poetry** ne supporte pas le cooldown nativement côté repo applicatif (cf. https://cooldowns.dev/). À gérer via un **proxy/cache PyPI** ou **Dependabot cooldown**.",
    },
  },
  pdm: {
    cooldown: {
      configurable: false,
      note: "**PDM** ne supporte pas le cooldown nativement côté repo applicatif (cf. https://cooldowns.dev/). À gérer via un proxy/cache PyPI ou Dependabot cooldown.",
    },
  },
  pipenv: {
    cooldown: {
      configurable: false,
      note: "**Pipenv** ne supporte pas le cooldown nativement côté repo applicatif (cf. https://cooldowns.dev/). À gérer via un proxy/cache PyPI ou Dependabot cooldown.",
    },
  },
  pixi: {
    cooldown: {
      configurable: true,
      configHint: '`exclude-newer` dans `pixi.toml`',
      detect: { file: /(^|\/)pixi\.toml$/, content: /exclude-newer\s*=/i },
    },
  },

  // ── Ruby : configurable côté repo
  bundler: {
    cooldown: {
      configurable: true,
      configHint: '`cooldown` dans `Gemfile` ou `BUNDLE_COOLDOWN` dans `.bundle/config`',
      detect: { file: /(^|\/)(Gemfile|\.bundle\/config)$/, content: /(cooldown\s*:\s*\d+|BUNDLE_COOLDOWN|cooldown\s*=)/i },
    },
  },

  // ── Tous les autres : pas de cooldown natif côté repo applicatif
  composer: {
    cooldown: {
      configurable: false,
      note: "**Composer** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). À gérer côté registre/proxy (Packagist mirror, Repman, Nexus, Artifactory) ou Dependabot cooldown.",
    },
  },
  cargo: {
    cooldown: {
      configurable: false,
      note: "**Cargo** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). À gérer côté registre privé (crates.io mirror, Cloudsmith, Artifactory), via le plugin tiers `cargo-cooldown`, ou Dependabot cooldown.",
    },
  },
  nuget: {
    cooldown: {
      configurable: false,
      note: "**NuGet** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). À gérer côté feed amont (Azure Artifacts upstream sources, Artifactory, Nexus, ProGet) ou Dependabot cooldown.",
    },
  },
  maven: {
    cooldown: {
      configurable: false,
      note: "**Maven** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). À gérer dans le manager de dépôt (Nexus, Artifactory) ou Dependabot cooldown.",
    },
  },
  gradle: {
    cooldown: {
      configurable: false,
      note: "**Gradle** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). Activer `dependency-locking` Gradle + quarantaine côté manager de dépôt, ou Dependabot cooldown.",
    },
  },
  'github-actions': {
    cooldown: {
      configurable: false,
      note: "**GitHub Actions** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). Utiliser **Dependabot cooldown** (`updates[].cooldown` dans `.github/dependabot.yml`) + allowlist d'actions au niveau org + pinning SHA40.",
    },
  },
  docker: {
    cooldown: {
      configurable: false,
      note: "**Docker** ne supporte pas le cooldown nativement côté repo (cf. https://cooldowns.dev/). À gérer côté registry privé (Harbor, Artifactory, ECR pull-through cache) + politique d'admission (Cosign / Kyverno), ou Dependabot cooldown.",
    },
  },
};

// ─────────────────────────── ECOSYSTEMS ───────────────────────────
const ECOSYSTEMS = {
  npm: {
    label: '📦 JavaScript / Node.js',
    manifests: [
      /(^|\/)package\.json$/, /(^|\/)\.npmrc$/, /(^|\/)\.yarnrc\.yml$/,
      /(^|\/)bunfig\.toml$/,  /(^|\/)deno\.jsonc?$/,
      /(^|\/)pnpm-workspace\.yaml$/, /(^|\/)\.pnpmrc$/,
    ],
    primaryManifest: /(^|\/)package\.json$/,
    lockfile: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|bun\.lockb?|deno\.lock)$/,
    async detectPMs({ paths }) {
      const s = new Set();
      if (paths.some(p => /(^|\/)yarn\.lock$/.test(p) || /(^|\/)\.yarnrc\.yml$/.test(p))) s.add('yarn');
      if (paths.some(p => /(^|\/)pnpm-lock\.yaml$/.test(p) || /(^|\/)(pnpm-workspace\.yaml|\.pnpmrc)$/.test(p))) s.add('pnpm');
      if (paths.some(p => /(^|\/)bun\.lockb?$/.test(p) || /(^|\/)bunfig\.toml$/.test(p))) s.add('bun');
      if (paths.some(p => /(^|\/)deno\.lock$/.test(p) || /(^|\/)deno\.jsonc?$/.test(p))) s.add('deno');
      if (paths.some(p => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/.test(p))) s.add('npm');
      if (!s.size) s.add('npm');
      return [...s];
    },
    parse(c, filename) {
      if (!/package\.json$/.test(filename)) return [];
      let p; try { p = JSON.parse(c); } catch { return []; }
      const out = [];
      for (const s of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])
        for (const [name, range] of Object.entries(p[s] || {})) out.push({ section: s, name, range });
      return out;
    },
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^(git\+|github:|file:|link:|workspace:|npm:|http)/i.test(v)) return 'external-ref';
      if (/^=?\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^(git\+|github:|file:|link:|workspace:|npm:|http)/i.test(v)) return 'external-ref';
      if (v === '*' || /^latest$/i.test(v) || /^x(\.x){0,2}$/i.test(v)) return 'wildcard';
      if (v.startsWith('^')) return 'caret (^)';
      if (v.startsWith('~')) return 'tilde (~)';
      if (/^>=?\s*\d/.test(v) && !/<\s*\d/.test(v)) return 'borne supérieure ouverte';
      if (/\s\|\|\s/.test(v)) return 'union OR (||)';
      if (/^\d+\.[xX*]/.test(v)) return 'wildcard';
      return null;
    },
  },

  pypi: {
    label: '🐍 Python',
    manifests: [/(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i, /(^|\/)pip\.conf$/i],
    primaryManifest: /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i,
    lockfile: /(^|\/)(requirements\.lock|requirements-lock\.txt|poetry\.lock|pdm\.lock|uv\.lock|Pipfile\.lock|pixi\.lock)$/i,
    async detectPMs({ paths, blobs, readContent }) {
      const s = new Set();
      // Détection par lockfile (signal le plus fiable)
      if (paths.some(p => /(^|\/)uv\.lock$/.test(p)))            s.add('uv');
      if (paths.some(p => /(^|\/)poetry\.lock$/.test(p)))        s.add('poetry');
      if (paths.some(p => /(^|\/)pdm\.lock$/.test(p)))           s.add('pdm');
      if (paths.some(p => /(^|\/)Pipfile(\.lock)?$/.test(p)))    s.add('pipenv');
      if (paths.some(p => /(^|\/)pixi\.(lock|toml)$/.test(p)))   s.add('pixi');

      // Inspection du contenu de pyproject.toml pour identifier l'outil
      const pyprojects = blobs.filter(b => /(^|\/)pyproject\.toml$/.test(b.path));
      for (const pp of pyprojects) {
        const c = await readContent(pp);
        if (!c) continue;
        if (/\[tool\.uv\]/i.test(c))     s.add('uv');
        if (/\[tool\.poetry\]/i.test(c)) s.add('poetry');
        if (/\[tool\.pdm\]/i.test(c))    s.add('pdm');
      }

      // Fallback pip si rien d'autre n'est détecté
      if (!s.size && (paths.some(p => /requirements[^/]*\.txt$/.test(p)) || pyprojects.length)) {
        s.add('pip');
      }
      return [...s];
    },
    parse(c, filename) {
      const o = [];
      if (/requirements[^/]*\.txt$/i.test(filename)) {
        for (const raw of c.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line || line.startsWith('#') || /^-/.test(line)) continue;
          if (/^(git\+|https?:|file:)/.test(line)) continue;
          const m = line.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*((?:(?:==|>=|<=|>|<|~=|!=|===)\s*[^,;\s]+\s*,?\s*)+)?/);
          if (!m) continue;
          o.push({ section: 'requirements', name: m[1], range: (m[3] || '').trim().replace(/\s+/g, '') });
        }
      } else if (/pyproject\.toml$/.test(filename)) {
        const grab = (re, sec) => {
          const m = c.match(re); if (!m) return;
          for (const line of m[1].split(/\r?\n/)) {
            const t = line.trim(); if (!t || t.startsWith('#')) continue;
            let mm = t.match(/^([A-Za-z0-9_\-.]+)\s*=\s*"([^"]+)"/);
            if (mm) { o.push({ section: sec, name: mm[1], range: mm[2] }); continue; }
            mm = t.match(/^([A-Za-z0-9_\-.]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
            if (mm) o.push({ section: sec, name: mm[1], range: mm[2] });
          }
        };
        grab(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/, 'poetry');
        grab(/\[tool\.poetry\.group\.[^\]]+\.dependencies\]([\s\S]*?)(?=\n\[|$)/, 'poetry-group');
        const pj = c.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
        if (pj) for (const line of pj[1].split(/\r?\n/)) {
          const m = line.match(/"([^"]+)"/); if (!m) continue;
          const nm = m[1].match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*([^;]*?)/);
          if (nm) o.push({ section: 'project', name: nm[1], range: (nm[3] || '').trim() });
        }
      } else if (/Pipfile$/.test(filename)) {
        const grab = (re, sec) => {
          const m = c.match(re); if (!m) return;
          for (const line of m[1].split(/\r?\n/)) {
            const t = line.trim(); if (!t || t.startsWith('#')) continue;
            const mm = t.match(/^([A-Za-z0-9_\-.]+)\s*=\s*"([^"]+)"/);
            if (mm) o.push({ section: sec, name: mm[1], range: mm[2] });
          }
        };
        grab(/\[packages\]([\s\S]*?)(?=\n\[|$)/, 'packages');
        grab(/\[dev-packages\]([\s\S]*?)(?=\n\[|$)/, 'dev-packages');
      }
      return o;
    },
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^==[^,*]+$/.test(v) || /^===/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (v === '*' || /[*]/.test(v)) return 'wildcard';
      if (v.startsWith('^')) return 'caret (^)';
      if (v.startsWith('~') && !v.startsWith('~=')) return 'tilde (~)';
      if (/~=/.test(v)) return 'compatible release (~=)';
      if (/^==[^,*]+$/.test(v) || /^===/.test(v)) return null;
      if (/(>=|>)/.test(v) && !/(<=|<)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  composer: {
    label: '🐘 Composer (PHP)',
    manifests: [/(^|\/)composer\.json$/],
    primaryManifest: /(^|\/)composer\.json$/,
    lockfile: /(^|\/)composer\.lock$/,
    async detectPMs() { return ['composer']; },
    parse(c) { let p; try { p = JSON.parse(c); } catch { return []; }
      const o = [];
      for (const s of ['require','require-dev']) for (const [n, r] of Object.entries(p[s] || {})) {
        if (n === 'php' || n.startsWith('ext-') || n.startsWith('lib-')) continue;
        o.push({ section: s, name: n, range: r });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (v === '*' || /\.\*/.test(v)) return 'wildcard';
      if (v.startsWith('^')) return 'caret (^)';
      if (v.startsWith('~')) return 'tilde (~)';
      if (/^dev-/.test(v)) return 'dev branch';
      if (/^>=?\s*\d/.test(v) && !/<\s*\d/.test(v)) return 'borne supérieure ouverte';
      if (/\s\|\|\s/.test(v)) return 'union OR (||)';
      return null;
    },
  },

  cargo: {
    label: '🦀 Cargo (Rust)',
    manifests: [/(^|\/)Cargo\.toml$/, /(^|\/)\.cargo\/config\.toml$/],
    primaryManifest: /(^|\/)Cargo\.toml$/,
    lockfile: /(^|\/)Cargo\.lock$/,
    async detectPMs() { return ['cargo']; },
    parse(c, filename) {
      if (!/Cargo\.toml$/.test(filename)) return [];
      const o = []; const re = /\[(dependencies|dev-dependencies|build-dependencies|target\.[^.\]]+\.dependencies)\]([\s\S]*?)(?=\n\[|$)/g;
      let s;
      while ((s = re.exec(c)) !== null) for (const line of s[2].split(/\r?\n/)) {
        const t = line.trim(); if (!t || t.startsWith('#')) continue;
        let m = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/);
        if (m) { o.push({ section: s[1], name: m[1], range: m[2] }); continue; }
        m = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
        if (m) o.push({ section: s[1], name: m[1], range: m[2] });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^=\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (v === '*') return 'wildcard';
      if (v.startsWith('^')) return 'caret (^)';
      if (v.startsWith('~')) return 'tilde (~)';
      if (v.startsWith('=')) return null;
      if (/^>=?\s*\d/.test(v) && !/<\s*\d/.test(v)) return 'borne supérieure ouverte';
      if (/^\d/.test(v)) return 'caret implicite (défaut Cargo)';
      return null;
    },
  },

  ruby: {
    label: '💎 Ruby',
    manifests: [/(^|\/)Gemfile$/, /(^|\/)\.bundle\/config$/],
    primaryManifest: /(^|\/)Gemfile$/,
    lockfile: /(^|\/)Gemfile\.lock$/,
    async detectPMs() { return ['bundler']; },
    parse(c, filename) {
      if (!/Gemfile$/.test(filename)) return [];
      const o = []; const re = /^\s*gem\s+['"]([^'"]+)['"](.*)$/gm; let m;
      while ((m = re.exec(c)) !== null) {
        const name = m[1], rest = m[2] || '', vs = [];
        const vRe = /['"]([^'"]+)['"]/g; let vm;
        while ((vm = vRe.exec(rest)) !== null) if (/^[~<>=]|^\d/.test(vm[1])) vs.push(vm[1]);
        o.push({ section: 'gemfile', name, range: vs.join(', ') });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v) || /^=\s*\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^~>/.test(v)) return 'pessimistic (~>)';
      if (/^(>=|>)/.test(v) && !/(<=|<)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  dotnet: {
    label: '🔷 NuGet (.NET)',
    manifests: [/\.(csproj|fsproj|vbproj)$/i],
    primaryManifest: /\.(csproj|fsproj|vbproj)$/i,
    lockfile: /(^|\/)packages\.lock\.json$/i,
    async detectPMs() { return ['nuget']; },
    parse(c) {
      const o = []; let m;
      const re1 = /<PackageReference\b[^>]*\bInclude\s*=\s*"([^"]+)"[^>]*\bVersion\s*=\s*"([^"]+)"/gi;
      while ((m = re1.exec(c)) !== null) o.push({ section: 'PackageReference', name: m[1], range: m[2] });
      const re2 = /<PackageReference\b[^>]*\bInclude\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/PackageReference>/gi;
      while ((m = re2.exec(c)) !== null) {
        if (o.find(x => x.name === m[1])) continue;
        const vm = m[2].match(/<Version>([^<]+)<\/Version>/i);
        if (vm) o.push({ section: 'PackageReference', name: m[1], range: vm[1] });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (/\*/.test(v)) return 'wildcard / floating';
      if (/^\[\d[^,]*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      if (/^\(/.test(v)) return 'range sans pin bas';
      return null;
    },
  },

  maven: {
    label: '☕ Maven',
    manifests: [/(^|\/)pom\.xml$/],
    primaryManifest: /(^|\/)pom\.xml$/,
    lockfile: null,
    async detectPMs() { return ['maven']; },
    parse(c, filename) {
      if (!/pom\.xml$/.test(filename)) return [];
      const o = []; const re = /<dependency>([\s\S]*?)<\/dependency>/gi; let m;
      while ((m = re.exec(c)) !== null) {
        const b = m[1];
        const g = b.match(/<groupId>([^<]+)<\/groupId>/i);
        const a = b.match(/<artifactId>([^<]+)<\/artifactId>/i);
        const v = b.match(/<version>([^<]+)<\/version>/i);
        if (a) o.push({ section: 'dependencies', name: `${g ? g[1] + ':' : ''}${a[1]}`, range: v ? v[1] : '' });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\$\{/.test(v)) return 'property-ref';
      if (/^\d+(\.\d+){1,3}$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\$\{/.test(v)) return null;
      if (/^(LATEST|RELEASE)$/i.test(v)) return v.toUpperCase() + ' (mutable)';
      if (/^\[.*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  gradle: {
    label: '🐘 Gradle',
    manifests: [/(^|\/)build\.gradle(\.kts)?$/],
    primaryManifest: /(^|\/)build\.gradle(\.kts)?$/,
    lockfile: /(^|\/)gradle\.lockfile$/,
    async detectPMs() { return ['gradle']; },
    parse(c, filename) {
      if (!/build\.gradle(\.kts)?$/.test(filename)) return [];
      const o = []; const re = /\b(implementation|api|compile|runtimeOnly|testImplementation|testCompile|annotationProcessor|kapt|classpath)\s*[\(\s]\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        const parts = m[2].split(':');
        if (parts.length >= 3) o.push({ section: m[1], name: `${parts[0]}:${parts[1]}`, range: parts.slice(2).join(':') });
        else o.push({ section: m[1], name: m[2], range: '' });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/^\d+(\.\d+){1,3}$/.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (!v) return 'unpinned';
      if (/[+]/.test(v)) return 'wildcard (+)';
      if (/^latest\./i.test(v)) return 'latest.* (mutable)';
      if (/^\[.*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  actions: {
    label: '⚡ GitHub Actions',
    manifests: [/^\.github\/workflows\/.+\.ya?ml$/],
    primaryManifest: /^\.github\/workflows\/.+\.ya?ml$/,
    lockfile: null,
    async detectPMs() { return ['github-actions']; },
    parse(c, filename) {
      if (!/^\.github\/workflows\/.+\.ya?ml$/.test(filename)) return [];
      const o = []; const re = /^\s*-?\s*uses:\s*['"]?([^@'"\s]+)@([^'"\s#]+)/gm; let m;
      while ((m = re.exec(c)) !== null) {
        if (m[1].startsWith('./') || m[1].startsWith('docker://')) continue;
        o.push({ section: 'uses', name: m[1], range: m[2] });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (/^[a-f0-9]{40}$/i.test(v)) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (/^[a-f0-9]{40}$/i.test(v)) return null;
      if (/^(main|master|develop|trunk|HEAD)$/i.test(v)) return 'BRANCH (très risqué)';
      if (/^v?\d+$/.test(v)) return 'tag majeur (mutable)';
      if (/^v?\d+\.\d+(\.\d+)?$/.test(v)) return 'tag mineur/patch (mutable)';
      return 'ref mutable';
    },
  },

  docker: {
    label: '🐳 Docker',
    manifests: [/(^|\/)Dockerfile([._-].*)?$/],
    primaryManifest: /(^|\/)Dockerfile([._-].*)?$/,
    lockfile: null,
    async detectPMs() { return ['docker']; },
    parse(c, filename) {
      if (!/Dockerfile([._-].*)?$/.test(filename)) return [];
      const o = []; const re = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+\S+)?/gim; let m;
      while ((m = re.exec(c)) !== null) {
        let ref = m[1]; if (ref.startsWith('$') || ref === 'scratch') continue;
        let image = ref, tag = '', digest = '';
        const at = ref.indexOf('@');
        if (at >= 0) { digest = ref.slice(at + 1); image = ref.slice(0, at); }
        const lc = image.lastIndexOf(':'), ls = image.lastIndexOf('/');
        if (lc > ls) { tag = image.slice(lc + 1); image = image.slice(0, lc); }
        o.push({ section: 'FROM', name: image, range: digest ? '@' + digest : (tag || 'latest') });
      }
      return o;
    },
    pinState(r) { const v = (r||'').trim();
      if (v.startsWith('@sha256:')) return 'pinned';
      return 'floating';
    },
    riskClass(r) { const v = (r||'').trim();
      if (v.startsWith('@sha256:')) return null;
      if (v === 'latest' || v === '') return 'tag latest (très risqué)';
      if (/^\d+$/.test(v)) return 'tag majeur (mutable)';
      if (/^\d+\.\d+/.test(v)) return 'tag versionné (mutable)';
      return 'tag (mutable)';
    },
  },
};

// ─────────────────────────── HELPERS ───────────────────────────
async function readFile(github, owner, repo, p, sha) {
  try {
    const r = await github.rest.repos.getContent({ owner, repo, path: p });
    if (r.data && r.data.content) return Buffer.from(r.data.content, 'base64').toString('utf8');
  } catch {}
  try {
    const r = await github.rest.git.getBlob({ owner, repo, file_sha: sha });
    return Buffer.from(r.data.content, 'base64').toString('utf8');
  } catch { return null; }
}

async function detectCooldownsForRepo({ github, repo, blobs, packageManagers }) {
  const out = {};
  for (const pmKey of packageManagers) {
    const pm = PACKAGE_MANAGERS[pmKey];
    if (!pm) { out[pmKey] = { configurable: false, note: 'PM non répertorié.', configured: false, sources: [] }; continue; }

    if (!pm.cooldown.configurable) {
      out[pmKey] = { configurable: false, note: pm.cooldown.note, configured: false, sources: [] };
      continue;
    }

    const sources = [];
    const detect = pm.cooldown.detect;
    if (detect) {
      const candidates = blobs.filter(b => detect.file.test(b.path));
      for (const f of candidates) {
        const content = await readFile(github, repo.owner, repo.name, f.path, f.sha);
        if (content && detect.content.test(content)) sources.push({ file: f.path });
      }
    }

    out[pmKey] = {
      configurable: true,
      configHint: pm.cooldown.configHint,
      configured: sources.length > 0,
      sources,
    };
  }
  return out;
}

// ─────────────────────────── EXPORTED API ───────────────────────────
async function listRepos({ github, context, scope, orgs, currentOrg, includeArchived, includeForks }) {
  let repos = [];
  if (scope === 'this-repo-only') {
    const { data } = await github.rest.repos.get({ owner: context.repo.owner, repo: context.repo.repo });
    repos = [data];
  } else if (scope === 'current-org') {
    repos = await github.paginate(github.rest.repos.listForOrg, { org: currentOrg, type: 'all', per_page: 100 });
  } else if (scope === 'multi-orgs') {
    if (!orgs || !orgs.length) throw new Error('scope=multi-orgs nécessite la liste des orgs (input "orgs")');
    for (const org of orgs) {
      try {
        const r = await github.paginate(github.rest.repos.listForOrg, { org, type: 'all', per_page: 100 });
        repos.push(...r);
      } catch (e) { console.warn(`⚠️ Org ${org}: ${e.message}`); }
    }
  }
  return repos
    .filter(r => includeArchived || !r.archived)
    .filter(r => includeForks || !r.fork)
    .map(r => ({
      owner: r.owner.login, name: r.name, full_name: r.full_name,
      default_branch: r.default_branch, private: r.private,
    }));
}

function getEnabledEcosystems(input) {
  const req = (input || 'all').toLowerCase().split(',').map(s => s.trim());
  const all = req.includes('all') || req.includes('');
  return Object.keys(ECOSYSTEMS).filter(k => all || req.includes(k));
}

async function auditEcosystem({ github, core, ecosystemKey, repos }) {
  const eco = ECOSYSTEMS[ecosystemKey];
  if (!eco) throw new Error(`Unknown ecosystem: ${ecosystemKey}`);

  const results = [];
  for (const repo of repos) {
    try {
      const tree = await github.rest.git.getTree({
        owner: repo.owner, repo: repo.name,
        tree_sha: repo.default_branch, recursive: 'true',
      });
      const blobs = tree.data.tree.filter(t =>
        t.type === 'blob' && !VENDOR.test(t.path) && (t.size || 0) < 800000);

      const manifests = blobs.filter(b => eco.manifests.some(re => re.test(b.path)));
      const primaryManifests = manifests.filter(b => eco.primaryManifest.test(b.path));
      if (!primaryManifests.length) continue;

      const lockfiles = eco.lockfile ? blobs.filter(b => eco.lockfile.test(b.path)).map(b => b.path) : [];
      const allPaths = manifests.map(m => m.path).concat(lockfiles);

      const readContent = (b) => readFile(github, repo.owner, repo.name, b.path, b.sha);
      const packageManagers = await eco.detectPMs({ paths: allPaths, blobs, readContent });
      const cooldownsPerPM = await detectCooldownsForRepo({ github, repo, blobs, packageManagers });

      let pinned = 0, floating = 0, unpinned = 0, externalRefs = 0;
      const findings = [];
      for (const f of primaryManifests) {
        const content = await readContent(f);
        if (!content) continue;
        let deps = [];
        try { deps = eco.parse(content, f.path); } catch {}
        for (const d of deps) {
          const state = eco.pinState(d.range);
          if (state === 'pinned') pinned++;
          else if (state === 'floating') floating++;
          else if (state === 'unpinned') unpinned++;
          else externalRefs++;
          const risk = eco.riskClass ? eco.riskClass(d.range) : null;
          findings.push({ path: f.path, ...d, pinState: state, risk });
        }
      }

      results.push({
        full: repo.full_name,
        private: repo.private,
        packageManagers,
        manifests: primaryManifests.map(m => m.path),
        lockfiles,
        cooldownsPerPM,
        counts: { total: pinned + floating + unpinned + externalRefs, pinned, floating, unpinned, externalRefs },
        findings,
      });
    } catch (e) {
      core.warning(`Skip ${repo.full_name} [${ecosystemKey}]: ${e.message}`);
    }
  }

  return {
    ecosystem: ecosystemKey,
    label: eco.label,
    hasLockfileType: eco.lockfile !== null,
    results,
  };
}

function renderCooldownPerPM(cooldownsPerPM) {
  const lines = [];
  for (const [pmKey, c] of Object.entries(cooldownsPerPM)) {
    if (c.configurable) {
      if (c.configured) {
        lines.push(`  - **${pmKey}** → ✅ cooldown configuré dans ${c.sources.map(s => '`' + s.file + '`').join(', ')} (clé : ${c.configHint})`);
      } else {
        lines.push(`  - **${pmKey}** → ⚠️ cooldown natif **supporté** mais **non configuré** dans ce repo. À activer via ${c.configHint}.`);
      }
    } else {
      lines.push(`  - **${pmKey}** → 🚫 ${c.note}`);
    }
  }
  return lines.join('\n');
}

function buildReport(allData, meta) {
  const repoMap = new Map();
  const ecoStats = new Map();
  let totalFloating = 0, totalPinned = 0;

  for (const [key, data] of Object.entries(allData)) {
    let ecoFloating = 0, ecoPinned = 0;
    for (const r of data.results) {
      if (!repoMap.has(r.full)) repoMap.set(r.full, { private: r.private, ecos: {} });
      repoMap.get(r.full).ecos[key] = {
        label: data.label,
        hasLockfileType: data.hasLockfileType,
        packageManagers: r.packageManagers,
        manifests: r.manifests,
        lockfiles: r.lockfiles,
        cooldownsPerPM: r.cooldownsPerPM,
        counts: r.counts,
        findings: r.findings,
      };
      ecoFloating += r.counts.floating + r.counts.unpinned;
      ecoPinned   += r.counts.pinned;
    }
    ecoStats.set(key, { label: data.label, repos: data.results.length, floating: ecoFloating, pinned: ecoPinned });
    totalFloating += ecoFloating;
    totalPinned   += ecoPinned;
  }

  let md = `# 🛡️🔎 Supply-chain combined audit\n\n`;
  md += `_Run: **${meta.date} ${meta.time.slice(0,2)}:${meta.time.slice(2,4)}:${meta.time.slice(4,6)} UTC**_  \n`;
  md += `_Source: [workflow run](${meta.runUrl})_  \n`;
  md += `_Référentiel cooldown : https://cooldowns.dev/_\n\n`;

  md += `## Ce qui est audité par repo\n\n`;
  md += `1. **Package manager(s) utilisé(s)** (détecté via lockfiles, manifests, sections \`[tool.X]\` de \`pyproject.toml\`)\n`;
  md += `2. **Dépendances pinnées vs flottantes**\n`;
  md += `3. **Présence d'un lockfile / mécanisme de lock**\n`;
  md += `4. **Cooldown natif** du package manager — explicitement marqué 🚫 quand la configuration **ne peut pas se faire côté repo applicatif**\n\n`;

  md += `## Synthèse\n\n`;
  md += `- Repos analysés : **${repoMap.size}**\n`;
  md += `- Dépendances pinnées : **${totalPinned}**\n`;
  md += `- Dépendances flottantes / non versionnées : **${totalFloating}**\n\n`;

  md += `### Par écosystème\n\n| Écosystème | Repos | Pinned | Floating/Unpinned |\n|---|---:|---:|---:|\n`;
  for (const [, s] of ecoStats) md += `| ${s.label} | ${s.repos} | ${s.pinned} | ${s.floating} |\n`;
  md += `\n`;

  if (!repoMap.size) { md += `_Aucun manifeste détecté._\n`; return md; }

  md += `## Détail par repo\n\n`;
  const sorted = [...repoMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [full, repo] of sorted) {
    md += `### [${full}](https://github.com/${full}) ${repo.private ? '🔒' : ''}\n\n`;

    for (const [, eco] of Object.entries(repo.ecos)) {
      const lock = !eco.hasLockfileType
        ? '_(pas de lockfile dans cet écosystème)_'
        : (eco.lockfiles.length ? '✅ ' + eco.lockfiles.map(x => '`' + x + '`').join(', ') : '⚠️ **non**');
      const pm = (eco.packageManagers || []).map(x => '`' + x + '`').join(', ') || '_indéterminé_';

      md += `<details open><summary><b>${eco.label}</b> — PM: ${pm} — lockfile: ${lock}</summary>\n\n`;
      md += `- **Package manager(s) détecté(s)** : ${pm}\n`;
      md += `- **Manifests** : ${eco.manifests.map(x => '`' + x + '`').join(', ')}\n`;
      md += `- **Lockfile / mécanisme de lock** : ${lock}\n`;
      md += `- **Cooldown natif** (par PM) :\n${renderCooldownPerPM(eco.cooldownsPerPM)}\n`;
      md += `- **Pinning** : total **${eco.counts.total}** — pinned **${eco.counts.pinned}** — floating **${eco.counts.floating}** — unpinned **${eco.counts.unpinned}** — refs externes **${eco.counts.externalRefs}**\n\n`;

      md += `| Fichier | Dépendance | Plage / ref | État | Type |\n|---|---|---|---|---|\n`;
      for (const f of eco.findings.slice(0, 80)) {
        md += `| \`${f.path}\` | \`${f.name}\` | \`${(f.range || '').slice(0, 80)}\` | ${f.pinState} | ${f.risk || '—'} |\n`;
      }
      if (eco.findings.length > 80) md += `| … | … | … | … | _+${eco.findings.length - 80} de plus_ |\n`;
      md += `\n</details>\n\n`;
    }
  }

  md += `---\n\n## Légende\n\n`;
  md += `### Pinning\n`;
  md += `- **pinned** : version exacte / SHA40 / digest immuable\n`;
  md += `- **floating** : plage semver, tag mutable, branche, range ouverte\n`;
  md += `- **unpinned** : aucune version spécifiée\n`;
  md += `- **external-ref** : git+, file:, link:, workspace:, etc.\n\n`;
  md += `### Cooldown — réf. https://cooldowns.dev/\n\n`;
  md += `**Configurable côté repo applicatif** :\n`;
  md += `- npm (\`min-release-age\`), yarn (\`npmMinimalAgeGate\`), pnpm (\`minimumReleaseAge\`), bun (\`minimumReleaseAge\`), deno (\`minimumDependencyAge\`)\n`;
  md += `- uv (\`exclude-newer\`), pixi (\`exclude-newer\`)\n`;
  md += `- bundler (\`cooldown\` / \`BUNDLE_COOLDOWN\`)\n\n`;
  md += `**Non** configurable côté repo applicatif → à gérer via proxy / registre / Dependabot cooldown :\n`;
  md += `- **pip**, poetry, pdm, pipenv\n`;
  md += `- composer, cargo, nuget, maven, gradle\n`;
  md += `- github-actions, docker\n`;

  return md;
}


// ─────────────────────────── CSV EXPORT ───────────────────────────
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  // RFC 4180 : on quote si , " CR LF, et on double les guillemets
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(cols) { return cols.map(csvEscape).join(','); }

/**
 * CSV "dépendances" — 1 ligne par dépendance trouvée dans un manifest
 * Colonnes :
 *   repo, private, ecosystem, package_managers, manifest, section,
 *   package, range, pin_state, risk_type
 */
function buildDependenciesCsv(allData) {
  const header = [
    'repo','private','ecosystem','package_managers',
    'manifest','section','package','range','pin_state','risk_type',
  ];
  const lines = [csvRow(header)];

  for (const [ecoKey, data] of Object.entries(allData)) {
    for (const r of data.results) {
      const pms = (r.packageManagers || []).join(';');
      for (const f of r.findings) {
        lines.push(csvRow([
          r.full,
          r.private ? 'true' : 'false',
          ecoKey,
          pms,
          f.path,
          f.section,
          f.name,
          f.range,
          f.pinState,
          f.risk || '',
        ]));
      }
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * CSV "package managers" — 1 ligne par (repo × package_manager)
 * Colonnes :
 *   repo, private, ecosystem, package_manager,
 *   cooldown_configurable_in_repo, cooldown_configured,
 *   cooldown_sources, cooldown_config_hint, cooldown_note,
 *   lockfile_supported, lockfile_present, lockfiles,
 *   deps_total, deps_pinned, deps_floating, deps_unpinned, deps_external_refs
 */
function buildPackageManagersCsv(allData) {
  const header = [
    'repo','private','ecosystem','package_manager',
    'cooldown_configurable_in_repo','cooldown_configured',
    'cooldown_sources','cooldown_config_hint','cooldown_note',
    'lockfile_supported','lockfile_present','lockfiles',
    'deps_total','deps_pinned','deps_floating','deps_unpinned','deps_external_refs',
  ];
  const lines = [csvRow(header)];

  for (const [ecoKey, data] of Object.entries(allData)) {
    for (const r of data.results) {
      for (const pmKey of (r.packageManagers || [])) {
        const c = (r.cooldownsPerPM || {})[pmKey] || {};
        lines.push(csvRow([
          r.full,
          r.private ? 'true' : 'false',
          ecoKey,
          pmKey,
          c.configurable ? 'true' : 'false',
          c.configured ? 'true' : 'false',
          (c.sources || []).map(s => s.file).join(';'),
          c.configHint || '',
          c.note || '',
          data.hasLockfileType ? 'true' : 'false',
          (r.lockfiles && r.lockfiles.length) ? 'true' : 'false',
          (r.lockfiles || []).join(';'),
          r.counts.total,
          r.counts.pinned,
          r.counts.floating,
          r.counts.unpinned,
          r.counts.externalRefs,
        ]));
      }
    }
  }
  return lines.join('\n') + '\n';
}

// ─────────────────────────── EXPORTS ───────────────────────────
// ⚠️ Remplacer la ligne `module.exports = { ... }` existante par celle-ci :
module.exports = {
  ECOSYSTEMS,
  PACKAGE_MANAGERS,
  listRepos,
  getEnabledEcosystems,
  auditEcosystem,
  buildReport,
  buildDependenciesCsv,
  buildPackageManagersCsv,
};

'use strict';

const VENDOR = /(^|\/)(node_modules|vendor|bower_components|\.venv|venv|__pypackages__|target|build|dist|\.gradle|\.tox|site-packages|\.next|out)\//;

// ─────────────────────────── ECOSYSTEMS ───────────────────────────
const ECOSYSTEMS = {
  npm: {
    label: '📦 JavaScript / Node.js',
    manifests: [
      /(^|\/)package\.json$/,
      /(^|\/)\.npmrc$/,
      /(^|\/)\.yarnrc\.yml$/,
      /(^|\/)bunfig\.toml$/,
      /(^|\/)deno\.jsonc?$/,
      /(^|\/)pnpm-workspace\.yaml$/,
      /(^|\/)\.pnpmrc$/,
    ],
    primaryManifest: /(^|\/)package\.json$/,
    lockfile: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|bun\.lockb?|deno\.lock)$/,
    cooldownConfigurableInRepo: true,
    cooldownDetect: [
      { file: /(^|\/)\.npmrc$/,                                   content: /min-release-age\s*=/i,          pm: 'npm',  key: 'min-release-age' },
      { file: /(^|\/)\.yarnrc\.yml$/,                             content: /npmMinimalAgeGate\s*:/i,        pm: 'yarn', key: 'npmMinimalAgeGate' },
      { file: /(^|\/)bunfig\.toml$/,                              content: /minimumReleaseAge\s*=/i,        pm: 'bun',  key: 'minimumReleaseAge' },
      { file: /(^|\/)deno\.jsonc?$/,                              content: /"minimumDependencyAge"\s*:/i,   pm: 'deno', key: 'minimumDependencyAge' },
      { file: /(^|\/)(pnpm-workspace\.yaml|\.pnpmrc|\.npmrc)$/,   content: /minimumReleaseAge\s*[:=]/i,     pm: 'pnpm', key: 'minimumReleaseAge' },
    ],
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
    pmFromPaths(paths) {
      const s = new Set();
      for (const p of paths) {
        if (/(^|\/)package-lock\.json$/.test(p) || /(^|\/)npm-shrinkwrap\.json$/.test(p)) s.add('npm');
        if (/(^|\/)yarn\.lock$/.test(p) || /(^|\/)\.yarnrc\.yml$/.test(p)) s.add('yarn');
        if (/(^|\/)pnpm-lock\.yaml$/.test(p) || /(^|\/)pnpm-workspace\.yaml$/.test(p) || /(^|\/)\.pnpmrc$/.test(p)) s.add('pnpm');
        if (/(^|\/)bun\.lockb?$/.test(p) || /(^|\/)bunfig\.toml$/.test(p)) s.add('bun');
        if (/(^|\/)deno\.lock$/.test(p) || /(^|\/)deno\.jsonc?$/.test(p)) s.add('deno');
      }
      return s.size ? [...s] : ['npm (par défaut)'];
    },
  },

  pypi: {
    label: '🐍 Python',
    manifests: [/(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i, /(^|\/)pip\.conf$/i],
    primaryManifest: /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i,
    lockfile: /(^|\/)(requirements\.lock|requirements-lock\.txt|poetry\.lock|pdm\.lock|uv\.lock|Pipfile\.lock|pixi\.lock)$/i,
    cooldownConfigurableInRepo: true,
    cooldownDetect: [
      { file: /pyproject\.toml$/, content: /\[tool\.uv\][\s\S]*exclude-newer\s*=/i,        pm: 'uv',     key: 'exclude-newer' },
      { file: /pyproject\.toml$/, content: /\[solver\][\s\S]*min-release-age\s*=/i,        pm: 'poetry', key: 'solver.min-release-age' },
      { file: /(^|\/)pip\.conf$/, content: /uploaded-prior-to\s*=/i,                       pm: 'pip',    key: 'uploaded-prior-to' },
      { file: /pixi\.toml$/,      content: /exclude-newer\s*=/i,                           pm: 'pixi',   key: 'exclude-newer' },
    ],
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
    pmFromPaths(paths) {
      const s = new Set();
      for (const p of paths) {
        if (/(^|\/)poetry\.lock$/.test(p)) s.add('poetry');
        if (/(^|\/)pdm\.lock$/.test(p)) s.add('pdm');
        if (/(^|\/)uv\.lock$/.test(p)) s.add('uv');
        if (/(^|\/)Pipfile(\.lock)?$/.test(p)) s.add('pipenv');
        if (/(^|\/)pixi\.(lock|toml)$/.test(p)) s.add('pixi');
        if (/requirements[^/]*\.txt$/.test(p)) s.add('pip');
        if (/pyproject\.toml$/.test(p) && !/(^|\/)poetry\.lock$/.test(paths.join('\n'))) s.add('pyproject (pip/uv)');
      }
      return s.size ? [...s] : ['pip (par défaut)'];
    },
  },

  composer: {
    label: '🐘 Composer (PHP)',
    manifests: [/(^|\/)composer\.json$/],
    primaryManifest: /(^|\/)composer\.json$/,
    lockfile: /(^|\/)composer\.lock$/,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'Composer ne supporte pas de **cooldown natif au niveau du repo applicatif**. Mettre en place une période de quarantaine côté **registre/proxy** (Packagist mirror, Repman, Nexus, Artifactory).',
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
    pmFromPaths() { return ['composer']; },
  },

  cargo: {
    label: '🦀 Cargo (Rust)',
    manifests: [/(^|\/)Cargo\.toml$/, /(^|\/)\.cargo\/config\.toml$/],
    primaryManifest: /(^|\/)Cargo\.toml$/,
    lockfile: /(^|\/)Cargo\.lock$/,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'Cargo n\'a pas de cooldown natif officiel côté repo. La fenêtre de quarantaine se gère via un **registre privé** (crates.io mirror, Cloudsmith, Artifactory) ou un plugin tiers (`cargo-cooldown`).',
    cooldownDetect: [
      { file: /(^|\/)Cargo\.toml$|(^|\/)\.cargo\/config\.toml$/, content: /cargo-cooldown|COOLDOWN_MINUTES/i, pm: 'cargo-cooldown (plugin)', key: 'cooldown' },
    ],
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
    pmFromPaths() { return ['cargo']; },
  },

  ruby: {
    label: '💎 Ruby',
    manifests: [/(^|\/)Gemfile$/, /(^|\/)\.bundle\/config$/],
    primaryManifest: /(^|\/)Gemfile$/,
    lockfile: /(^|\/)Gemfile\.lock$/,
    cooldownConfigurableInRepo: true,
    cooldownDetect: [
      { file: /(^|\/)Gemfile$/,          content: /cooldown\s*:\s*\d+/i,        pm: 'bundler', key: 'cooldown' },
      { file: /(^|\/)\.bundle\/config$/, content: /BUNDLE_COOLDOWN|cooldown/i,   pm: 'bundler', key: 'cooldown' },
    ],
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
    pmFromPaths() { return ['bundler']; },
  },

  dotnet: {
    label: '🔷 NuGet (.NET)',
    manifests: [/\.(csproj|fsproj|vbproj)$/i],
    primaryManifest: /\.(csproj|fsproj|vbproj)$/i,
    lockfile: /(^|\/)packages\.lock\.json$/i,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'NuGet n\'expose pas de cooldown configurable depuis le repo applicatif. La quarantaine se gère côté **feed amont** (Azure Artifacts upstream sources, Artifactory, Nexus, ProGet).',
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
    pmFromPaths() { return ['nuget']; },
  },

  maven: {
    label: '☕ Maven',
    manifests: [/(^|\/)pom\.xml$/],
    primaryManifest: /(^|\/)pom\.xml$/,
    lockfile: null,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'Maven n\'a pas de cooldown natif côté repo applicatif. Configurer la quarantaine dans le **manager de dépôt** (Nexus Repository, Artifactory, Sonatype Lifecycle).',
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
    pmFromPaths() { return ['maven']; },
  },

  gradle: {
    label: '🐘 Gradle',
    manifests: [/(^|\/)build\.gradle(\.kts)?$/],
    primaryManifest: /(^|\/)build\.gradle(\.kts)?$/,
    lockfile: /(^|\/)gradle\.lockfile$/,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'Gradle n\'expose pas de cooldown natif. Activer le **dependency-locking Gradle** + une quarantaine côté **manager de dépôt** (Artifactory, Nexus).',
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
    pmFromPaths() { return ['gradle']; },
  },

  actions: {
    label: '⚡ GitHub Actions',
    manifests: [/^\.github\/workflows\/.+\.ya?ml$/],
    primaryManifest: /^\.github\/workflows\/.+\.ya?ml$/,
    lockfile: null,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'GitHub Actions n\'a **pas** de cooldown natif côté repo applicatif. Utiliser une **allowlist d\'actions** au niveau org + **Dependabot cooldown** (`updates[].cooldown` dans `.github/dependabot.yml`) et **pinner sur SHA40**.',
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
    pmFromPaths() { return ['github-actions']; },
  },

  docker: {
    label: '🐳 Docker',
    manifests: [/(^|\/)Dockerfile([._-].*)?$/],
    primaryManifest: /(^|\/)Dockerfile([._-].*)?$/,
    lockfile: null,
    cooldownConfigurableInRepo: false,
    cooldownNote: 'Docker n\'a pas de cooldown côté repo applicatif. Mettre la quarantaine côté **registry privé** (Harbor, Artifactory, ECR pull-through cache) + politique d\'admission (Cosign / Kyverno).',
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
    pmFromPaths() { return ['docker']; },
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

async function detectCooldownsForEco(github, repo, blobs, eco) {
  if (!eco.cooldownDetect || !eco.cooldownDetect.length) return { detected: false, sources: [] };
  const interesting = blobs.filter(b => eco.cooldownDetect.some(d => d.file.test(b.path)));
  const sources = [];
  for (const f of interesting) {
    const content = await readFile(github, repo.owner, repo.name, f.path, f.sha);
    if (content == null) continue;
    for (const d of eco.cooldownDetect) {
      if (d.file.test(f.path) && d.content.test(content)) {
        sources.push({ file: f.path, pm: d.pm, key: d.key });
      }
    }
  }
  return { detected: sources.length > 0, sources };
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
      const allDetectedPaths = manifests.map(m => m.path).concat(lockfiles);
      const packageManagers = eco.pmFromPaths(allDetectedPaths);

      const cooldowns = await detectCooldownsForEco(github, repo, blobs, eco);

      let pinned = 0, floating = 0, unpinned = 0, externalRefs = 0;
      const findings = [];
      for (const f of primaryManifests) {
        const content = await readFile(github, repo.owner, repo.name, f.path, f.sha);
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
        cooldowns,
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
    cooldownConfigurableInRepo: !!eco.cooldownConfigurableInRepo,
    cooldownNote: eco.cooldownNote || '',
    hasLockfileType: eco.lockfile !== null,
    results,
  };
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
        cooldownConfigurableInRepo: data.cooldownConfigurableInRepo,
        cooldownNote: data.cooldownNote,
        hasLockfileType: data.hasLockfileType,
        packageManagers: r.packageManagers,
        manifests: r.manifests,
        lockfiles: r.lockfiles,
        cooldowns: r.cooldowns,
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
  md += `_Source: [workflow run](${meta.runUrl})_\n\n`;

  md += `## Ce qui est audité par repo\n\n`;
  md += `1. **Package manager(s) utilisé(s)**\n`;
  md += `2. **Dépendances pinnées vs flottantes**\n`;
  md += `3. **Présence d'un lockfile / mécanisme de lock**\n`;
  md += `4. **Cooldown natif** du package manager (avec mention explicite si la configuration ne se fait **pas** côté repo applicatif)\n\n`;

  md += `## Synthèse\n\n`;
  md += `- Repos analysés : **${repoMap.size}**\n`;
  md += `- Dépendances pinnées : **${totalPinned}**\n`;
  md += `- Dépendances flottantes / non versionnées : **${totalFloating}**\n\n`;

  md += `### Par écosystème\n\n| Écosystème | Repos | Pinned | Floating/Unpinned |\n|---|---:|---:|---:|\n`;
  for (const [, s] of ecoStats) md += `| ${s.label} | ${s.repos} | ${s.pinned} | ${s.floating} |\n`;
  md += `\n`;

  if (!repoMap.size) {
    md += `_Aucun manifeste détecté._\n`;
    return md;
  }

  md += `## Détail par repo\n\n`;
  const sorted = [...repoMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [full, repo] of sorted) {
    md += `### [${full}](https://github.com/${full}) ${repo.private ? '🔒' : ''}\n\n`;

    for (const [, eco] of Object.entries(repo.ecos)) {
      const lock = !eco.hasLockfileType
        ? '_(pas de lockfile dans cet écosystème)_'
        : (eco.lockfiles.length ? '✅ ' + eco.lockfiles.map(x => '`' + x + '`').join(', ') : '⚠️ **non**');

      let cooldownText;
      if (eco.cooldownConfigurableInRepo) {
        cooldownText = eco.cooldowns.detected
          ? '✅ ' + eco.cooldowns.sources.map(s => `\`${s.file}\` → **${s.pm}**.${s.key}`).join(', ')
          : '❌ **non configuré** côté repo (configurable mais absent)';
      } else {
        cooldownText = `🚫 **non configurable au niveau du repo applicatif** — ${eco.cooldownNote}`;
      }

      const pm = (eco.packageManagers || []).map(x => '`' + x + '`').join(', ') || '_indéterminé_';

      md += `<details open><summary><b>${eco.label}</b> — PM: ${pm} — lockfile: ${lock}</summary>\n\n`;
      md += `- **Package manager(s)** : ${pm}\n`;
      md += `- **Manifests** : ${eco.manifests.map(x => '`' + x + '`').join(', ')}\n`;
      md += `- **Lockfile / mécanisme de lock** : ${lock}\n`;
      md += `- **Cooldown natif** : ${cooldownText}\n`;
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
  md += `- **pinned** : version exacte / SHA40 / digest immuable\n`;
  md += `- **floating** : plage semver, tag mutable, branche, range ouverte\n`;
  md += `- **unpinned** : aucune version spécifiée\n`;
  md += `- **external-ref** : git+, file:, link:, workspace:, etc.\n`;
  md += `- **cooldown configurable côté repo** : npm, yarn, pnpm, bun, deno, pip, uv, poetry, pixi, bundler\n`;
  md += `- **cooldown non configurable côté repo** : composer, cargo (sauf plugin), nuget, maven, gradle, GitHub Actions, Docker → à gérer côté **registre / proxy / Dependabot**\n`;

  return md;
}

module.exports = { ECOSYSTEMS, listRepos, getEnabledEcosystems, auditEcosystem, buildReport };

'use strict';

const VENDOR = /(^|\/)(node_modules|vendor|bower_components|\.venv|venv|__pypackages__|target|build|dist|\.gradle|\.tox|site-packages|\.next|out)\//;

// ───────────────────────── ECOSYSTEMS ─────────────────────────
const ECOSYSTEMS = {
  npm: {
    label: '📦 npm (Node.js)',
    fix: 'commit un lockfile + utiliser `npm ci` / `pnpm i --frozen-lockfile`',
    manifest: /(^|\/)package\.json$/,
    lockfile: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json)$/,
    parse(c) { let p; try { p = JSON.parse(c); } catch { return []; }
      const o = [];
      for (const s of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])
        for (const [n, r] of Object.entries(p[s] || {})) o.push({ section: s, name: n, range: r });
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (/^(git\+|github:|file:|link:|workspace:|npm:|http)/i.test(v)) return null;
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
    label: '🐍 PyPI',
    fix: 'utiliser `pip-compile`/`uv pip compile`/poetry ou pinner avec `==`',
    manifest: /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile)$/i,
    lockfile: /(^|\/)(requirements\.lock|requirements-lock\.txt|poetry\.lock|pdm\.lock|uv\.lock|Pipfile\.lock)$/i,
    parse(c, filename) {
      const o = [];
      if (/requirements[^/]*\.txt$/i.test(filename)) {
        for (const raw of c.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line || line.startsWith('#') || /^-/.test(line)) continue;
          if (/^(git\+|https?:|file:)/.test(line)) continue;
          const m = line.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*((?:(?:==|>=|<=|>|<|~=|!=|===)\s*[^,;\s]+\s*,?\s*)+)?(\s*;.*)?$/);
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
        grab(/\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?=\n\[|$)/, 'poetry-dev');
        const pj = c.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
        if (pj) for (const line of pj[1].split(/\r?\n/)) {
          const m = line.match(/"([^"]+)"/); if (!m) continue;
          const nm = m[1].match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*([^;]*?)(\s*;.*)?$/);
          if (nm) o.push({ section: 'project', name: nm[1], range: (nm[3] || '').trim() });
        }
      } else if (/Pipfile$/.test(filename)) {
        const grab = (re, sec) => {
          const m = c.match(re); if (!m) return;
          for (const line of m[1].split(/\r?\n/)) {
            const t = line.trim(); if (!t || t.startsWith('#')) continue;
            const mm = t.match(/^([A-Za-z0-9_\-.]+)\s*=\s*"([^"]+)"/);
            if (mm) o.push({ section: sec, name: mm[1], range: mm[2] === '*' ? '*' : mm[2] });
          }
        };
        grab(/\[packages\]([\s\S]*?)(?=\n\[|$)/, 'packages');
        grab(/\[dev-packages\]([\s\S]*?)(?=\n\[|$)/, 'dev-packages');
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (!v) return 'pas de version (unpinned)';
      if (v === '*') return 'wildcard';
      if (/[*]/.test(v)) return 'wildcard';
      if (v.startsWith('^')) return 'caret (^)';
      if (v.startsWith('~') && !v.startsWith('~=')) return 'tilde (~)';
      if (/~=/.test(v)) return 'compatible release (~=)';
      if (/^==[^,*]+$/.test(v)) return null;
      if (/(>=|>)/.test(v) && !/(<=|<)/.test(v)) return 'borne supérieure ouverte';
      if (/^==/.test(v)) return null;
      if (/^\d/.test(v) && !/[<>=~^*,]/.test(v)) return null;
      return 'pas d\'égalité stricte';
    },
  },

  composer: {
    label: '🐘 Composer (PHP)',
    fix: 'commit `composer.lock` + `composer install` (jamais `update` en prod)',
    manifest: /(^|\/)composer\.json$/,
    lockfile: /(^|\/)composer\.lock$/,
    parse(c) { let p; try { p = JSON.parse(c); } catch { return []; }
      const o = [];
      for (const s of ['require','require-dev'])
        for (const [n, r] of Object.entries(p[s] || {})) {
          if (n === 'php' || n.startsWith('ext-') || n.startsWith('lib-')) continue;
          o.push({ section: s, name: n, range: r });
        }
      return o;
    },
    classify(r) { const v = (r || '').trim();
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
    fix: 'commit `Cargo.lock` (apps **et** libs sensibles), préférer `=x.y.z`',
    manifest: /(^|\/)Cargo\.toml$/,
    lockfile: /(^|\/)Cargo\.lock$/,
    parse(c) {
      const o = [];
      const re = /\[(dependencies|dev-dependencies|build-dependencies|target\.[^.\]]+\.dependencies)\]([\s\S]*?)(?=\n\[|$)/g;
      let s;
      while ((s = re.exec(c)) !== null) {
        for (const line of s[2].split(/\r?\n/)) {
          const t = line.trim(); if (!t || t.startsWith('#')) continue;
          let m = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"/);
          if (m) { o.push({ section: s[1], name: m[1], range: m[2] }); continue; }
          m = t.match(/^([A-Za-z0-9_\-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
          if (m) o.push({ section: s[1], name: m[1], range: m[2] });
        }
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
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
    label: '💎 RubyGems',
    fix: 'commit `Gemfile.lock` et `bundle install --frozen` en CI',
    manifest: /(^|\/)Gemfile$/,
    lockfile: /(^|\/)Gemfile\.lock$/,
    parse(c) {
      const o = [];
      const re = /^\s*gem\s+['"]([^'"]+)['"](.*)$/gm;
      let m;
      while ((m = re.exec(c)) !== null) {
        const name = m[1], rest = m[2] || '', vs = [];
        const vRe = /['"]([^'"]+)['"]/g; let vm;
        while ((vm = vRe.exec(rest)) !== null) if (/^[~<>=]|^\d/.test(vm[1])) vs.push(vm[1]);
        o.push({ section: 'gemfile', name, range: vs.join(', ') });
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (!v) return 'pas de version (unpinned)';
      if (/^~>/.test(v)) return 'pessimistic (~>)';
      if (/^(>=|>)/.test(v) && !/(<=|<)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  dotnet: {
    label: '🔷 NuGet (.NET)',
    fix: 'activer Central Package Management ou `packages.lock.json` + `--locked-mode`',
    manifest: /\.(csproj|fsproj|vbproj)$/i,
    lockfile: /(^|\/)packages\.lock\.json$/i,
    parse(c) {
      const o = [];
      let m;
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
    classify(r) { const v = (r || '').trim();
      if (/\*/.test(v)) return 'wildcard / floating';
      if (/^\[\d[^,]*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      if (/^\(/.test(v)) return 'range sans pin bas';
      return null;
    },
  },

  maven: {
    label: '☕ Maven',
    fix: 'épingler les versions, bannir `LATEST`/`RELEASE`',
    manifest: /(^|\/)pom\.xml$/,
    lockfile: null,
    parse(c) {
      const o = [];
      const re = /<dependency>([\s\S]*?)<\/dependency>/gi;
      let m;
      while ((m = re.exec(c)) !== null) {
        const b = m[1];
        const g = b.match(/<groupId>([^<]+)<\/groupId>/i);
        const a = b.match(/<artifactId>([^<]+)<\/artifactId>/i);
        const v = b.match(/<version>([^<]+)<\/version>/i);
        if (a) o.push({ section: 'dependencies', name: `${g ? g[1] + ':' : ''}${a[1]}`, range: v ? v[1] : '' });
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (!v) return 'pas de version';
      if (/^\$\{/.test(v)) return null;
      if (/^(LATEST|RELEASE)$/i.test(v)) return v.toUpperCase() + ' (mutable)';
      if (/^\[.*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  gradle: {
    label: '🐘 Gradle',
    fix: 'activer `dependency-locking` Gradle ou des versions exactes',
    manifest: /(^|\/)build\.gradle(\.kts)?$/,
    lockfile: /(^|\/)gradle\.lockfile$/,
    parse(c) {
      const o = [];
      const re = /\b(implementation|api|compile|runtimeOnly|testImplementation|testCompile|annotationProcessor|kapt|classpath)\s*[\(\s]\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(c)) !== null) {
        const parts = m[2].split(':');
        if (parts.length >= 3) o.push({ section: m[1], name: `${parts[0]}:${parts[1]}`, range: parts.slice(2).join(':') });
        else o.push({ section: m[1], name: m[2], range: '' });
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (!v) return 'pas de version';
      if (/[+]/.test(v)) return 'wildcard (+)';
      if (/^latest\./i.test(v)) return 'latest.* (mutable)';
      if (/^\[.*,\s*\)/.test(v)) return 'borne supérieure ouverte';
      return null;
    },
  },

  actions: {
    label: '⚡ GitHub Actions',
    fix: 'pinner sur SHA 40 caractères (Dependabot peut le faire auto)',
    manifest: /^\.github\/workflows\/.+\.ya?ml$/,
    lockfile: null,
    parse(c) {
      const o = [];
      const re = /^\s*-?\s*uses:\s*['"]?([^@'"\s]+)@([^'"\s#]+)/gm;
      let m;
      while ((m = re.exec(c)) !== null) {
        if (m[1].startsWith('./') || m[1].startsWith('docker://')) continue;
        o.push({ section: 'uses', name: m[1], range: m[2] });
      }
      return o;
    },
    classify(r) { const v = (r || '').trim();
      if (/^[a-f0-9]{40}$/i.test(v)) return null;
      if (/^(main|master|develop|trunk|HEAD)$/i.test(v)) return 'BRANCH (très risqué)';
      if (/^v?\d+$/.test(v)) return 'tag majeur (mutable)';
      if (/^v?\d+\.\d+(\.\d+)?$/.test(v)) return 'tag mineur/patch (mutable)';
      return 'ref mutable';
    },
  },

  docker: {
    label: '🐳 Docker',
    fix: 'pinner sur digest `image@sha256:...`',
    manifest: /(^|\/)Dockerfile([._-].*)?$/,
    lockfile: null,
    parse(c) {
      const o = [];
      const re = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+\S+)?/gim;
      let m;
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
    classify(r) { const v = (r || '').trim();
      if (v.startsWith('@sha256:')) return null;
      if (v === 'latest' || v === '') return 'tag latest (très risqué)';
      if (/^\d+$/.test(v)) return 'tag majeur (mutable)';
      if (/^\d+\.\d+/.test(v)) return 'tag versionné (mutable)';
      return 'tag (mutable)';
    },
  },
};

// ───────────────────────── HELPERS ─────────────────────────
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

// ───────────────────────── EXPORTED API ─────────────────────────


async function listRepos({ github, context, scope, orgs, currentOrg, includeArchived, includeForks }) {
  let repos = [];

  if (scope === 'this-repo-only') {
    const { data } = await github.rest.repos.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
    });
    repos = [data];

  } else if (scope === 'current-org') {
    repos = await github.paginate(github.rest.repos.listForOrg, {
      org: currentOrg,
      type: 'all',
      per_page: 100,
    });

  } else if (scope === 'multi-orgs') {
    if (!orgs || !orgs.length) {
      throw new Error('scope=multi-orgs nécessite la liste des orgs (input "orgs")');
    }
    for (const org of orgs) {
      try {
        const r = await github.paginate(github.rest.repos.listForOrg, {
          org, type: 'all', per_page: 100,
        });
        repos.push(...r);
      } catch (e) {
        // Si l'App n'est pas installée sur cette org → on saute proprement
        console.warn(`⚠️ Org ${org}: ${e.message}`);
      }
    }
  }

  return repos
    .filter(r => includeArchived || !r.archived)
    .filter(r => includeForks || !r.fork)
    .map(r => ({
      owner: r.owner.login,
      name: r.name,
      full_name: r.full_name,
      default_branch: r.default_branch,
      private: r.private,
    }));
}
function getEnabledEcosystems(input) {
  const req = (input || 'all').toLowerCase().split(',').map(s => s.trim());
  const all = req.includes('all') || req.includes('');
  return Object.keys(ECOSYSTEMS).filter(k => all || req.includes(k));
}

async function scanEcosystem({ github, core, ecosystemKey, repos }) {
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

      const manifests = blobs.filter(b => eco.manifest.test(b.path));
      if (!manifests.length) continue;
      const lockfiles = eco.lockfile
        ? blobs.filter(b => eco.lockfile.test(b.path)).map(b => b.path)
        : [];

      const findings = [];
      for (const f of manifests) {
        const content = await readFile(github, repo.owner, repo.name, f.path, f.sha);
        if (!content) continue;
        let deps = [];
        try { deps = eco.parse(content, f.path); } catch {}
        for (const d of deps) {
          const risk = eco.classify(d.range);
          if (risk) findings.push({ path: f.path, ...d, risk });
        }
      }

      if (findings.length) {
        results.push({
          full: repo.full_name,
          private: repo.private,
          manifests: manifests.map(m => m.path),
          lockfiles, findings,
        });
      }
    } catch (e) {
      core.warning(`Skip ${repo.full_name} [${ecosystemKey}]: ${e.message}`);
    }
  }
  return {
    ecosystem: ecosystemKey,
    label: eco.label,
    fix: eco.fix,
    hasLockfileType: eco.lockfile !== null,
    results,
  };
}

function buildReport(allData, meta) {
  const repoMap = new Map();
  const offenderCount = new Map();
  const ecoStats = new Map();
  let totalFindings = 0;

  for (const [key, data] of Object.entries(allData)) {
    let ecoFindings = 0;
    for (const r of data.results) {
      if (!repoMap.has(r.full)) repoMap.set(r.full, { private: r.private, ecos: {} });
      repoMap.get(r.full).ecos[key] = {
        label: data.label, fix: data.fix,
        hasLockfileType: data.hasLockfileType,
        manifests: r.manifests, lockfiles: r.lockfiles,
        findings: r.findings,
      };
      ecoFindings += r.findings.length;
      for (const f of r.findings) {
        const k = `${key}|${f.name}`;
        offenderCount.set(k, (offenderCount.get(k) || 0) + 1);
      }
    }
    ecoStats.set(key, { label: data.label, repos: data.results.length, findings: ecoFindings });
    totalFindings += ecoFindings;
  }

  let md = `# 🛡️ Supply-chain risk report\n\n`;
  md += `_Run: **${meta.date} ${meta.time.slice(0,2)}:${meta.time.slice(2,4)}:${meta.time.slice(4,6)} UTC**_  \n`;
  md += `_Source: [workflow run](${meta.runUrl})_\n\n`;
  md += `- Repos avec dépendances flottantes : **${repoMap.size}**\n`;
  md += `- Total de dépendances à risque : **${totalFindings}**\n\n`;

  md += `## Synthèse par écosystème\n\n| Écosystème | Repos | Findings |\n|---|---:|---:|\n`;
  for (const [, s] of ecoStats) md += `| ${s.label} | ${s.repos} | ${s.findings} |\n`;

  md += `\n## 🎯 Top 15 paquets exposés\n\n`;
  const top = [...offenderCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    md += `| Paquet | Écosystème | # repos |\n|---|---|---:|\n`;
    for (const [k, v] of top) { const [eco, nm] = k.split('|'); md += `| \`${nm}\` | ${eco} | ${v} |\n`; }
  } else md += `_Aucun_\n`;

  md += `\n## Détail par repo\n\n`;
  if (!repoMap.size) {
    md += `✅ Aucun risque détecté.\n`;
  } else {
    const sorted = [...repoMap.entries()].sort((a, b) => {
      const lockA = Object.values(a[1].ecos).every(p => !p.hasLockfileType || p.lockfiles.length);
      const lockB = Object.values(b[1].ecos).every(p => !p.hasLockfileType || p.lockfiles.length);
      if (lockA !== lockB) return lockA ? 1 : -1;
      return Object.values(b[1].ecos).reduce((s, p) => s + p.findings.length, 0)
           - Object.values(a[1].ecos).reduce((s, p) => s + p.findings.length, 0);
    });
    for (const [full, r] of sorted) {
      md += `### [${full}](https://github.com/${full}) ${r.private ? '🔒' : ''}\n\n`;
      for (const [, p] of Object.entries(r.ecos)) {
        const lock = !p.hasLockfileType
          ? '_(pas de lockfile dans cet écosystème)_'
          : (p.lockfiles.length ? '✅ ' + p.lockfiles.map(x => '`' + x + '`').join(', ') : '⚠️ **non**');
        md += `<details><summary><b>${p.label}</b> — ${p.findings.length} findings — Lockfile: ${lock}</summary>\n\n`;
        md += `| Fichier | Section | Paquet | Plage | Type |\n|---|---|---|---|---|\n`;
        for (const f of p.findings.slice(0, 60))
          md += `| \`${f.path}\` | ${f.section} | \`${f.name}\` | \`${(f.range || '').slice(0, 80)}\` | ${f.risk} |\n`;
        if (p.findings.length > 60) md += `| … | | | | _+${p.findings.length - 60} de plus_ |\n`;
        md += `\n💡 _${p.fix}_\n\n</details>\n\n`;
      }
    }
  }

  md += `\n---\n\n### Légende\n`;
  md += `- **caret (^) / tilde (~) / pessimistic (~>)** : MAJ auto mineure ou patch\n`;
  md += `- **wildcard / latest / borne ouverte** : peut tirer **n'importe quelle** version publiée\n`;
  md += `- **branch / tag mutable** (Actions, Docker) : la cible peut être modifiée par le mainteneur\n`;
  md += `- **Lockfile absent** : amplifie le risque (résolution ré-évaluée à chaque install)\n`;
  return md;
}

module.exports = { ECOSYSTEMS, listRepos, getEnabledEcosystems, scanEcosystem, buildReport };

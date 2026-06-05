'use strict';

const VENDOR = /(^|\/)(node_modules|vendor|bower_components|\.venv|venv|__pypackages__|target|build|dist|\.gradle|\.tox|site-packages|\.next|out)\//;

const ECOSYSTEMS = {
  npm: {
    label: '📦 JavaScript/Node.js',
    manifests: [
      /(^|\/)package\.json$/,
      /(^|\/)\.npmrc$/,
      /(^|\/)\.yarnrc\.yml$/,
      /(^|\/)bunfig\.toml$/,
      /(^|\/)deno\.json$/,
      /(^|\/)deno\.jsonc$/,
      /(^|\/)pnpm-workspace\.yaml$/,
      /(^|\/)\.pnpmrc$/,
    ],
    primaryManifest: /(^|\/)package\.json$/,
    lockfile: /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json)$/,
    parse(c, filename) {
      if (!/package\.json$/.test(filename)) return [];
      let p; try { p = JSON.parse(c); } catch { return []; }
      const out = [];
      for (const s of ['dependencies','devDependencies','peerDependencies','optionalDependencies']) {
        for (const [name, range] of Object.entries(p[s] || {})) out.push({ section: s, name, range });
      }
      return out;
    },
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^(git\+|github:|file:|link:|workspace:|npm:|http)/i.test(v)) return 'external-ref';
      if (/^\d+\.\d+\.\d+$/.test(v) || /^=\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  pypi: {
    label: '🐍 Python',
    manifests: [
      /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i,
      /(^|\/)pip\.conf$/i,
    ],
    primaryManifest: /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile|pixi\.toml)$/i,
    lockfile: /(^|\/)(requirements\.lock|requirements-lock\.txt|poetry\.lock|pdm\.lock|uv\.lock|Pipfile\.lock|pixi\.lock)$/i,
    parse(c, filename) {
      const o = [];
      if (/requirements[^/]*\.txt$/i.test(filename)) {
        for (const raw of c.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line || line.startsWith('#') || /^-/.test(line)) continue;
          if (/^(git\+|https?:|file:)/.test(line)) continue;
          const m = line.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*((?:(?:==|>=|<=|>|<|~=|!=|===)\s*[^,;\s]+\s*,?\s*)+)?/);
          if (!m) continue;
          o.push({ section: 'requirements', name: m[1], range: (m[3] || '').trim().replace(/\s+/g,'') });
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
        if (pj) {
          for (const line of pj[1].split(/\r?\n/)) {
            const m = line.match(/"([^"]+)"/); if (!m) continue;
            const nm = m[1].match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*([^;]*?)/);
            if (nm) o.push({ section: 'project', name: nm[1], range: (nm[3] || '').trim() });
          }
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
  },

  composer: {
    label: '🐘 Composer (PHP)',
    manifests: [/(^|\/)composer\.json$/],
    primaryManifest: /(^|\/)composer\.json$/,
    lockfile: /(^|\/)composer\.lock$/,
    parse(c) {
      let p; try { p = JSON.parse(c); } catch { return []; }
      const o = [];
      for (const s of ['require','require-dev']) {
        for (const [name, range] of Object.entries(p[s] || {})) {
          if (name === 'php' || name.startsWith('ext-') || name.startsWith('lib-')) continue;
          o.push({ section: s, name, range });
        }
      }
      return o;
    },
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  cargo: {
    label: '🦀 Cargo (Rust)',
    manifests: [/(^|\/)Cargo\.toml$/, /(^|\/)\.cargo\/config\.toml$/],
    primaryManifest: /(^|\/)Cargo\.toml$/,
    lockfile: /(^|\/)Cargo\.lock$/,
    parse(c, filename) {
      if (!/Cargo\.toml$/.test(filename)) return [];
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
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^=\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  ruby: {
    label: '💎 Ruby',
    manifests: [/(^|\/)Gemfile$/, /(^|\/)\.bundle\/config$/],
    primaryManifest: /(^|\/)Gemfile$/,
    lockfile: /(^|\/)Gemfile\.lock$/,
    parse(c, filename) {
      if (!/Gemfile$/.test(filename)) return [];
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
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v) || /^=\s*\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  dotnet: {
    label: '🔷 NuGet (.NET)',
    manifests: [/\.(csproj|fsproj|vbproj)$/i],
    primaryManifest: /\.(csproj|fsproj|vbproj)$/i,
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
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^\d+\.\d+\.\d+$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  maven: {
    label: '☕ Maven',
    manifests: [/(^|\/)pom\.xml$/],
    primaryManifest: /(^|\/)pom\.xml$/,
    lockfile: null,
    parse(c, filename) {
      if (!/pom\.xml$/.test(filename)) return [];
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
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^\$\{/.test(v)) return 'property-ref';
      if (/^\d+(\.\d+){1,3}$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  gradle: {
    label: '🐘 Gradle',
    manifests: [/(^|\/)build\.gradle(\.kts)?$/],
    primaryManifest: /(^|\/)build\.gradle(\.kts)?$/,
    lockfile: /(^|\/)gradle\.lockfile$/,
    parse(c, filename) {
      if (!/build\.gradle(\.kts)?$/.test(filename)) return [];
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
    pinState(range) {
      const v = (range || '').trim();
      if (!v) return 'unpinned';
      if (/^\d+(\.\d+){1,3}$/.test(v)) return 'pinned';
      return 'floating';
    },
  },

  actions: {
    label: '⚡ GitHub Actions',
    manifests: [/^\.github\/workflows\/.+\.ya?ml$/],
    primaryManifest: /^\.github\/workflows\/.+\.ya?ml$/,
    lockfile: null,
    parse(c, filename) {
      if (!/^\.github\/workflows\/.+\.ya?ml$/.test(filename)) return [];
      const o = [];
      const re = /^\s*-?\s*uses:\s*['"]?([^@'"\s]+)@([^'"\s#]+)/gm;
      let m;
      while ((m = re.exec(c)) !== null) {
        if (m[1].startsWith('./') || m[1].startsWith('docker://')) continue;
        o.push({ section: 'uses', name: m[1], range: m[2] });
      }
      return o;
    },
    pinState(range) {
      const v = (range || '').trim();
      if (/^[a-f0-9]{40}$/i.test(v)) return 'pinned';
      return 'floating';
    },
  },

  docker: {
    label: '🐳 Docker',
    manifests: [/(^|\/)Dockerfile([._-].*)?$/],
    primaryManifest: /(^|\/)Dockerfile([._-].*)?$/,
    lockfile: null,
    parse(c, filename) {
      if (!/Dockerfile([._-].*)?$/.test(filename)) return [];
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
    pinState(range) {
      const v = (range || '').trim();
      if (v.startsWith('@sha256:')) return 'pinned';
      return 'floating';
    },
  },
};

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
    for (const org of orgs || []) {
      try {
        const r = await github.paginate(github.rest.repos.listForOrg, {
          org, type: 'all', per_page: 100,
        });
        repos.push(...r);
      } catch (e) {
        console.warn(`Org ${org}: ${e.message}`);
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

function detectNativeCooldown(ecosystemKey, files) {
  const result = { detected: false, sources: [] };

  for (const f of files) {
    const path = f.path;
    const text = f.content || '';

    if (ecosystemKey === 'npm') {
      if (/\.npmrc$/.test(path) && /min-release-age\s*=|min-release-age\s+/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'npm', key: 'min-release-age' });
      }
      if (/\.yarnrc\.yml$/.test(path) && /npmMinimalAgeGate\s*:/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'yarn', key: 'npmMinimalAgeGate' });
      }
      if (/bunfig\.toml$/.test(path) && /minimumReleaseAge\s*=/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'bun', key: 'minimumReleaseAge' });
      }
      if (/deno\.jsonc?$/.test(path) && /"minimumDependencyAge"\s*:/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'deno', key: 'minimumDependencyAge' });
      }
      if (/pnpm-workspace\.yaml$|\.pnpmrc$|\.npmrc$/.test(path) && /minimumReleaseAge\s*:/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'pnpm', key: 'minimumReleaseAge' });
      }
    }

    if (ecosystemKey === 'pypi') {
      if (/pyproject\.toml$/.test(path) && /\[tool\.uv\][\s\S]*exclude-newer\s*=/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'uv', key: 'exclude-newer' });
      }
      if (/pip\.conf$/.test(path) && /uploaded-prior-to\s*=/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'pip', key: 'uploaded-prior-to' });
      }
      if (/pyproject\.toml$/.test(path) && /\[solver\][\s\S]*min-release-age\s*=/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'poetry', key: 'solver.min-release-age' });
      }
      if (/pixi\.toml$/.test(path) && /exclude-newer\s*=/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'pixi', key: 'exclude-newer' });
      }
    }

    if (ecosystemKey === 'cargo') {
      if (/Cargo\.toml$|\.cargo\/config\.toml$/.test(path) && /cargo-cooldown|COOLDOWN_MINUTES/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'cargo-cooldown', key: 'COOLDOWN_MINUTES/cargo cooldown' });
      }
    }

    if (ecosystemKey === 'ruby') {
      if (/Gemfile$/.test(path) && /cooldown\s*:\s*\d+/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'bundler', key: 'cooldown' });
      }
      if (/\.bundle\/config$/.test(path) && /BUNDLE_COOLDOWN|cooldown/i.test(text)) {
        result.detected = true;
        result.sources.push({ file: path, type: 'bundler', key: 'cooldown' });
      }
    }
  }

  return result;
}

async function detectCooldowns(github, repo, blobs, ecosystemKey) {
  const interesting = blobs.filter(b =>
    /(^|\/)\.npmrc$/i.test(b.path) ||
    /(^|\/)\.yarnrc\.yml$/i.test(b.path) ||
    /(^|\/)bunfig\.toml$/i.test(b.path) ||
    /(^|\/)deno\.jsonc?$/i.test(b.path) ||
    /(^|\/)pnpm-workspace\.yaml$/i.test(b.path) ||
    /(^|\/)\.pnpmrc$/i.test(b.path) ||
    /(^|\/)pyproject\.toml$/i.test(b.path) ||
    /(^|\/)pip\.conf$/i.test(b.path) ||
    /(^|\/)pixi\.toml$/i.test(b.path) ||
    /(^|\/)\.cargo\/config\.toml$/i.test(b.path) ||
    /(^|\/)\.bundle\/config$/i.test(b.path) ||
    /(^|\/)Gemfile$/.test(b.path)
  );

  const files = [];
  for (const f of interesting) {
    const content = await readFile(github, repo.owner, repo.name, f.path, f.sha);
    if (content != null) files.push({ path: f.path, content });
  }

  return detectNativeCooldown(ecosystemKey, files);
}

async function auditEcosystem({ github, core, ecosystemKey, repos }) {
  const eco = ECOSYSTEMS[ecosystemKey];
  if (!eco) throw new Error(`Unknown ecosystem: ${ecosystemKey}`);

  const results = [];

  for (const repo of repos) {
    try {
      const tree = await github.rest.git.getTree({
        owner: repo.owner,
        repo: repo.name,
        tree_sha: repo.default_branch,
        recursive: 'true',
      });

      const blobs = tree.data.tree.filter(t =>
        t.type === 'blob' && !VENDOR.test(t.path) && (t.size || 0) < 800000);

      const manifests = blobs.filter(b => eco.manifests.some(re => re.test(b.path)));
      const primaryManifests = manifests.filter(b => eco.primaryManifest.test(b.path));
      if (!primaryManifests.length) continue;

      const lockfiles = eco.lockfile
        ? blobs.filter(b => eco.lockfile.test(b.path)).map(b => b.path)
        : [];

      const cooldowns = await detectCooldowns(github, repo, blobs, ecosystemKey);

      let pinned = 0;
      let floating = 0;
      let unpinned = 0;
      let externalRefs = 0;
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
          findings.push({ path: f.path, ...d, pinState: state });
        }
      }

      results.push({
        full: repo.full_name,
        private: repo.private,
        manifests: primaryManifests.map(m => m.path),
        lockfiles,
        cooldowns,
        counts: {
          total: pinned + floating + unpinned + externalRefs,
          pinned,
          floating,
          unpinned,
          externalRefs,
        },
        findings,
      });
    } catch (e) {
      core.warning(`Skip ${repo.full_name} [${ecosystemKey}]: ${e.message}`);
    }
  }

  return {
    ecosystem: ecosystemKey,
    label: eco.label,
    results,
  };
}

function buildReport(allData, meta) {
  const repoMap = new Map();

  for (const [, data] of Object.entries(allData)) {
    for (const r of data.results) {
      if (!repoMap.has(r.full)) repoMap.set(r.full, { private: r.private, ecos: {} });
      repoMap.get(r.full).ecos[data.ecosystem] = {
        label: data.label,
        manifests: r.manifests,
        lockfiles: r.lockfiles,
        cooldowns: r.cooldowns,
        counts: r.counts,
        findings: r.findings,
      };
    }
  }

  let md = `# 🔎 Dependency Controls Audit\n\n`;
  md += `_Run: **${meta.date} ${meta.time.slice(0,2)}:${meta.time.slice(2,4)}:${meta.time.slice(4,6)} UTC**_  \n`;
  md += `_Source: [workflow run](${meta.runUrl})_\n\n`;

  md += `## Ce qui est audité\n\n`;
  md += `- **Cooldowns natifs** uniquement\n`;
  md += `- **Lockfiles**\n`;
  md += `- **Pinning**\n\n`;

  if (!repoMap.size) {
    md += `Aucun manifeste détecté.\n`;
    return md;
  }

  md += `## Détail par repo\n\n`;

  const sorted = [...repoMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [full, repo] of sorted) {
    md += `### [${full}](https://github.com/${full}) ${repo.private ? '🔒' : ''}\n\n`;

    for (const [, eco] of Object.entries(repo.ecos)) {
      const lock = eco.lockfiles.length
        ? '✅ ' + eco.lockfiles.map(x => '`' + x + '`').join(', ')
        : '⚠️ **non**';

      const cooldownText = eco.cooldowns.detected
        ? `✅ ${eco.cooldowns.sources.map(s => `\`${s.file}\` → ${s.type}.${s.key}`).join(', ')}`
        : '**aucun**';

      md += `<details><summary><b>${eco.label}</b> — lockfile: ${lock} — cooldown: ${eco.cooldowns.detected ? 'oui' : 'non'}</summary>\n\n`;
      md += `- Dépendances totales : **${eco.counts.total}**\n`;
      md += `- Pinnées : **${eco.counts.pinned}**\n`;
      md += `- Flottantes : **${eco.counts.floating}**\n`;
      md += `- Sans version : **${eco.counts.unpinned}**\n`;
      md += `- Références externes / indirectes : **${eco.counts.externalRefs}**\n`;
      md += `- Cooldown natif détecté : ${cooldownText}\n\n`;

      md += `| Fichier | Dépendance | Plage / ref | État |\n|---|---|---|---|\n`;
      for (const f of eco.findings.slice(0, 60)) {
        md += `| \`${f.path}\` | \`${f.name}\` | \`${(f.range || '').slice(0, 80)}\` | ${f.pinState} |\n`;
      }
      if (eco.findings.length > 60) {
        md += `| … | … | … | _+${eco.findings.length - 60} de plus_ |\n`;
      }
      md += `\n</details>\n\n`;
    }
  }

  md += `---\n\n`;
  md += `## Légende\n\n`;
  md += `- **cooldown natif** : configuré directement dans le gestionnaire de paquets\n`;
  md += `- **pinned** : version exacte, SHA40, digest immuable\n`;
  md += `- **floating** : plage semver, tag mutable, branche, range ouverte\n`;
  md += `- **unpinned** : pas de version spécifiée\n`;

  return md;
}

module.exports = {
  listRepos,
  getEnabledEcosystems,
  auditEcosystem,
  buildReport,
};

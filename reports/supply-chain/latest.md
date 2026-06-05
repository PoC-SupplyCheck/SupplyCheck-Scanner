# 🛡️ Supply-chain risk report

_Run: **2026-06-05 16:01:22 UTC**_  
_Source: [workflow run](https://github.com/PoC-SupplyCheck/SupplyCheck-Scanner/actions/runs/27025615461)_

- Repos avec dépendances flottantes : **1**
- Total de dépendances à risque : **11**

## Synthèse par écosystème

| Écosystème | Repos | Findings |
|---|---:|---:|
| ⚡ GitHub Actions | 1 | 11 |
| 🦀 Cargo (Rust) | 0 | 0 |
| 🐘 Composer (PHP) | 0 | 0 |
| 🐳 Docker | 0 | 0 |
| 🔷 NuGet (.NET) | 0 | 0 |
| 🐘 Gradle | 0 | 0 |
| ☕ Maven | 0 | 0 |
| 📦 npm (Node.js) | 0 | 0 |
| 🐍 PyPI | 0 | 0 |
| 💎 RubyGems | 0 | 0 |

## 🎯 Top 15 paquets exposés

| Paquet | Écosystème | # repos |
|---|---|---:|
| `actions/checkout` | actions | 3 |
| `actions/github-script` | actions | 3 |
| `actions/create-github-app-token` | actions | 2 |
| `actions/upload-artifact` | actions | 2 |
| `actions/download-artifact` | actions | 1 |

## Détail par repo

### [PoC-SupplyCheck/SupplyCheck-Scanner](https://github.com/PoC-SupplyCheck/SupplyCheck-Scanner) 

<details><summary><b>⚡ GitHub Actions</b> — 11 findings — Lockfile: _(pas de lockfile dans cet écosystème)_</summary>

| Fichier | Section | Paquet | Plage | Type |
|---|---|---|---|---|
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/checkout` | `v6` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/create-github-app-token` | `v3` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/github-script` | `v9` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/checkout` | `v6` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/create-github-app-token` | `v3` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/github-script` | `v9` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/upload-artifact` | `v7` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/checkout` | `v6` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/download-artifact` | `v8` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/github-script` | `v9` | tag majeur (mutable) |
| `.github/workflows/supply-chain-scan.yml` | uses | `actions/upload-artifact` | `v7` | tag majeur (mutable) |

💡 _pinner sur SHA 40 caractères (Dependabot peut le faire auto)_

</details>


---

### Légende
- **caret (^) / tilde (~) / pessimistic (~>)** : MAJ auto mineure ou patch
- **wildcard / latest / borne ouverte** : peut tirer **n'importe quelle** version publiée
- **branch / tag mutable** (Actions, Docker) : la cible peut être modifiée par le mainteneur
- **Lockfile absent** : amplifie le risque (résolution ré-évaluée à chaque install)

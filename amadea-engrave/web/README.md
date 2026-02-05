# 
Gravírovací konfigurátor (Next.js + Konva) pro www.amadea.cz beta verze

Tento repozitář obsahuje webový konfigurátor pro návrh gravíru (primárně text, tvary a ozdoby) určený pro dřevěné výrobky značky **amadea.cz**.

Konfigurátor umožňuje:
- přidávat a upravovat **text** (font, velikost, styl, zarovnání, barva),
- přidávat **tvary** (obdélník, kruh, linka) a jednoduché **ozdoby**,
- používat **pozadí** pro náhled (např. fotka produktu / dekor),
- exportovat návrh jako **SVG v mm** (vhodné pro laser, který přijímá vektor).

> Pozadí je pouze pro vizuální náhled — do exportu SVG se standardně nezahrnuje (exportuje se jen gravírování).

---

## Tech stack

- **Next.js (App Router)** – frontend
- **react-konva / Konva** – canvas editor (drag, transform, rotace)
- **SVG export** – výstup pro laser / výrobu

---

## Getting Started

Nejdřív nainstaluj závislosti a spusť dev server:

```bash
npm install
npm run dev
# nebo
yarn dev
# nebo
pnpm dev
# nebo
bun dev

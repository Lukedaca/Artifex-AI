# Artifex AI v3.1 "Celestial"

**Artifex AI je moderní aplikace pro úpravu a analýzu fotografií poháněná umělou inteligencí, která běží kompletně offline ve vašem prohlížeči. Kombinuje výkonné schopnosti TensorFlow.js s komplexní sadou nástrojů pro úpravy fotografií, vše zabaleno do elegantního, responzivního a uživatelsky přívětivého rozhraní.**

---

## 🌟 Hlavní přednosti

### 🔒 100% Offline & Soukromé
- **Žádný internet potřeba:** Všechny AI funkce běží přímo ve vašem prohlížeči
- **Naprosté soukromí:** Vaše fotografie nikdy neopustí váš počítač
- **Žádné API klíče:** Funguje okamžitě bez jakéhokoliv nastavení
- **Nulové náklady:** Všechno zpracování je lokální, žádné external API poplatky

### ⚡ Výkonná AI zpracování v prohlížeči
Využívá TensorFlow.js pro pokročilé AI zpracování obrazu:
- **MobileNet v2:** Detekce objektů a klasifikace obrázků (1000 tříd ImageNet)
- **BodyPix:** Přesná segmentace osob pro odstranění pozadí
- **Canvas API:** Přímá manipulace pixelů pro vylepšení obrazu

---

## ✨ Klíčové funkce

### 1. Prémiový UI Design "Celestial"
Aplikace byla kompletně redesignována s využitím pokročilých designových principů. Nové rozhraní "Celestial" přináší:
- **Živé Osvětlení:** Aktivní prvky vrhají jemnou, pulzující "aurora" záři, která reaguje na každý pohyb myši a vytváří dynamický dojem
- **Smysluplné Animace:** Prvky se načítají v elegantních kaskádách a přechody mezi pohledy jsou plynulé. Indikátor v navigaci se hladce přesouvá mezi položkami
- **Hmatatelná Hloubka:** Jemná textura na pozadí a "plovoucí" panely s glassmorphism efektem dodávají rozhraní hloubku a prémiový pocit
- **Dokonalost v Detailu:** Každý komponent byl precizně navržen s vlastními styly a mikro-interakcemi
- **Interaktivní Landing Page:** Klikatelné feature cards s detailními modály, catchy marketing headlines a vylepšené proporce

### 2. Snadné nahrávání fotografií
Snadno nahrajte své fotografie pomocí jednoduchého rozhraní drag-and-drop s animovaným ohraničením a interaktivní září.

### 3. Inteligentní AI analýza (Offline)
Využívá MobileNet pro okamžitou analýzu vašich fotografií, vše lokálně:
- **Detekce objektů:** Identifikuje co je na fotografii pomocí neuronové sítě
- **Analýza vlastností:** Automatické měření jasu, saturace a kompozice
- **Inteligentní návrhy:** Konkrétní doporučení založené na analýze (osvětlení, barvy, kompozice)
- **Technické odhady:** Odhadované informace jako ISO, clona a rychlost závěrky

### 4. AI Autopilot - Automatické vylepšení
Jediným kliknutím nechte AI automaticky vylepšit vaši fotografii:
- Inteligentní úprava jasu podle průměrné expozice
- Dynamické zesílení kontrastu
- Boost saturace pro živější barvy
- Profesionálně upravený výsledek za sekundy

### 5. Odstranění pozadí (AI Segmentace)
Využívá BodyPix model pro přesné oddělení popředí od pozadí:
- Automatická detekce osob v obraze
- Odstranění pozadí s průhlednou alfa vrstvou
- Možnost nahrazení pozadí pevnou barvou
- Ideální pro portréty a produktové fotografie

### 6. Inteligentní Oříznutí (Auto Crop)
AI automaticky detekuje hlavní objekt a ořízne fotografii:
- Detekce objektů v obraze pomocí BodyPix
- Nalezení optimálního oříznutí s 10% paddingem
- Zlepšení kompozice automaticky

### 7. Style Transfer (Přenos stylu)
Aplikujte barevnou paletu z jedné fotografie na druhou:
- Analýza průměrných barev stylu
- Aplikace barevného odstínu na originál
- Kreativní transformace vašich fotografií

### 8. Výkonné hromadné zpracování
Ušetřete čas použitím úprav na více obrázků najednou. Podporuje hromadné aplikace všech AI funkcí.

### 9. Plná historie Zpět/Vpřed
Experimentujte volně bez obav z chyb. Aplikace uchovává kompletní historii vašich úprav. Použijte standardní klávesové zkratky (`Ctrl+Z` pro zpět, `Ctrl+Y` pro vpřed) k navigaci mezi změnami.

---

## 🛠️ Použité technologie

### Frontend & UI
- **[React 18](https://reactjs.org/)** - Moderní UI framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Vite](https://vitejs.dev/)** - Rychlý build tool

### AI & Machine Learning
- **[TensorFlow.js](https://www.tensorflow.org/js)** - ML pro JavaScript
- **[MobileNet v2](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet)** - Klasifikace obrazu
- **[BodyPix](https://github.com/tensorflow/tfjs-models/tree/master/body-pix)** - Segmentace osob
- **Canvas API** - Přímá manipulace pixelů

### Design
- **[Inter Font](https://fonts.google.com/specimen/Inter)** - Moderní sans-serif písmo

---

## 🚀 Jak začít

### Instalace & Spuštění

1. **Naklonujte repozitář:**
   ```bash
   git clone https://github.com/Lukedaca/Artifex-AI.git
   cd Artifex-AI
   ```

2. **Nainstalujte závislosti:**
   ```bash
   npm install
   ```

3. **Spusťte vývojový server:**
   ```bash
   npm run dev
   ```

4. **Otevřete prohlížeč:**
   - Přejděte na `http://localhost:3000`
   - Aplikace je okamžitě připravena k použití - žádné nastavení není potřeba!

### Build pro produkci

```bash
npm run build
npm run preview
```

---

## 📦 Systémové požadavky

- **Prohlížeč:** Moderní prohlížeč s podporou WebGL (Chrome, Firefox, Safari, Edge)
- **RAM:** Minimálně 4GB (doporučeno 8GB pro větší obrázky)
- **WebGL:** Podpora WebGL 2.0 pro TensorFlow.js akceleraci
- **Internet:** Potřeba pouze při prvním spuštění pro stažení AI modelů (cca 10-20 MB), poté 100% offline

---

## 🎯 Jak to funguje

### AI Modely
1. **První spuštění:** TensorFlow.js stáhne MobileNet a BodyPix modely z CDN (~10-20 MB)
2. **Cachování:** Prohlížeč modely uloží do cache pro offline použití
3. **Zpracování:** Všechny následné operace běží lokálně bez internetu

### Zpracování obrazu
1. **Analýza:** MobileNet klasifikuje obsah obrázku (1000 možných tříd)
2. **Segmentace:** BodyPix oddělí osoby od pozadí
3. **Vylepšení:** Canvas API provádí pixel-level úpravy
4. **Export:** Výsledek je k dispozici jako PNG/JPEG soubor

---

## 🔮 Roadmap

### Plánované funkce
- [ ] Podpora pro více segmentačních modelů (zvířata, objekty)
- [ ] Pokročilejší style transfer (neural style transfer)
- [ ] Pokročilé manuální úpravy (křivky, selektivní úpravy)
- [ ] Možnosti exportu s různým nastavením kvality
- [ ] PWA podpora pro instalaci jako desktopová aplikace
- [ ] Podpora pro RAW formáty
- [ ] Batch export s vodoznakem

### V úvaze
- WebGPU podpora pro ještě rychlejší zpracování
- Vlastní trénované modely pro specifické use-cases
- Plugin systém pro rozšíření funkcionality

---

## 📄 Licence

MIT License - volně použitelné pro osobní i komerční projekty.

---

## 🤝 Přispívání

Příspěvky jsou vítány! Pokud máte nápad na vylepšení:
1. Forkněte repozitář
2. Vytvořte feature branch (`git checkout -b feature/amazing-feature`)
3. Commitněte změny (`git commit -m 'feat: Add amazing feature'`)
4. Pushněte do branche (`git push origin feature/amazing-feature`)
5. Otevřete Pull Request

---

## 🐛 Hlášení chyb

Našli jste bug? [Otevřete issue](https://github.com/Lukedaca/Artifex-AI/issues) s detailním popisem problému.

---

## 💡 Poznámky

- **Performance:** První analýza může trvat déle kvůli načítání AI modelů. Následné operace jsou rychlé.
- **Velikost obrázků:** Pro optimální výkon doporučujeme obrázky do 4K rozlišení.
- **Prohlížeč:** Chrome a Edge nabízejí nejlepší výkon díky optimalizaci TensorFlow.js.

---

**Vytvořeno s ❤️ pomocí TensorFlow.js a React**

*Verze 3.1 "Celestial" - 100% Offline AI Photo Editor*

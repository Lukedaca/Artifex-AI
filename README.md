# Artifex AI v2.0

![Logo Artifex AI](https://via.placeholder.com/150x50.png?text=Artifex+AI+Logo)

**Artifex AI je moderní aplikace pro úpravu a analýzu fotografií poháněná umělou inteligencí, určená pro fotografy všech úrovní. Kombinuje výkonné schopnosti AI s komplexní sadou nástrojů pro manuální úpravy, vše zabaleno do elegantního, responzivního a uživatelsky přívětivého rozhraní.**

---

## ✨ Klíčové funkce

### 1. Elegantní a responzivní uživatelské rozhraní
Krásné a intuitivní rozhraní, které bezproblémově funguje na všech zařízeních. Zahrnuje ohromující tmavý režim pro pohodlné úpravy za jakýchkoli světelných podmínek.

*Snímek obrazovky hlavního rozhraní, možná zobrazující světlý i tmavý režim vedle sebe.*


### 2. Snadné nahrávání fotografií
Snadno nahrajte své fotografie pomocí jednoduchého rozhraní drag-and-drop nebo výběrem souborů ze svého zařízení. Aplikace podporuje více formátů obrázků, včetně JPG, PNG, RAW a TIFF.

*Snímek obrazovky nahrávací obrazovky.*


### 3. Hloubková AI analýza
Využijte sílu Google Gemini API k získání podrobné analýzy vašich fotografií. AI poskytuje:
- Komplexní popis obsahu obrázku.
- Tři konkrétní návrhy na vylepšení (např. kompozice, osvětlení).
- Odhadované technické detaily jako ISO, clona a rychlost závěrky.

*Snímek obrazovky panelu AI analýzy s výsledky.*


### 4. Autopilot AI vylepšení
Jediným kliknutím nechte AI automaticky vylepšit vaši fotografii. Autopilot inteligentně upravuje jas, kontrast a vyvážení barev, aby vytvořil profesionálně upravený výsledek.

*Srovnání "před a po" obrázku s použitím Autopilota.*
![Autopilot AI](https://via.placeholder.com/800x450.png?text=Autopilot+Před+a+Po)

### 5. Komplexní sada pro manuální úpravy
Pro ty, kteří preferují jemné ovládání, nabízí panel pro manuální úpravy řadu nastavení:
- **Oříznutí:** Ořízněte obrázky na standardní poměry stran (16:9, 4:3, 1:1, 3:2).
- **Úpravy:** Posuvníky pro jas, kontrast, sytost a ostrost.
- **Živý náhled:** Sledujte své změny v reálném čase před jejich použitím.

*Snímek obrazovky panelu pro manuální úpravy s posuvníky.*
![Manuální úpravy](https://via.placeholder.com/800x450.png?text=Panel+manuálních+úprav)

### 6. Výkonné hromadné zpracování
Ušetřete čas použitím úprav na více obrázků najednou. Aktuálně podporuje hromadné oříznutí na vybraný poměr stran pro všechny nahrané fotografie.

*Snímek obrazovky pohledu pro hromadné zpracování.*
![Hromadné zpracování](https://via.placeholder.com/800x450.png?text=Hromadné+zpracování)

### 7. Plná historie Zpět/Vpřed
Experimentujte volně bez obav z chyb. Aplikace uchovává kompletní historii vašich úprav. Použijte standardní klávesové zkratky (`Ctrl+Z` pro zpět, `Ctrl+Y` pro vpřed) k navigaci mezi změnami.

---

## 🛠️ Použité technologie

-   **Frontend:** [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
-   **Stylování:** [Tailwind CSS](https://tailwindcss.com/)
-   **AI engine:** [Google Gemini API](https://ai.google.dev/)
-   **Build nástroj:** Vite (odvozeno z nastavení `index.html`)

---

## 🚀 Jak začít

1.  **Naklonujte repozitář:**
    ```bash
    git clone https://your-repository-url/artifex-ai.git
    cd artifex-ai
    ```
2.  **Nainstalujte závislosti:**
    ```bash
    npm install
    ```
3.  **Nastavte svůj API klíč:**
    -   Můžete nastavit svůj Google Gemini API klíč jako proměnnou prostředí s názvem `API_KEY` v souboru `.env`.
    -   Alternativně můžete klíč zadat přímo do aplikace prostřednictvím modálního okna pro API klíč.

4.  **Spusťte vývojový server:**
    ```bash
    npm run dev
    ```
5.  Otevřete prohlížeč a přejděte na zobrazenou lokální adresu serveru.

---

## 🔮 Nápady do budoucna

-   Aplikace AI Autopilota v hromadném režimu.
-   Ukládání a používání vlastních přednastavení (presetů).
-   Pokročilejší nástroje pro manuální úpravy (křivky, selektivní úpravy).
-   Možnosti exportu s různým nastavením kvality.
-   AI odstranění objektů nebo výměna pozadí.
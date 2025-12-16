
import React, { createContext, useState, useContext, ReactNode } from 'react';
import type { Language } from '../types';

const translations = {
  cs: {
    app_title: "Artifex AI",
    nav_studio: "Studio",
    nav_upload: "Nahrát fotky",
    nav_raw: "RAW Konvertor",
    nav_analysis: "AI Analýza",
    nav_manual: "Manuální úpravy",
    nav_batch: "Batch zpracování",
    nav_presets: "Uživatelské presety",
    nav_autopilot: "Autopilot AI",
    nav_remove_obj: "Odstranit objekt",
    nav_crop: "Automatické oříznutí",
    nav_style: "Přenos stylu",
    nav_bg: "Vyměnit pozadí",
    nav_gen: "Vytvořit obrázek",
    nav_export: "Export",
    nav_history: "Historie",
    nav_social: "Social Media Kit",
    nav_video: "Video (Veo)",
    
    home_title: "Artifex AI",
    home_subtitle: "Transformujte své fotografie silou umělé inteligence. Analyzujte, upravujte a vytvářejte ohromující vizuály jediným kliknutím.",
    home_enter: "Vstoupit do studia",
    
    upload_title: "Nahrát fotky",
    upload_drag: "Přetáhněte fotografie sem",
    upload_support: "Podpora JPG, PNG, WEBP a",
    upload_raw: "RAW soubory budou automaticky vyvolány a převedeny.",
    upload_btn: "Vybrat soubory",
    upload_processing: "Zpracovávám soubory...",
    
    editor_no_image: "Žádný vybraný obrázek",
    editor_upload_hint: "Nahrajte nebo vyberte obrázek pro zahájení úprav.",
    editor_analyzing: "Analyzuji...",
    editor_desc: "Popis",
    editor_suggestions: "Návrhy na vylepšení",
    editor_proactive: "Proaktivní návrhy",
    editor_tech: "Technické informace",
    
    tool_autopilot_desc: "Nechte AI automaticky vylepšit váš obrázek jedním kliknutím. Zachová původní strukturu a zaměří se na barvy a světlo.",
    tool_autopilot_btn: "Spustit Autopilot",
    tool_remove_desc: "Popište objekt, který chcete z obrázku odstranit.",
    tool_remove_placeholder: "např. 'modré auto v pozadí'",
    tool_remove_btn: "Odstranit",
    tool_crop_title: "Chytrý Ořez",
    tool_crop_instr: "Instrukce pro AI (Volitelné)",
    tool_crop_placeholder: "např. 'Ořízni jen na brankáře'",
    tool_crop_format: "Cílový formát (AI)",
    tool_crop_btn_only: "Pouze Oříznout",
    tool_crop_btn_export: "Oříznout a přejít k exportu",
    tool_bg_desc: "Popište nové pozadí, které chcete vložit do obrázku.",
    tool_bg_placeholder: "např. 'rušná ulice v Tokiu v noci'",
    tool_bg_btn: "Vyměnit pozadí",
    tool_style_desc: "Vyberte obrázek, jehož styl chcete aplikovat na aktuální fotografii.",
    tool_style_select: "Vyberte obrázek stylu",
    tool_style_btn: "Aplikovat styl",

    tool_social_title: "Social Media Assistant",
    tool_social_desc: "Nechte AI vytvořit poutavé popisky a hashtagy pro váš Instagram.",
    tool_social_btn: "Generovat texty",
    
    tool_video_title: "Oživení fotky (Veo)",
    tool_video_desc: "Vytvořte z fotky video pomocí AI modelu Veo.",
    tool_video_prompt: "Popište pohyb (např. 'filmový zoom', 'vlnící se tráva')",
    tool_video_btn: "Generovat Video",
    
    manual_title: "Manuální úpravy",
    manual_reset: "Resetovat",
    manual_crop_active: "Aktivovat manuální ořez",
    manual_brightness: "Jas",
    manual_contrast: "Kontrast",
    manual_saturation: "Sytost",
    manual_vibrance: "Živost",
    manual_shadows: "Stíny",
    manual_highlights: "Světlé tóny",
    manual_clarity: "Zřetelnost",
    manual_sharpness: "Ostrost",
    manual_noise: "Redukce šumu",
    manual_export_settings: "Nastavení Exportu",
    manual_finish: "Dokončit a Exportovat",

    export_title: "Exportovat obrázek",
    export_format: "Formát",
    export_quality: "Kvalita",
    export_size: "Velikost",
    export_original: "Původní",
    export_half: "Poloviční",
    export_download: "Stáhnout obrázek",

    batch_title: "Hromadné zpracování",
    batch_subtitle: "Aplikujte AI vylepšení na více obrázků najednou.",
    batch_select: "Vyberte obrázky",
    batch_selected: "vybráno",
    batch_select_all: "Označit vše",
    batch_deselect_all: "Odznačit vše",
    batch_run: "Spustit Autopilot AI na",
    batch_processing: "Zpracovávám...",
    batch_error: "Chyba při zpracování",
    batch_complete: "Dávkové zpracování dokončeno.",

    gen_title: "Vytvořte cokoliv s AI",
    gen_subtitle: "Popište obrázek, který si přejete vygenerovat, a nechte AI, aby ho vytvořila za vás.",
    gen_prompt: "Popis obrázku (prompt)",
    gen_placeholder: "např. Fotorealistický portrét astronauta jedoucího na koni na Marsu",
    gen_btn: "Generovat obrázek",
    gen_generating: "Generuji...",
    gen_add: "Přidat do projektu",
    
    raw_title: "Převodník z RAW do JPEG",
    raw_subtitle: "Samostatný nástroj pro hromadnou konverzi. Pro běžné úpravy můžete RAW soubory nahrát přímo v hlavní nabídce.",
    raw_convert: "Konvertovat",
    raw_converting: "Analyzuji a převádím",
    raw_add: "Přidat do Studia",
    raw_convert_more: "Převést další",
    raw_done: "Konverze dokončena",
    raw_drag: "Přetáhněte RAW soubory sem",
    raw_or_click: "nebo klikněte pro výběr",
    raw_select_other: "Vybrat jiné",
    raw_no_files: "Nebyly vybrány žádné soubory.",
    
    modal_api_title: "Nastavení Google Gemini API",
    modal_api_desc: "Tato aplikace vyžaduje vlastní API klíč pro komunikaci s AI modely.",
    modal_api_btn_auto: "Vybrat API klíč (Google AI Studio)",
    modal_api_manual_toggle: "Vložit klíč manuálně",
    modal_api_manual_label: "Vložte API klíč",
    modal_api_btn_save: "Uložit a Pokračovat",
    modal_api_footer: "Klíč je uložen pouze ve vašem prohlížeči. Získat ho můžete zdarma v",

    msg_api_missing: "API klíč chybí.",
    msg_success: "Akce dokončena.",
    msg_error: "Došlo k chybě.",
    notify_upload_success: "souborů nahráno.",
    notify_gen_success: "Obrázek byl úspěšně vygenerován.",
    notify_raw_success: "souborů připraveno.",

    compare_before: "Před",
    compare_after: "Po",
    compare_btn: "Porovnat"
  },
  en: {
    app_title: "Artifex AI",
    nav_studio: "Studio",
    nav_upload: "Upload Photos",
    nav_raw: "RAW Converter",
    nav_analysis: "AI Analysis",
    nav_manual: "Manual Edits",
    nav_batch: "Batch Processing",
    nav_presets: "User Presets",
    nav_autopilot: "Autopilot AI",
    nav_remove_obj: "Remove Object",
    nav_crop: "Auto Crop",
    nav_style: "Style Transfer",
    nav_bg: "Replace Background",
    nav_gen: "Generate Image",
    nav_export: "Export",
    nav_history: "History",
    nav_social: "Social Media Kit",
    nav_video: "Video (Veo)",
    
    home_title: "Artifex AI",
    home_subtitle: "Transform your photos with the power of AI. Analyze, edit, and create stunning visuals with a single click.",
    home_enter: "Enter Studio",
    
    upload_title: "Upload Photos",
    upload_drag: "Drag & Drop photos here",
    upload_support: "Supports JPG, PNG, WEBP and",
    upload_raw: "RAW files will be automatically developed and converted.",
    upload_btn: "Select Files",
    upload_processing: "Processing files...",
    
    editor_no_image: "No image selected",
    editor_upload_hint: "Upload or select an image to start editing.",
    editor_analyzing: "Analyzing...",
    editor_desc: "Description",
    editor_suggestions: "Improvement Suggestions",
    editor_proactive: "Proactive Suggestions",
    editor_tech: "Technical Info",
    
    tool_autopilot_desc: "Let AI automatically enhance your image with one click. Preserves original structure while focusing on color and light.",
    tool_autopilot_btn: "Run Autopilot",
    tool_remove_desc: "Describe the object you want to remove from the image.",
    tool_remove_placeholder: "e.g. 'blue car in the background'",
    tool_remove_btn: "Remove",
    tool_crop_title: "Smart Crop",
    tool_crop_instr: "AI Instructions (Optional)",
    tool_crop_placeholder: "e.g. 'Crop to the goalkeeper only'",
    tool_crop_format: "Target Format (AI)",
    tool_crop_btn_only: "Crop Only",
    tool_crop_btn_export: "Crop & Go to Export",
    tool_bg_desc: "Describe the new background you want to insert.",
    tool_bg_placeholder: "e.g. 'busy street in Tokyo at night'",
    tool_bg_btn: "Replace Background",
    tool_style_desc: "Select an image whose style you want to apply to the current photo.",
    tool_style_select: "Select Style Image",
    tool_style_btn: "Apply Style",

    tool_social_title: "Social Media Assistant",
    tool_social_desc: "Let AI write engaging captions and hashtags for your Instagram.",
    tool_social_btn: "Generate Content",

    tool_video_title: "Animate Photo (Veo)",
    tool_video_desc: "Generate a video from your photo using the Veo model.",
    tool_video_prompt: "Describe motion (e.g. 'cinematic zoom', 'waving grass')",
    tool_video_btn: "Generate Video",
    
    manual_title: "Manual Edits",
    manual_reset: "Reset",
    manual_crop_active: "Activate Manual Crop",
    manual_brightness: "Brightness",
    manual_contrast: "Contrast",
    manual_saturation: "Saturation",
    manual_vibrance: "Vibrance",
    manual_shadows: "Shadows",
    manual_highlights: "Highlights",
    manual_clarity: "Clarity",
    manual_sharpness: "Sharpness",
    manual_noise: "Noise Reduction",
    manual_export_settings: "Export Settings",
    manual_finish: "Finish & Export",

    export_title: "Export Image",
    export_format: "Format",
    export_quality: "Quality",
    export_size: "Size",
    export_original: "Original",
    export_half: "Half",
    export_download: "Download Image",

    batch_title: "Batch Processing",
    batch_subtitle: "Apply AI enhancements to multiple images at once.",
    batch_select: "Select Images",
    batch_selected: "selected",
    batch_select_all: "Select All",
    batch_deselect_all: "Deselect All",
    batch_run: "Run Autopilot AI on",
    batch_processing: "Processing...",
    batch_error: "Error processing",
    batch_complete: "Batch processing complete.",

    gen_title: "Create anything with AI",
    gen_subtitle: "Describe the image you wish to generate and let AI create it for you.",
    gen_prompt: "Image Description (Prompt)",
    gen_placeholder: "e.g. Photorealistic portrait of an astronaut riding a horse on Mars",
    gen_btn: "Generate Image",
    gen_generating: "Generating...",
    gen_add: "Add to Project",
    
    raw_title: "RAW to JPEG Converter",
    raw_subtitle: "Standalone tool for bulk conversion. For regular editing, you can upload RAW files directly in the main menu.",
    raw_convert: "Convert",
    raw_converting: "Analyzing and converting",
    raw_add: "Add to Studio",
    raw_convert_more: "Convert More",
    raw_done: "Conversion Complete",
    raw_drag: "Drag & Drop RAW files here",
    raw_or_click: "or click to select",
    raw_select_other: "Select Other",
    raw_no_files: "No files selected.",
    
    modal_api_title: "Google Gemini API Settings",
    modal_api_desc: "This application requires your own API key to communicate with AI models.",
    modal_api_btn_auto: "Select API Key (Google AI Studio)",
    modal_api_manual_toggle: "Enter key manually",
    modal_api_manual_label: "Enter API Key",
    modal_api_btn_save: "Save & Continue",
    modal_api_footer: "The key is stored only in your browser. You can get it for free at",

    msg_api_missing: "API Key is missing.",
    msg_success: "Action completed.",
    msg_error: "An error occurred.",
    notify_upload_success: "files uploaded.",
    notify_gen_success: "Image successfully generated.",
    notify_raw_success: "files prepared.",

    compare_before: "Before",
    compare_after: "After",
    compare_btn: "Compare"
  }
};

type Translations = typeof translations.cs;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('cs');

  const value = {
    language,
    setLanguage,
    t: translations[language]
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};

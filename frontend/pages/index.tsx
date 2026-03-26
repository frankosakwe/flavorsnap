import React, { useEffect, useRef, useState } from "react";
import { api } from "@/utils/api";
import { ErrorMessage } from "@/components/ErrorMessage";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useKeyboardShortcuts } from "@/utils/useKeyboardShortcuts";
import { exportToCSV, exportToJSON } from "@/utils/exportUtils";

interface HistoryEntry {
  id: number;
  timestamp: string;
  food: string;
  confidence: number;
  calories?: number;
}

export default function Classify() {
  const { t } = useTranslation("common");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<any>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("classification_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    localStorage.setItem("classification_history", JSON.stringify(history));
  }, [history]);

  const handleReset = () => {
    setImage(null);
    setClassification(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setImage(imageUrl);
      setError(null);
      setClassification(null);
    }
  };

  const handleClassify = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);

    // Announce to screen readers that classification is starting
    const announcement = document.getElementById('classification-announcement');
    if (announcement) {
      announcement.textContent = t('classifying');
    }

    try {
      // Example API call with error handling
      const response = await api.post('/api/classify', {
        image: image
      }, {
        retries: 2,
        retryDelay: 1000
      });

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setClassification(response.data);
        // Add to history
        setHistory(prev => [{
          id: Date.now(),
          timestamp: new Date().toISOString(),
          ...response.data
        }, ...prev]);
      }
    } catch (err: any) {
      setError(t('error_classify_retry'));
      console.error('Classification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleExportJSON = () => {
    exportToJSON(history, "flavorsnap_history");
  };

  const handleExportCSV = () => {
    exportToCSV(history, "flavorsnap_history");
  };

  const clearHistory = () => {
    if (confirm(t("confirm_clear_history", "Are you sure you want to clear your classification history?"))) {
      setHistory([]);
    }
  };

  useKeyboardShortcuts([
    { key: 'o', action: handleOpenPicker },
    { key: 'c', action: () => image && !loading && handleClassify() },
    { key: 'r', action: handleReset },
    { key: 'Escape', action: handleReset },
  ]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="w-full max-w-6xl flex justify-end mb-4">
        <LanguageSwitcher />
      </div>

      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-emerald-500 leading-tight">
          {t("app_title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm md:text-lg max-w-sm md:max-w-xl mx-auto">
          {t("shortcut_hint", "Press 'O' to open camera, 'C' to classify, 'R' to reset")}
        </p>
      </header>

      {/* Main Action Area */}
      <div className="w-full max-w-md md:max-w-2xl flex flex-col items-center">
        {/* Screen reader announcements */}
        <div id="classification-announcement" role="status" aria-live="polite" className="sr-only" />
        <div id="error-announcement" role="alert" aria-live="assertive" className="sr-only" />

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
          aria-label={t("select_image_file")}
        />

        {!image && (
          <button
            onClick={handleOpenPicker}
            className="group relative bg-indigo-600 text-white px-8 py-6 md:px-16 md:py-12 rounded-3xl shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500/50 flex flex-col items-center gap-4 animate-pulse-slow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 md:h-20 md:w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xl md:text-3xl font-black">{t("open_camera")}</span>
            <kbd className="hidden sm:inline-block px-3 py-1 text-sm bg-indigo-500 rounded border border-indigo-400">O</kbd>
          </button>
        )}

        {error && (
          <div className="w-full mb-6 mt-4 max-w-md">
            <ErrorMessage
              message={error}
              onRetry={() => handleClassify()}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {image && (
          <div className="w-full space-y-8 animate-fade-in" role="region" aria-label={t("image_preview")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="relative group overflow-hidden rounded-3xl shadow-2xl border-4 border-white dark:border-gray-800">
                <img
                  src={image}
                  alt={t("preview_alt")}
                  className="w-full h-auto object-cover max-h-80 md:max-h-[500px]"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500 transition-all focus:outline-none"
                  title={t("clear_image", "Clear (R)")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <button
                  onClick={handleClassify}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white px-8 py-5 md:py-8 rounded-3xl shadow-xl hover:bg-emerald-700 disabled:bg-gray-400 transition-all active:scale-95 text-xl font-black"
                >
                  {loading ? t('classifying') : t('classify_food')}
                  {!loading && <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-emerald-500 rounded border border-emerald-400 uppercase">C</kbd>}
                  {loading && <div className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full" />}
                </button>

                {classification && (
                  <div className="p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-emerald-100 dark:border-emerald-900/30 animate-scale-in">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                      <span className="text-emerald-500">✅</span> {t('classification_result')}
                    </h3>
                    <div className="space-y-6">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl flex justify-between items-center">
                        <div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mb-1">{t("result_label", "Prediction")}</p>
                          <p className="text-3xl font-black text-emerald-800 dark:text-emerald-200">{classification.food}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mb-1">{t("result_confidence", "Confidence")}</p>
                          <p className="text-3xl font-black text-emerald-800 dark:text-emerald-200">{(classification.confidence * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                      {classification.calories && (
                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                            🔥 Estimated Calories: <span className="text-orange-600 dark:text-orange-400 font-black text-lg">{classification.calories} kcal</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History & Export Section */}
      <section className="w-full max-w-6xl mt-16 md:mt-24 pb-12 border-t border-gray-200 dark:border-gray-800 pt-12 md:pt-20">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 md:mb-12 gap-6">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white flex items-center gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("history", "History")}
            <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm py-1 px-3 rounded-full">{history.length}</span>
          </h2>

          {history.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportJSON}
                className="bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-5 py-3 rounded-2xl text-sm font-black shadow-sm border border-gray-100 dark:border-gray-700 transition-all flex items-center gap-2"
              >
                {t("export_json", "JSON")}
              </button>
              <button
                onClick={handleExportCSV}
                className="bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-5 py-3 rounded-2xl text-sm font-black shadow-sm border border-gray-100 dark:border-gray-700 transition-all flex items-center gap-2"
              >
                {t("export_csv", "CSV")}
              </button>
              <div className="w-px h-8 bg-gray-300 dark:bg-gray-700 mx-2" />
              <button
                onClick={clearHistory}
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-2xl transition-all"
                title={t("clear_history", "Clear History")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/50 rounded-[40px] p-20 text-center border-4 border-dashed border-gray-100 dark:border-gray-800">
            <p className="text-gray-400 dark:text-gray-500 text-xl font-medium italic">
              {t("no_history_yet", "Your classified foods will appear here.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-50 dark:border-gray-700 group hover:shadow-2xl hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                    {new Date(entry.id).toLocaleDateString()}
                  </span>
                  <span className="text-emerald-500 font-black text-sm">{(entry.confidence * 100).toFixed(0)}%</span>
                </div>
                <h4 className="text-xl font-black text-gray-900 dark:text-white capitalize truncate mb-1">{entry.food}</h4>
                {entry.calories && <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">{entry.calories} kcal</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});

type MciPreviewWindow = Window & typeof globalThis & {
  __mciPreviewSwCleanupPromise?: Promise<unknown>;
  __mciSkipAppBootForSwReload?: boolean;
};

const boot = async () => {
  const win = window as MciPreviewWindow;

  try {
    if (win.__mciPreviewSwCleanupPromise && typeof win.__mciPreviewSwCleanupPromise.then === "function") {
      await win.__mciPreviewSwCleanupPromise;
    }
  } catch {
    // A limpeza é defensiva; falha nela não pode impedir o app de abrir.
  }

  if (!win.__mciSkipAppBootForSwReload) {
    await import("./main");
  }
};

void boot();
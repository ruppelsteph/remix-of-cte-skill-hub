// Dev-only watchdog: auto-reload the page when Vite reconnects after a drop.
// Stripped from production because the entire body is gated by `import.meta.hot`.

if (import.meta.hot) {
  let wasDisconnected = false;
  let polling = false;
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    // Small delay to let the new server fully come up.
    setTimeout(() => window.location.reload(), 150);
  };

  const startPolling = () => {
    if (polling) return;
    polling = true;
    const tick = async () => {
      try {
        await fetch(window.location.origin, {
          mode: "no-cors",
          cache: "no-store",
          headers: {
            Accept: "text/x-vite-ping",
          },
        });
        if (wasDisconnected) {
          polling = false;
          reload();
          return;
        }
      } catch {
        // still down, keep polling
      }
      setTimeout(tick, 1000);
    };
    tick();
  };

  import.meta.hot.on("vite:ws:disconnect", () => {
    wasDisconnected = true;
    startPolling();
  });

  import.meta.hot.on("vite:ws:connect", () => {
    if (wasDisconnected) {
      wasDisconnected = false;
      reload();
    }
  });
}

export {};

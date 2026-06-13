if ('serviceWorker' in navigator && !window.__ROUTESERVE_PWA_ACTIVE) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    registrations.forEach(function(registration) { registration.unregister(); });
  });
}

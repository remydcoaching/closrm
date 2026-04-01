/**
 * Generates a tracking script string for injection into public funnel pages.
 * Handles: page views, CTA clicks, YouTube video progress.
 */
export function generateTrackingScript(funnelPageId: string): string {
  return `
(function() {
  var PAGE_ID = "${funnelPageId}";
  var API = "/api/public/f/events";

  // ─── Visitor ID (cookie-based) ──────────────────────────────────────────
  function getVisitorId() {
    var match = document.cookie.match(/(^|;)\\s*_closrm_vid=([^;]+)/);
    if (match) return match[2];
    var id = crypto.randomUUID ? crypto.randomUUID() : "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    document.cookie = "_closrm_vid=" + id + ";path=/;max-age=31536000;SameSite=Lax";
    return id;
  }

  var visitorId = getVisitorId();

  function sendEvent(eventType, metadata) {
    try {
      navigator.sendBeacon(API, JSON.stringify({
        funnel_page_id: PAGE_ID,
        event_type: eventType,
        visitor_id: visitorId,
        metadata: metadata || {}
      }));
    } catch(e) {
      // Fallback to fetch
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnel_page_id: PAGE_ID,
          event_type: eventType,
          visitor_id: visitorId,
          metadata: metadata || {}
        }),
        keepalive: true
      }).catch(function() {});
    }
  }

  // ─── Page view ──────────────────────────────────────────────────────────
  sendEvent("view");

  // ─── CTA click tracking ─────────────────────────────────────────────────
  document.addEventListener("click", function(e) {
    var el = e.target.closest("[data-cta]");
    if (!el) return;
    sendEvent("button_click", {
      button_text: (el.textContent || "").trim().slice(0, 100),
      target_url: el.href || el.dataset.cta || ""
    });
  });

  // ─── YouTube video tracking ─────────────────────────────────────────────
  var ytMilestones = {};

  window.addEventListener("message", function(e) {
    try {
      var data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (!data || !data.event) return;

      // YouTube iframe API posts messages with event = "infoDelivery"
      if (data.event === "infoDelivery" && data.info && typeof data.info.currentTime === "number" && typeof data.info.duration === "number") {
        var pct = Math.floor((data.info.currentTime / data.info.duration) * 100);
        var iframeId = data.id || "unknown";
        var key = iframeId;

        if (!ytMilestones[key]) ytMilestones[key] = {};

        var milestones = [25, 50, 75, 100];
        for (var i = 0; i < milestones.length; i++) {
          var m = milestones[i];
          if (pct >= m && !ytMilestones[key][m]) {
            ytMilestones[key][m] = true;
            sendEvent("video_play", { milestone: m, iframe_id: iframeId });
          }
        }
      }
    } catch(err) {}
  });
})();
`.trim()
}

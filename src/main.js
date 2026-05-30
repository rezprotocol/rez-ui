import "./index.css";
import { createUiHost } from "./framework/index.js";

const mountEl = document.getElementById("app");
if (!mountEl) {
  throw new Error("Missing #app root element");
}

const ui = createUiHost({
  mountEl,
  views: {
    default: ({ mountEl: root }) => {
      root.innerHTML = [
        "<main style='padding:24px;font-family:Manrope,sans-serif;'>",
        "<h1 style='margin:0 0 8px;'>rez-ui framework</h1>",
        "<p style='margin:0;'>Framework-only package: rendering primitives and assets.</p>",
        "</main>",
      ].join("");
    },
  },
});

ui.render({ view: "default" });

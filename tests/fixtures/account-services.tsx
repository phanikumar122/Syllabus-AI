// Isolated browser test harness. Not an application route or a production build entry.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import AccountServices from "../../src/components/AccountServices";
import { auth } from "../../src/lib/firebase";
import "../../src/index.css";
Object.defineProperty(auth, "currentUser", {
  configurable: true,
  value: { uid: "browser-test", getIdToken: async () => "browser-test" },
});
createRoot(document.getElementById("root")!).render(
  createElement(AccountServices, { isCloud: true }),
);

import { createRoot } from "react-dom/client";
import App from "./App";
import { initAuth } from "./lib/auth";
import "./index.css";

initAuth().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

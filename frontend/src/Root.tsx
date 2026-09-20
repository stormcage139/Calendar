import { useEffect, useState } from "react";
import App from "./App";
import Planner from "./pages/Planner";

export default function Root() {
  const [calendar, setCalendar] = useState(
    window.location.hash === "#calendar",
  );

  useEffect(() => {
    const syncPage = () => setCalendar(window.location.hash === "#calendar");
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  return calendar ? <Planner /> : <App />;
}

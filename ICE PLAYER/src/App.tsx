import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import Home from "@/pages/Home";
import Gallery from "@/pages/Gallery";
import ComingSoon from "@/pages/ComingSoon";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/login" element={<Navigate to="/coming-soon?intent=login" replace />} />
          <Route path="/download" element={<Navigate to="/coming-soon?intent=download" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

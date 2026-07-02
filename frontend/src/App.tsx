// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Chat } from "./pages/Chat";
import { Search } from "./pages/Search";
import { Graph } from "./pages/Graph";
import { Impact } from "./pages/Impact";
import { Quality } from "./pages/Quality";
import { History } from "./pages/History";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
          <Route path="search" element={<Search />} />
          <Route path="graph" element={<Graph />} />
          <Route path="impact" element={<Impact />} />
          <Route path="quality" element={<Quality />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

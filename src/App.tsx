import { NavLink, Route, Routes } from "react-router-dom";
import Model from "./components/Model.tsx";
import { useAvatar } from "./lib/store.tsx";
import AddItem from "./pages/AddItem.tsx";
import AvatarPage from "./pages/AvatarPage.tsx";
import Closet from "./pages/Closet.tsx";
import DressingRoom from "./pages/DressingRoom.tsx";
import Lookbook from "./pages/Lookbook.tsx";

/** "The Closet Issue · November 2026", a small masthead flourish. */
function issueLine() {
  return `The Closet Issue · ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

export default function App() {
  const { avatar } = useAvatar();
  return (
    <div className="app">
      <header className="topbar">
        <span className="issue">{issueLine()}</span>
        <NavLink to="/" className="brand">
          Fashion <em>Plates</em>
        </NavLink>
        <NavLink to="/avatar" className="me" aria-label="My model" title="My model">
          <Model avatar={avatar} headshot />
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Dressing Room
          </NavLink>
          <NavLink to="/closet">Closet</NavLink>
          <NavLink to="/lookbook">Lookbook</NavLink>
          <NavLink to="/avatar">My Model</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DressingRoom />} />
          <Route path="/closet" element={<Closet />} />
          <Route path="/closet/new" element={<AddItem />} />
          <Route path="/lookbook" element={<Lookbook />} />
          <Route path="/avatar" element={<AvatarPage />} />
          <Route path="*" element={<div className="page"><h1>Not found</h1></div>} />
        </Routes>
      </main>
    </div>
  );
}
